import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function svc() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}
function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

serve(async (_req) => {
  const supa = svc();

  // Define "day" as UTC day for simplicity; adjust if you prefer MVT (UTC+5).
  const today = new Date();
  const y = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - 1,
    ),
  );
  const day = isoDay(y);

  const start = new Date(`${day}T00:00:00.000Z`).toISOString();
  const end = new Date(`${day}T23:59:59.999Z`).toISOString();

  // total users (all-time)
  const { count: totalUsers } = await supa.from("bot_users").select("id", {
    count: "exact",
    head: true,
  });

  // new users (yesterday)
  const { count: newUsers } = await supa.from("bot_users")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start).lte("created_at", end);

  // revenue (completed payments yesterday)
  const { data: pays } = await supa.from("payments")
    .select("amount")
    .eq("status", "completed")
    .gte("updated_at", start).lte("updated_at", end);

  const revenue = (pays ?? []).reduce(
    (s, p: any) => s + (Number(p.amount ?? 0) || 0),
    0,
  );

  // interactions breakdown
  const { data: interactions } = await supa.from("user_interactions")
    .select("interaction_type")
    .gte("created_at", start).lte("created_at", end);

  const buttons: Record<string, number> = {};
  for (const r of interactions ?? []) {
    const k = r.interaction_type || "unknown";
    buttons[k] = (buttons[k] ?? 0) + 1;
  }

  // conversions (very simple): completed payments / commands
  const commands = buttons["command"] ?? 0;
  const completed = (pays ?? []).length;
  const conversionRates = { simple: commands ? (completed / commands) : 0 };

  // top promo codes if table present
  let topPromoCodes: Record<string, number> = {};
  try {
    const { data: promos } = await supa.from("promo_analytics")
      .select("promo_code")
      .gte("created_at", start).lte("created_at", end);
    for (const p of promos ?? []) {
      const code = p.promo_code || "unknown";
      topPromoCodes[code] = (topPromoCodes[code] ?? 0) + 1;
    }
  } catch {}

  // upsert daily_analytics
  await supa.from("daily_analytics").upsert({
    date: day,
    total_users: totalUsers ?? 0,
    new_users: newUsers ?? 0,
    button_clicks: buttons,
    conversion_rates: conversionRates,
    top_promo_codes: topPromoCodes,
    revenue,
  }, { onConflict: "date" });

  return new Response(
    JSON.stringify({
      ok: true,
      day,
      total_users: totalUsers,
      new_users: newUsers,
      revenue,
    }),
    {
      headers: { "content-type": "application/json" },
    },
  );
});
