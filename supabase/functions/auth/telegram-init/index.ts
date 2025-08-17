import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../../_shared/client.ts";
import { verifyFromRaw } from "../../verify-initdata/index.ts";
import { envOrSetting } from "../../_shared/config.ts";

const mini = await envOrSetting("MINI_APP_URL");
const corsHeaders = {
  "Access-Control-Allow-Origin": mini ? new URL(mini).origin : "",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function withCors(res: Response) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  try {
    const { initData, ttl } = await req.json().catch(() => ({ initData: "" }));
    if (!initData) {
      return withCors(
        new Response(JSON.stringify({ error: "initData required" }), {
          status: 400,
        }),
      );
    }

    const valid = await verifyFromRaw(initData);
    if (!valid) {
      return withCors(
        new Response(JSON.stringify({ error: "invalid init data" }), {
          status: 401,
        }),
      );
    }

    const params = new URLSearchParams(initData);
    let user: unknown = {};
    try {
      user = JSON.parse(params.get("user") || "{}");
    } catch {
      user = {};
    }
    const telegramId = Number((user as { id?: number }).id || 0);
    if (!telegramId) {
      return withCors(
        new Response(JSON.stringify({ error: "user.id required" }), {
          status: 400,
        }),
      );
    }

    const client = createClient();
    const { data: profile, error } = await client
      .from("profiles")
      .upsert({ telegram_id: telegramId }, { onConflict: "telegram_id" })
      .select()
      .single();
    if (error || !profile) {
      console.error("profile upsert error", error);
      return withCors(
        new Response(JSON.stringify({ error: "profile upsert failed" }), {
          status: 500,
        }),
      );
    }

    const payload: Record<string, unknown> = { sub: profile.id };
    const opts: Record<string, unknown> = {};
    const ttlNum = Number(ttl);
    if (!isNaN(ttlNum) && ttlNum > 0) opts.expiresIn = ttlNum;
    const auth = client.auth as unknown as {
      signJWT: (
        p: Record<string, unknown>,
        o: Record<string, unknown>,
      ) => Promise<{ access_token?: string; token?: string; jwt?: string }>
    };
    const signed = await auth.signJWT(payload, opts);
    const access_token =
      signed.access_token || signed.token || signed.jwt || "";

    return withCors(
      new Response(JSON.stringify({ access_token, profile }), {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      }),
    );
  } catch (err) {
    console.error("telegram-init error", err);
    return withCors(
      new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
      }),
    );
  }
});
