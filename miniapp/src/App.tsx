import React from 'react';

/* >>> DC BLOCK: app-theme-ui (start) */
import { useEffect, useState } from 'react';
import { initTelegramThemeHandlers, setMode as applyMode } from './theme';
import { verify, getTheme, saveTheme } from './api';
type Mode = 'auto'|'light'|'dark';

export function ThemeSection() {
  const [mode, setMode] = useState<Mode>('auto');
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    (window as any).Telegram?.WebApp?.ready?.();
    (window as any).Telegram?.WebApp?.expand?.();
    initTelegramThemeHandlers();
    (async () => {
      try {
        const vr = await verify();
        setToken(vr.session_token);
        const t = await getTheme(vr.session_token);
        setMode(t.mode); applyMode(t.mode);
      } catch { /* ignore */ }
    })();
  }, []);

  async function choose(next: Mode) {
    setMode(next); applyMode(next);
    if (token) await saveTheme(token, next);
  }

  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-card text-foreground">
      <div className="text-sm opacity-80">Theme</div>
      <div className="flex gap-2">
        {(['auto','light','dark'] as Mode[]).map(m => (
          <button key={m} onClick={() => choose(m)}
            className={`px-3 py-2 rounded-lg border border-border ${m===mode ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
            {m.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
/* <<< DC BLOCK: app-theme-ui (end) */

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <ThemeSection />
    </div>
  );
}
