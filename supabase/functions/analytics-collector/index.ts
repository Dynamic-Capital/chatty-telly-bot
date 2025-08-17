import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";
import { ok } from "../_shared/http.ts";
import { version } from "../_shared/version.ts";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function handler(req: Request): Promise<Response> {
  const v = version(req, "analytics-collector");
  if (v) return v;
  if (req.method === "HEAD") return ok();
  const supa = createClient();

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

  const { count: totalUsers } = await supa.from("bot_users").select("id", {
    count: "exact",
    head: true,
  });

  const { count: newUsers } = await supa.from("bot_users")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start).lte("created_at", end);

  const { data: pays } = await supa.from("payments")
    .select("amount")
    .eq("status", "completed")
    .gte("updated_at", start).lte("updated_at", end);

  const revenue = (pays ?? []).reduce(
    (s, p: { amount?: unknown }) => s + (Number(p.amount ?? 0) || 0),
    0,
  );

  const { data: interactions } = await supa.from("user_interactions")
    .select("interaction_type")
    .gte("created_at", start).lte("created_at", end);

  const buttons: Record<string, number> = {};
  for (const r of interactions ?? []) {
    const k = r.interaction_type || "unknown";
    buttons[k] = (buttons[k] ?? 0) + 1;
  }

  const commands = buttons["command"] ?? 0;
  const completed = (pays ?? []).length;
  const conversionRates = { simple: commands ? (completed / commands) : 0 };

  const topPromoCodes: Record<string, number> = {};
  try {
    const { data: promos } = await supa.from("promo_analytics")
      .select("promo_code")
      .gte("created_at", start).lte("created_at", end);
    for (const p of promos ?? []) {
      const code = p.promo_code || "unknown";
      topPromoCodes[code] = (topPromoCodes[code] ?? 0) + 1;
    }
  } catch {
    // ignore if promo_analytics table is absent
  }

  await supa.from("daily_analytics").upsert({
    date: day,
    total_users: totalUsers ?? 0,
    new_users: newUsers ?? 0,
    button_clicks: buttons,
    conversion_rates: conversionRates,
    top_promo_codes: topPromoCodes,
    revenue,
  }, { onConflict: "date" });

  return ok({
    day,
    total_users: totalUsers,
    new_users: newUsers,
    revenue,
  });
}

if (import.meta.main) serve(handler);
