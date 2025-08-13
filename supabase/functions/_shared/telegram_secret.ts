import { maybe, need } from "./env.ts";
import { unauth } from "./http.ts";

interface SupabaseLike {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (key: string, value: string) => {
        limit: (n: number) => { maybeSingle: () => Promise<{ data?: { setting_value?: unknown } }> };
      };
    };
  };
}

export async function readDbWebhookSecret(
  supa?: SupabaseLike,
): Promise<string | null> {
  try {
    if (supa) {
      const { data } = await supa.from("bot_settings")
        .select("setting_value")
        .eq("setting_key", "TELEGRAM_WEBHOOK_SECRET")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      return (data?.setting_value as string) || null;
    }
    const url = need("SUPABASE_URL");
    const key = need("SUPABASE_SERVICE_ROLE_KEY");
    const resp = await fetch(
      `${url}/rest/v1/bot_settings?select=setting_value&setting_key=eq.TELEGRAM_WEBHOOK_SECRET&is_active=eq.true&limit=1`,
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
export async function expectedSecret(
  supa?: SupabaseLike,
): Promise<string | null> {
  return (await readDbWebhookSecret(supa)) || maybe("TELEGRAM_WEBHOOK_SECRET");
}
export async function validateTelegramHeader(
  req: Request,
): Promise<Response | null> {
  const url = new URL(req.url);
  if (
    req.method === "GET" &&
    (url.pathname.endsWith("/version") || url.pathname.endsWith("/echo"))
  ) {
    return null;
  }
  const exp = await expectedSecret();
  if (!exp) return unauth("missing secret");
  const got = req.headers.get("x-telegram-bot-api-secret-token");
  if (!got || got !== exp) return unauth("bad secret");
  return null;
}
