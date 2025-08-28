import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

Deno.env.set("SUPABASE_URL", "http://localhost");
Deno.env.set("SUPABASE_ANON_KEY", "anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");

const { buildMainMenu } = await import(
  "../supabase/functions/telegram-bot/menu.ts"
);
const cfg = await import("../supabase/functions/_shared/config.ts");

Deno.test("buildMainMenu highlights active section", async () => {
  const original = cfg.getContent;
  cfg.__setGetContent(
    async <T>(key: string): Promise<T | null> => {
      const map: Record<string, string | undefined> = {
        menu_dashboard_label: "📊 Dashboard",
        menu_plans_label: "💳 Plans",
        menu_support_label: "💬 Support",
        menu_packages_label: "📦 Packages",
        menu_promo_label: "🎁 Promo",
        menu_account_label: "👤 Account",
        menu_faq_label: "❓ FAQ",
        menu_education_label: "📚 Education",
        menu_ask_label: "🤖 Ask",
        menu_shouldibuy_label: "💡 Should I Buy?",
      };
      return (map[key] ?? null) as T | null;
    },
  );

  const dash = await buildMainMenu("dashboard");
  assertEquals(dash.inline_keyboard[0][0].text, "✅ 📊 Dashboard");
  assertEquals(dash.inline_keyboard[0][1].text, "💳 Plans");

  const plans = await buildMainMenu("plans");
  assertEquals(plans.inline_keyboard[0][0].text, "📊 Dashboard");
  assertEquals(plans.inline_keyboard[0][1].text, "✅ 💳 Plans");

  cfg.__setGetContent(original);
});
