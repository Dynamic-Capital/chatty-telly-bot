import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { buildMainMenu } from "../supabase/functions/telegram-bot/menu.ts";
import * as cfg from "../supabase/functions/_shared/config.ts";

Deno.test("buildMainMenu highlights active section", async () => {
  const original = cfg.getContent;
  cfg.__setGetContent(async (key: string) => {
    const map: Record<string, string> = {
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
    return map[key] ?? null;
  });

  const dash = await buildMainMenu("dashboard");
  assertEquals(dash.inline_keyboard[0][0].text, "✅ 📊 Dashboard");
  assertEquals(dash.inline_keyboard[0][1].text, "💳 Plans");

  const plans = await buildMainMenu("plans");
  assertEquals(plans.inline_keyboard[0][0].text, "📊 Dashboard");
  assertEquals(plans.inline_keyboard[0][1].text, "✅ 💳 Plans");

  cfg.__setGetContent(original);
});
