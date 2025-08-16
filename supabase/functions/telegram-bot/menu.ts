export type MenuSection = "dashboard" | "plans" | "support";

export function buildMainMenu(section: MenuSection) {
  return {
    inline_keyboard: [[
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
    ]],
  };
}
