export type MenuSection = "dashboard" | "plans" | "support";

import { getContent } from "../_shared/config.ts";

export async function buildMainMenu(section: MenuSection) {
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
  return {
    inline_keyboard: [
      [
        {
          text: `${section === "dashboard" ? "✅ " : ""}${
            dashboard ?? "📊 Dashboard"
          }`,
          callback_data: "nav:dashboard",
        },
        {
          text: `${section === "plans" ? "✅ " : ""}${plans ?? "💳 Plans"}`,
          callback_data: "nav:plans",
        },
        {
          text: `${section === "support" ? "✅ " : ""}${
            support ?? "💬 Support"
          }`,
          callback_data: "nav:support",
        },
      ],
      [
        { text: packages ?? "📦 Packages", callback_data: "cmd:packages" },
        { text: promo ?? "🎁 Promo", callback_data: "cmd:promo" },
        { text: account ?? "👤 Account", callback_data: "cmd:account" },
      ],
      [
        { text: faq ?? "❓ FAQ", callback_data: "cmd:faq" },
        { text: education ?? "📚 Education", callback_data: "cmd:education" },
      ],
      [
        { text: ask ?? "🤖 Ask", callback_data: "cmd:ask" },
        {
          text: shouldibuy ?? "💡 Should I Buy?",
          callback_data: "cmd:shouldibuy",
        },
      ],
    ],
  };
}
