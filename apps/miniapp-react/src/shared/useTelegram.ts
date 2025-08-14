import { useEffect, useMemo } from 'react';

interface TelegramWebApp {
  ready?: () => void;
  expand?: () => void;
  colorScheme?: string;
  initData?: string;
  initDataUnsafe?: Record<string, unknown>;
  HapticFeedback?: { impactOccurred?: (strength: string) => void };
}

export function useTelegram() {
  const tg = (window as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
  useEffect(() => {
    try {
      tg?.ready?.();
      tg?.expand?.();
      const theme = tg?.colorScheme || 'light';
      document.documentElement.classList.toggle('dark', theme === 'dark');
    } catch {
      // ignore errors from Telegram initialization
    }
  }, [tg]);
  return useMemo(
    () => ({
      initData: tg?.initData || '',
      initDataUnsafe: tg?.initDataUnsafe || {},
      user: (tg?.initDataUnsafe as { user?: unknown } | undefined)?.user || null,
      haptic: (strength: 'light' | 'medium' | 'heavy' = 'light') =>
        tg?.HapticFeedback?.impactOccurred?.(strength),
    }),
    [tg],
  );
}
