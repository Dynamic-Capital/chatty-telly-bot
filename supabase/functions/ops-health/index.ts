import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  const report: Record<string, unknown> = { ok: true, checks: {} };

  function checkEnv(name: string, required = true) {
    const ok = !!Deno.env.get(name);
    report.checks![name] = ok;
    if (required && !ok) report.ok = false;
  }

  [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TELEGRAM_BOT_TOKEN",
  ].forEach((k) => checkEnv(k, true));
  ["TELEGRAM_WEBHOOK_SECRET", "MINI_APP_URL"].forEach((k) =>
    checkEnv(k, false)
  );

  // DB ping
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await supa.from("bot_users").select("id").limit(1);
    report.checks!["db"] = !error;
    if (error) report.ok = false;
  } catch {
    report.ok = false;
    report.checks!["db"] = false;
  }

  // Function reachability (self)
  report.checks!["self"] = true;

  const code = report.ok ? 200 : 500;
  return new Response(JSON.stringify(report, null, 2), {
    headers: { "content-type": "application/json" },
    status: code,
  });
});
