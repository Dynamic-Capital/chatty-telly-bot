export type MenuSection = "dashboard" | "plans" | "support";

import { InlineKeyboard } from "https://deno.land/x/grammy@v1.19.1/mod.ts";
import type { InlineKeyboardMarkup } from "https://deno.land/x/grammy@v1.19.1/types.ts";
import { getContent } from "../_shared/config.ts";

export async function buildMainMenu(
  section: MenuSection,
): Promise<InlineKeyboardMarkup> {
  const [
    dashboard,
    plans,
    support,
    packages,
    promo,
    account,
    faq,
    education,
    ask,
    shouldibuy,
  ] = await Promise.all([
    getContent("menu_dashboard_label"),
    getContent("menu_plans_label"),
    getContent("menu_support_label"),
    getContent("menu_packages_label"),
    getContent("menu_promo_label"),
    getContent("menu_account_label"),
    getContent("menu_faq_label"),
    getContent("menu_education_label"),
    getContent("menu_ask_label"),
    getContent("menu_shouldibuy_label"),
  ]);

  const kb = new InlineKeyboard()
    .text(
      `${section === "dashboard" ? "✅ " : ""}${dashboard ?? "📊 Dashboard"}`,
      "nav:dashboard",
    )
    .text(
      `${section === "plans" ? "✅ " : ""}${plans ?? "💳 Plans"}`,
      "nav:plans",
    )
    .text(
      `${section === "support" ? "✅ " : ""}${support ?? "💬 Support"}`,
      "nav:support",
    )
    .row()
    .text(packages ?? "📦 Packages", "cmd:packages")
    .text(promo ?? "🎁 Promo", "cmd:promo")
    .text(account ?? "👤 Account", "cmd:account")
    .row()
    .text(faq ?? "❓ FAQ", "cmd:faq")
    .text(education ?? "📚 Education", "cmd:education")
    .row()
    .text(ask ?? "🤖 Ask", "cmd:ask")
    .text(shouldibuy ?? "💡 Should I Buy?", "cmd:shouldibuy");

  return kb;
}
