import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { expectedSecret, readDbWebhookSecret } from "../_shared/telegram_secret.ts";

const need = (k: string) =>
  Deno.env.get(k) || (() => {
    throw new Error(`Missing env ${k}`);
  })();

function projectRef(): string {
  const u = need("SUPABASE_URL");
  try {
    return new URL(u).hostname.split(".")[0];
  } catch {
    return need("SUPABASE_PROJECT_ID");
  }
}
function normUrl(u: string) {
  return u.endsWith("/") ? u : (u + "/");
}

function genHex(n = 24) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function upsertDbSecret(supa: any, val: string) {
  const { error } = await supa.from("bot_settings").upsert({
    setting_key: "TELEGRAM_WEBHOOK_SECRET",
    setting_value: val,
  }, { onConflict: "setting_key" });
  if (error) throw new Error("upsert bot_settings failed: " + error.message);
}

async function tg(token: string, method: string, body?: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j };
}

serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const ref = projectRef();
  const expectedWebhook = `https://${ref}.functions.supabase.co/telegram-bot`;
  const expectedMini = normUrl(
    Deno.env.get("MINI_APP_URL") ||
      `https://${ref}.functions.supabase.co/miniapp/`,
  );

  const supa = createClient(
    need("SUPABASE_URL"),
    need("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  const token = need("TELEGRAM_BOT_TOKEN");

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const fix = Boolean(body?.fix);

  // 1) Telegram state
  const webhookInfo = await tg(token, "getWebhookInfo");
  const chatMenu = await tg(token, "getChatMenuButton");

  const currentWebhook = webhookInfo.json?.result?.url || null;
  const currentMenuUrl = chatMenu.json?.result?.menu_button?.web_app?.url ||
    null;

  // 2) Function reachability
  async function fetchJSON(u: string) {
    try {
      const r = await fetch(u);
      const j = await r.json();
      return { ok: r.ok, j };
    } catch {
      return { ok: false, j: null };
    }
  }
  const botVer = await fetchJSON(`${expectedWebhook}/version`);
  const miniVer = await fetchJSON(`${expectedMini}version`);

  // 3) Secret presence (ENV/DB)
  const envSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || null;
  let dbSecret = await readDbWebhookSecret();
  
  // 4) Compute mismatches
  const mismatches: string[] = [];
  if (currentWebhook !== expectedWebhook) mismatches.push("webhook_url");
  if (currentMenuUrl !== expectedMini) mismatches.push("chat_menu_url");
  if (!botVer.ok) mismatches.push("bot_unreachable");
  if (!miniVer.ok) mismatches.push("mini_unreachable");
  const secret = dbSecret || envSecret;
  if (!secret) mismatches.push("webhook_secret_missing");

  // 5) Optional fixes
  const actions: any[] = [];
  if (fix) {
    // Ensure we have a secret
    if (!secret) {
      dbSecret = genHex(24);
      await upsertDbSecret(supa, dbSecret);
      actions.push({ set: "db_secret" });
    }
    const secretVal = await expectedSecret();

    // Reapply webhook if needed
    if (currentWebhook !== expectedWebhook) {
      const set = await tg(token, "setWebhook", {
        url: expectedWebhook,
        secret_token: secretVal!,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      });
      actions.push({ setWebhook: set.json });
    }

    // Reset chat menu button if needed (add cache-busting v if requested)
    const ver = body?.version || String(Date.now());
      const targetMenu = body?.no_version
      ? expectedMini
      : `${expectedMini}?v=${ver}`;
    if (currentMenuUrl !== targetMenu) {
      const set = await tg(token, "setChatMenuButton", {
        menu_button: {
          type: "web_app",
          text: "Open VIP Mini App",
          web_app: { url: targetMenu },
        },
      });
      actions.push({ setChatMenuButton: set.json, url: targetMenu });
    }
  }

  const ok = mismatches.length === 0;

  return new Response(
    JSON.stringify(
      {
        ok,
        expected: { webhook: expectedWebhook, miniapp: expectedMini },
        actual: { webhook: currentWebhook, chat_menu: currentMenuUrl },
        reachability: { bot: botVer.ok, mini: miniVer.ok },
        secret: { env: !!envSecret, db: !!dbSecret },
        mismatches,
        actions,
      },
      null,
      2,
    ),
    {
      headers: { "content-type": "application/json" },
      status: ok ? 200 : (fix ? 207 : 200),
    },
  );
});
