// scripts/check-linkage.ts
// Runs an external linkage check using env + Telegram + (optionally) the Edge audit function.
// Prints findings; always exits 0.

function env(k: string) { return Deno.env.get(k) ?? ""; }

async function getJson(url: string) {
  try { const r = await fetch(url); return await r.json(); }
  catch { return null; }
}

async function main() {
  const token = env("TELEGRAM_BOT_TOKEN");
  const proj = env("SUPABASE_PROJECT_ID");
  const mini = env("MINI_APP_URL");
  const expectedWebhook = proj ? `https://${proj}.functions.supabase.co/telegram-bot` : null;
  let currentWebhook: string | null = null;

  if (token) {
    const info = await getJson(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    currentWebhook = info?.result?.url ?? null;
    console.log("[linkage] getWebhookInfo.ok:", !!info?.ok);
    console.log("[linkage] current webhook:", currentWebhook || "(none)");
  } else {
    console.log("[linkage] TELEGRAM_BOT_TOKEN missing — skipping webhook check.");
  }

  if (expectedWebhook) console.log("[linkage] expected webhook:", expectedWebhook);
  if (mini) console.log("[linkage] MINI_APP_URL:", mini);

  const healthUrl = proj ? `https://${proj}.functions.supabase.co/linkage-audit` : null;
  if (healthUrl) {
    const inside = await getJson(healthUrl);
    console.log("[linkage] Edge linkage-audit:", inside ? "reachable" : "not reachable");
    if (inside) console.log(JSON.stringify(inside, null, 2).slice(0, 1000));
  }

  // Always succeed; human interprets output.
  Deno.exit(0);
}

await main();
