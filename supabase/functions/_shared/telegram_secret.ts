import { maybe, need } from "./env.ts";
import { unauth } from "./http.ts";

export async function readDbWebhookSecret(supa?: any): Promise<string | null> {
  try {
    if (supa) {
      const { data } = await supa.from("bot_settings")
        .select("setting_value").eq("setting_key", "TELEGRAM_WEBHOOK_SECRET")
        .limit(1).maybeSingle();
      return (data?.setting_value as string) || null;
    }
    const url = need("SUPABASE_URL");
    const key = need("SUPABASE_SERVICE_ROLE_KEY");
    const resp = await fetch(
      `${url}/rest/v1/bot_settings?select=setting_value&setting_key=eq.TELEGRAM_WEBHOOK_SECRET&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      },
    );
    const data = await resp.json().catch(() => []);
    return (data?.[0]?.setting_value as string) || null;
  } catch {
    return null;
  }
}
export async function expectedSecret(supa?: any): Promise<string | null> {
  return (await readDbWebhookSecret(supa)) || maybe("TELEGRAM_WEBHOOK_SECRET");
}
export async function validateTelegramHeader(
  req: Request,
): Promise<Response | null> {
  const got = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ||
    req.headers.get("x-telegram-bot-api-secret-token") || "";
  const exp = await expectedSecret();
  if (!exp) return null;
  if (got !== exp) return unauth("Secret mismatch");
  return null;
}
