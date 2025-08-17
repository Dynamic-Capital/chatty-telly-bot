import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../../_shared/client.ts";
import { verifyFromRaw } from "../../verify-initdata/index.ts";
import { envOrSetting } from "../../_shared/config.ts";
import { json, mna, oops, bad } from "../../_shared/http.ts";
import { version } from "../../_shared/version.ts";

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

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return withCors(json({}, 204));
  }
  const v = version(req, "auth-telegram-init");
  if (v) return withCors(v);
  if (req.method !== "POST") return mna();

  try {
    const { initData, ttl } = await req.json().catch(() => ({ initData: "" }));
    if (!initData) {
      return withCors(bad("initData required"));
    }

    const valid = await verifyFromRaw(initData);
    if (!valid) {
      return withCors(json({ error: "invalid init data" }, 401));
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
      return withCors(bad("user.id required"));
    }

    const client = createClient();
    const { data: profile, error } = await client
      .from("profiles")
      .upsert({ telegram_id: telegramId }, { onConflict: "telegram_id" })
      .select()
      .single();
    if (error || !profile) {
      console.error("profile upsert error", error);
      return withCors(oops("profile upsert failed"));
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

    return withCors(json({ access_token, profile }, 200, {
      "cache-control": "no-store",
    }));
  } catch (err) {
    console.error("telegram-init error", err);
    return withCors(oops(String(err)));
  }
}

if (import.meta.main) serve(handler);
