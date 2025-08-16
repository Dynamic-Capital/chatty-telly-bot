export type MenuSection = "home" | "plans" | "status" | "support";

export function buildMainMenu(section: MenuSection) {
  const mk = (sect: MenuSection, label: string) => [{
    text: `${sect === section ? "✅ " : ""}${label}`,
    callback_data: `menu:${sect}`,
  }];
  return {
    inline_keyboard: [
      mk("home", "Home"),
      mk("plans", "Packages"),
      mk("status", "Status"),
      mk("support", "Support"),
    ],
  };
}
