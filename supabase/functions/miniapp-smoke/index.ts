import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const must = (k: string) =>
  Deno.env.get(k) || (() => {
    throw new Error(`Missing ${k}`);
  })();

async function headOK(url: string) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok || (r.status >= 200 && r.status < 400);
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await req.json();
  } catch { /* ignore */ }
  const initData = body.initData as string | undefined;
  const telegram_id = body.telegram_id as string | undefined;

  const mini = Deno.env.get("MINI_APP_URL") ||
    `https://${(Deno.env.get("SUPABASE_URL")
      ? new URL(must("SUPABASE_URL")).hostname.split(".")[0]
      : must("SUPABASE_PROJECT_ID"))}.functions.supabase.co/miniapp/`;

  const checks: Record<string, unknown> = { ok: true, miniAppUrl: mini };

  // 1) Reachability of miniapp host
  checks.reach = await headOK(mini);
  if (!checks.reach) checks.ok = false;

  // 2) Verify initData (if provided)
  if (initData) {
    try {
      const r = await fetch(
        `https://${(Deno.env.get("SUPABASE_URL")
          ? new URL(must("SUPABASE_URL")).hostname.split(".")[0]
          : must(
            "SUPABASE_PROJECT_ID",
          ))}.functions.supabase.co/verify-initdata`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData }),
        },
      );
      const j = await r.json().catch(() => ({}));
      checks.verify = { status: r.status, ok: !!j?.ok };
      if (!j?.ok) checks.ok = false;
    } catch (e) {
      checks.verify = { error: String(e) };
      checks.ok = false;
    }
  } else {
    checks.verify = { skipped: true };
  }

  // 3) VIP status (if telegram_id provided)
  if (telegram_id) {
    try {
      const r = await fetch(
        `https://${(Deno.env.get("SUPABASE_URL")
          ? new URL(must("SUPABASE_URL")).hostname.split(".")[0]
          : must("SUPABASE_PROJECT_ID"))}.functions.supabase.co/miniapp-health`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ telegram_id }),
        },
      );
      const j = await r.json().catch(() => ({}));
      checks.health = { status: r.status, ok: !!j?.ok, vip: j?.vip ?? null };
      if (!j?.ok) checks.ok = false;
    } catch (e) {
      checks.health = { error: String(e) };
      checks.ok = false;
    }
  } else {
    checks.health = { skipped: true };
  }

  return new Response(JSON.stringify(checks, null, 2), {
    headers: { "content-type": "application/json" },
    status: checks.ok ? 200 : 500,
  });
});
