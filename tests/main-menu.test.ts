import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { buildMainMenu } from "../supabase/functions/telegram-bot/menu.ts";

Deno.test("buildMainMenu highlights active section", () => {
  const dash = buildMainMenu("dashboard");
  assertEquals(dash.inline_keyboard[0][0].text, "✅ 📊 Dashboard");
  assertEquals(dash.inline_keyboard[0][1].text, "💳 Plans");

  const plans = buildMainMenu("plans");
  assertEquals(plans.inline_keyboard[0][0].text, "📊 Dashboard");
  assertEquals(plans.inline_keyboard[0][1].text, "✅ 💳 Plans");
});
