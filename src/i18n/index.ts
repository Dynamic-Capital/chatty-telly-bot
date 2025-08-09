// Minimal Supabase client type to avoid heavy imports during tests
export type SupabaseClient = {
  from: (table: string) => {
    update: (data: Record<string, unknown>) => {
      eq: (
        column: string,
        value: unknown,
      ) => Promise<{ error: { message: string } | null }>; // simplified
    };
  };
};
import { getTemplate } from "../templates/lib.ts";
import { BUILTIN_TEMPLATES } from "../templates/lib.ts";

const userLang = new Map<string, string>();

export function t(
  key: string,
  lang = "en",
  vars: Record<string, string | number> = {},
): string {
  let template = getTemplate(lang, key);
  if (template === undefined && lang !== "en") {
    template = getTemplate("en", key);
  }
  if (template === undefined) {
    template = BUILTIN_TEMPLATES.en[key];
  }
  if (template === undefined) return key;
  return template.replace(/\{(\w+)\}/g, (_m, v) =>
    v in vars ? String(vars[v]) : ""
  );
}

export async function setLang(
  userId: string | number,
  lang: string,
  client?: SupabaseClient,
): Promise<void> {
  userLang.set(String(userId), lang);
  if (client) {
    try {
      const { error } = await client.from("bot_users").update({ language: lang })
        .eq("id", userId);
      if (error && !error.message.includes("42P01")) {
        console.error("setLang error", error);
      }
    } catch (err) {
      console.error("setLang db error", err);
    }
  }
}

export function getLang(userId: string | number): string | undefined {
  return userLang.get(String(userId));
}
