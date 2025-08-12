import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { maybe, need } from "./env.ts";
import { oops, unauth } from "./http.ts";

export async function readDbWebhookSecret(): Promise<string | null> {
  try {
    const supa = createClient(
      need("SUPABASE_URL"),
      need("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data } = await supa.from("bot_settings")
      .select("setting_value").eq("setting_key", "TELEGRAM_WEBHOOK_SECRET")
      .limit(1).maybeSingle();
    return (data?.setting_value as string) || null;
  } catch {
    return null;
  }
}
export async function expectedSecret(): Promise<string | null> {
  return (await readDbWebhookSecret()) || maybe("TELEGRAM_WEBHOOK_SECRET");
}
export async function validateTelegramHeader(
  req: Request,
): Promise<Response | null> {
  const got = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ||
    req.headers.get("x-telegram-bot-api-secret-token") || "";
  const exp = await expectedSecret();
  if (!exp) return unauth("Webhook secret missing");
  if (got !== exp) return unauth("Secret mismatch");
  return null;
}
