import React, { useEffect, useState } from "react";
import { initTelegramThemeHandlers, setMode as applyMode } from "./theme";
import { getTheme, saveTheme, verify, validatePromo, redeemPromo, getReferralLink } from "./api";
type Mode = "auto" | "light" | "dark";

function ThemeSection({ token }: { token: string }) {
  const [mode, setMode] = useState<Mode>("auto");
  useEffect(() => {
    initTelegramThemeHandlers();
    (async () => {
      try {
        const t = await getTheme(token);
        setMode(t.mode);
        applyMode(t.mode);
      } catch {
        /* ignore */
      }
    })();
  }, [token]);
  async function choose(next: Mode) {
    setMode(next);
    applyMode(next);
    await saveTheme(token, next);
  }
  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-card text-foreground">
      <div className="text-sm opacity-80">Theme</div>
      <div className="flex gap-2">
        {(["auto", "light", "dark"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => choose(m)}
            className={`px-3 py-2 rounded-lg border border-border ${
              m === mode ? "bg-primary text-primary-foreground" : "bg-background"
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

function PromoSection({ token, uid }: { token: string; uid: number }) {
  const [code, setCode] = useState("");
  const [plan, setPlan] = useState("");
  const [final, setFinal] = useState<number | null>(null);
  async function apply() {
    const r = await validatePromo(token, code, uid, plan);
    if (r.ok) setFinal(r.final_amount);
  }
  async function redeem() {
    await redeemPromo(token, code, uid, plan, "demo-pay");
  }
  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-card text-foreground">
      <div className="text-sm opacity-80">Promo Code</div>
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="code" className="w-full px-2 py-1 border rounded" />
      <input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="plan id" className="w-full px-2 py-1 border rounded" />
      <button onClick={apply} className="px-3 py-2 border rounded">Apply</button>
      {final !== null && <div className="text-sm">Final: {final}</div>}
      <button onClick={redeem} className="px-3 py-2 border rounded">Redeem</button>
    </div>
  );
}

function ReferralSection({ token, uid }: { token: string; uid: number }) {
  const [link, setLink] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const r = await getReferralLink(token, uid);
        setLink(r.link);
      } catch {
        /* ignore */
      }
    })();
  }, [token, uid]);
  return (
    <div className="space-y-1 p-4 border border-border rounded-lg bg-card text-foreground">
      <div className="text-sm opacity-80">Referral Link</div>
      <div className="break-all text-xs">{link}</div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState<{ token: string; uid: number } | null>(null);
  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
    (async () => {
      try {
        const vr = await verify();
        setAuth({ token: vr.session_token, uid: vr.user_id });
      } catch {
        /* ignore */
      }
    })();
  }, []);
  if (!auth) return <div className="p-4">Loading...</div>;
  return (
    <div className="min-h-screen space-y-4 p-4 bg-background text-foreground">
      <ThemeSection token={auth.token} />
      <PromoSection token={auth.token} uid={auth.uid} />
      <ReferralSection token={auth.token} uid={auth.uid} />
    </div>
  );
}
