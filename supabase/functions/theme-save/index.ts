// >>> DC BLOCK: theme-save-core (start)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
  const { mode } = await req.json().catch(() => ({}));
  if (!["auto", "light", "dark"].includes(mode)) {
    return new Response(JSON.stringify({ ok: false, error: "bad mode" }), {
      status: 400,
    });
  }
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY")!;
    // upsert into bot_settings
    const body = [{
      setting_key: `theme:${uid}`,
      setting_value: mode,
      description: "miniapp theme",
      is_system: false,
    }];
    const r = await fetch(`${url}/rest/v1/bot_settings`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(body),
    });
    const ok = r.ok;
    return new Response(JSON.stringify({ ok }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
    });
  }
});
// <<< DC BLOCK: theme-save-core (end)
