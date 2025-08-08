import { useEffect } from 'react';

interface TelegramWebApp {
  themeParams?: Record<string, string>;
  ready: () => void;
  MainButton: {
    setText: (text: string) => void;
    enable: () => void;
    disable: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    show: () => void;
  };
}

function getWebApp(): TelegramWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

export function useTelegram() {
  useEffect(() => {
    const webApp = getWebApp();
    if (!webApp) return;
    const root = document.documentElement;
    const params = webApp.themeParams || {};
    Object.entries(params).forEach(([k, v]) => {
      root.style.setProperty(`--tg-${k}`, String(v));
    });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.style.setProperty('--dc-motion', 'none');
    }
    webApp.ready();
  }, []);
}

export function useTelegramMainButton(
  enabled: boolean,
  text: string,
  onClick: () => void,
) {
  useEffect(() => {
    const webApp = getWebApp();
    if (!webApp) return;
    const btn = webApp.MainButton;
    btn.setText(text);
    if (enabled) btn.enable(); else btn.disable();
    btn.onClick(onClick);
    btn.show();
    return () => btn.offClick(onClick);
  }, [enabled, text, onClick]);
}
