// scripts/set-chat-menu-button.ts
// Sets a persistent chat menu button to open your Mini App.
// Env needed: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and
// either SUPABASE_PROJECT_ID or SUPABASE_URL to resolve the function host.
import { functionUrl } from "../supabase/functions/_shared/edge.ts";

const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

if (!token || !secret) {
  console.error(
    "Need TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in env.",
  );
  Deno.exit(1);
}

const fnUrl = functionUrl("telegram-bot");
if (!fnUrl) {
  console.error("Could not determine Supabase Functions host");
  Deno.exit(1);
}

const cfgRes = await fetch(`${fnUrl}?miniapp-config=1&secret=${secret}`);
const cfg = await cfgRes.json();
const urlRaw: string | null = cfg.mini_app_url ?? null;
const shortName: string | null = cfg.mini_app_short_name ?? null;

if (!urlRaw && !shortName) {
  console.error("Mini app not configured in Edge function env.");
  Deno.exit(1);
}

let url: string;
if (shortName) {
  const meRes = await fetch(
    `https://api.telegram.org/bot${token}/getMe`,
  );
  const me = await meRes.json();
  const username: string | undefined = me.result?.username;
  if (!username) {
    console.error("Could not determine bot username from getMe");
    Deno.exit(1);
  }
  url = `https://t.me/${username}/${shortName}`;
} else {
  url = urlRaw!.endsWith("/") ? urlRaw! : urlRaw! + "/";
}

const payload = {
  menu_button: {
    type: "web_app",
    text: "Open VIP Mini App",
    web_app: { url },
  },
};

const res = await fetch(
  `https://api.telegram.org/bot${token}/setChatMenuButton`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  },
);
const text = await res.text();
console.log("setChatMenuButton", res.status, text.slice(0, 500));
