import { useEffect, useMemo } from 'react';
export function useTelegram() {
  const tg = (window as any).Telegram?.WebApp;
  useEffect(() => {
    try {
      tg?.ready?.();
      tg?.expand?.();
      const theme = tg?.colorScheme || 'light';
      document.documentElement.classList.toggle('dark', theme === 'dark');
    } catch {}
  }, []);
  return useMemo(() => ({
    initData: tg?.initData || '',
    initDataUnsafe: tg?.initDataUnsafe || {},
    user: tg?.initDataUnsafe?.user || null,
    haptic: (strength: 'light'|'medium'|'heavy' = 'light') => tg?.HapticFeedback?.impactOccurred?.(strength)
  }), [tg]);
}
