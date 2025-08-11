// >>> DC BLOCK: theme-get-core (start)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { optionalEnv, requireEnv } from "../_shared/env.ts";

function parseToken(bearer: string | undefined) {
  if (!bearer?.startsWith("Bearer ")) return 0;
  const raw = atob(bearer.slice(7).split(".")[0] || "");
  try {
    return JSON.parse(raw).sub || 0;
  } catch {
    return 0;
  }
}

serve(async (req) => {
  const uid = parseToken(req.headers.get("authorization") || "");
  if (!uid) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
    });
  }
  // Try bot_settings(setting_key=`theme:${uid}`)
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = requireEnv(
      [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
      ] as const,
    );
    const key = optionalEnv("SUPABASE_SERVICE_ROLE_KEY") || SUPABASE_ANON_KEY;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bot_settings?select=setting_value&setting_key=eq.theme:${uid}`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      },
    );
    if (res.ok) {
      const rows = await res.json();
      const mode = (rows?.[0]?.setting_value || "auto") as
        | "auto"
        | "light"
        | "dark";
      return new Response(JSON.stringify({ mode }), {
        headers: { "content-type": "application/json" },
      });
    }
  } catch (_err) {
    // ignore errors and fall back to default mode
  }
  return new Response(JSON.stringify({ mode: "auto" }), {
    headers: { "content-type": "application/json" },
  });
});
// <<< DC BLOCK: theme-get-core (end)
