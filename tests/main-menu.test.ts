import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { buildMainMenu } from "../supabase/functions/telegram-bot/menu.ts";

Deno.test("buildMainMenu highlights active section", () => {
  const home = buildMainMenu("home");
  assertEquals(home.inline_keyboard[0][0].text, "✅ Home");
  assertEquals(home.inline_keyboard[1][0].text, "Packages");

  const plans = buildMainMenu("plans");
  assertEquals(plans.inline_keyboard[0][0].text, "Home");
  assertEquals(plans.inline_keyboard[1][0].text, "✅ Packages");
});
