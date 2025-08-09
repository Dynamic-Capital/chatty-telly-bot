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
  return (globalThis as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
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
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      root.style.setProperty('--dc-motion', 'none');
    }
    webApp.ready();

    // Verify Telegram initData with secure edge function
    try {
      const initData = (globalThis as unknown as { Telegram?: { WebApp?: { initData?: string } } })
        .Telegram?.WebApp?.initData;
      if (initData) {
        fetch('https://qeejuomcapbdlhnjqjcc.functions.supabase.co/verify-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        })
          .then(async (res) => {
            const json = await res.json().catch(() => null);
            return { ok: res.ok, json };
          })
          .then(({ ok, json }) => {
            if (ok && json?.ok) {
              (root as HTMLElement).dataset.tgVerified = 'true';
              console.log('[MiniApp] Telegram initData verified', json.user);
            } else {
              (root as HTMLElement).dataset.tgVerified = 'false';
              console.warn('[MiniApp] Telegram initData verification failed', json);
            }
          })
          .catch((err) => console.error('[MiniApp] verify-telegram error', err));
      }
    } catch (e) {
      console.warn('[MiniApp] Unable to verify Telegram initData', e);
    }
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
    if (enabled) btn.enable();
    else btn.disable();
    btn.onClick(onClick);
    btn.show();
    return () => btn.offClick(onClick);
  }, [enabled, text, onClick]);
}
