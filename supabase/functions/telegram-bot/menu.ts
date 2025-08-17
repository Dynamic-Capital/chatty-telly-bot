export type MenuSection = "dashboard" | "plans" | "support";

export function buildMainMenu(section: MenuSection) {
  return {
    inline_keyboard: [
      [
        {
          text: `${section === "dashboard" ? "✅ " : ""}Dashboard`,
          callback_data: "nav:dashboard",
        },
        {
          text: `${section === "plans" ? "✅ " : ""}Plans`,
          callback_data: "nav:plans",
        },
        {
          text: `${section === "support" ? "✅ " : ""}Support`,
          callback_data: "nav:support",
        },
      ],
      [
        { text: "Packages", callback_data: "cmd:packages" },
        { text: "Promo", callback_data: "cmd:promo" },
        { text: "Account", callback_data: "cmd:account" },
      ],
      [
        { text: "FAQ", callback_data: "cmd:faq" },
        { text: "Education", callback_data: "cmd:education" },
      ],
      [
        { text: "Ask", callback_data: "cmd:ask" },
        { text: "Should I Buy?", callback_data: "cmd:shouldibuy" },
      ],
    ],
  };
}
