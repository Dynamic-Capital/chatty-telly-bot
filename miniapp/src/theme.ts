/* >>> DC BLOCK: theme-sync (start) */
export type ThemeMode = 'auto'|'light'|'dark';
declare global { interface Window { Telegram: any } }

const root = document.documentElement;
let current: ThemeMode = 'auto';

function apply(mode: ThemeMode) {
  const wp = window.Telegram?.WebApp;
  const dark = mode === 'dark' || (mode === 'auto' && wp?.colorScheme === 'dark');
  root.classList.toggle('dark', !!dark);
}

export function setMode(m: ThemeMode) { current = m; apply(current); }
export function getMode(): ThemeMode { return current; }
export function initTelegramThemeHandlers() {
  const wp = window.Telegram?.WebApp;
  if (!wp) return;
  wp.onEvent?.('themeChanged', () => apply(current));
  apply(current);
}
/* <<< DC BLOCK: theme-sync (end) */
