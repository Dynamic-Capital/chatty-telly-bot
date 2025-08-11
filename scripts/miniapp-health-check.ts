// scripts/miniapp-health-check.ts
// Pings the deployed miniapp-health endpoint (GET + optional POST).
// Env: SUPABASE_PROJECT_ID or HEALTH_URL (override), TELEGRAM_ID (optional for POST).
const proj = Deno.env.get("SUPABASE_PROJECT_ID");
const base = Deno.env.get("HEALTH_URL") ??
  (proj ? `https://${proj}.functions.supabase.co/miniapp-health` : null);
if (!base) {
  console.error("Set HEALTH_URL or SUPABASE_PROJECT_ID");
  Deno.exit(1);
}

const getRes = await fetch(base);
console.log(
  "GET /miniapp-health →",
  getRes.status,
  (await getRes.text()).slice(0, 500),
);

const tid = Deno.env.get("TELEGRAM_ID");
if (tid) {
  const postRes = await fetch(base, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ telegram_id: tid }),
  });
  console.log(
    "POST /miniapp-health →",
    postRes.status,
    (await postRes.text()).slice(0, 500),
  );
} else {
  console.log("No TELEGRAM_ID set — skipping POST");
}
