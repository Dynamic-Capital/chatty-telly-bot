import React, { useEffect, useState } from "react";
import { initTelegramThemeHandlers } from "./theme";
import { verify } from "./api";

const MINI_APP_URL = (
  import.meta.env.VITE_MINI_APP_URL || window.location.origin + "/"
).replace(/\/+$/, "/");

type Auth = {
  token: string;
  uid: number;
  username?: string;
  is_vip?: boolean;
  subscription_expires_at?: string;
};

function VipActive() {
  return (
    <section className="space-y-4">
      <div className="p-4 border border-border rounded-lg bg-card">
        <div className="font-medium">Continue where you left off</div>
        <div className="text-sm opacity-80">No recent activity</div>
      </div>
      <div className="flex flex-col gap-3">
        <button type="button" className="py-3 rounded-lg bg-primary text-primary-foreground">
          View Signals
        </button>
        <button type="button" className="py-3 rounded-lg bg-primary text-primary-foreground">
          Education Library
        </button>
      </div>
      <div className="p-4 border border-border rounded-lg bg-card">
        <div className="font-medium">Announcements</div>
        <div className="text-sm opacity-80">No announcements</div>
      </div>
    </section>
  );
}

function VipInactive() {
  return (
    <section className="space-y-4" id="plans">
      <ul className="list-disc pl-5 text-sm space-y-1">
        <li>Access premium signals</li>
        <li>Unlock education library</li>
        <li>Priority support</li>
      </ul>
      <div className="p-4 border border-border rounded-lg bg-card space-y-2">
        <div className="font-medium">VIP Plan - $49/mo</div>
        <div className="text-sm opacity-80">Full access for 30 days</div>
        <button type="button" className="w-full py-3 rounded-lg bg-primary text-primary-foreground">
          Start now
        </button>
      </div>
      <div className="text-xs text-center">
        7-day refund guarantee.
        <button type="button" className="underline ml-1">Chat with Support</button>
      </div>
    </section>
  );
}

function Footer() {
  const [version, setVersion] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/miniapp/version");
        if (r.ok) setVersion((await r.text()).trim());
      } catch {
        /* ignore */
      }
    })();
  }, []);
  return (
    <footer className="text-xs text-center opacity-70 space-y-1">
      <div>
        <a className="underline" href={`${MINI_APP_URL}terms/`}>
          Terms
        </a>{" "}
        •
        <a className="underline ml-1" href={`${MINI_APP_URL}privacy/`}>
          Privacy
        </a>
      </div>
      <div>
        {version ? `v${version}` : "v0.0.0"} • Theme: auto
      </div>
    </footer>
  );
}

function SharedSections() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <div className="font-medium">Education Spotlight</div>
        <div className="text-sm opacity-80">No featured lessons yet.</div>
      </div>
      <div className="space-y-2">
        <div className="font-medium">Progress</div>
        <div className="text-sm opacity-80">0% completed</div>
      </div>
      <div className="space-y-2">
        <div className="font-medium">Payments</div>
        <div className="text-sm opacity-80">No pending payments</div>
      </div>
      <div className="space-y-2">
        <div className="font-medium">FAQ / Help</div>
        <button type="button" className="underline text-sm">
          Need help? We'll respond in minutes.
        </button>
      </div>
      <Footer />
    </section>
  );
}

export default function App() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
    initTelegramThemeHandlers();
    (async () => {
      try {
        const vr = await verify();
        setAuth({
          token: vr.session_token,
          uid: vr.user_id,
          username: vr.username,
          is_vip: vr.is_vip,
          subscription_expires_at: vr.subscription_expires_at,
        });
      } catch {
        setError(true);
      }
    })();
  }, []);

  if (error)
    return (
      <div className="p-4 space-y-4">
        <div>Verification failed</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground"
        >
          Reload
        </button>
      </div>
    );
  if (!auth) return <div className="p-4">Loading...</div>;

  const firstName = window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name;
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome";

  const vipBadge =
    auth.is_vip === undefined
      ? "VIP status unknown"
      : auth.is_vip
      ? `Active VIP • renews ${
          auth.subscription_expires_at
            ? new Date(auth.subscription_expires_at).toLocaleDateString()
            : ""
        }`
      : "VIP inactive • unlock signals & lessons";

  function handlePrimaryCTA() {
    if (auth.is_vip) {
      window.location.href = `${MINI_APP_URL}dashboard/`;
    } else {
      document
        .getElementById("plans")
        ?.scrollIntoView({ behavior: "smooth" });
    }
  }

  function openSection(path: string) {
    window.location.href = `${MINI_APP_URL}${path}`;
  }

  return (
    <div className="min-h-screen space-y-6 p-4 bg-background text-foreground">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">{greeting}</h1>
        <div className="text-sm opacity-80">{vipBadge}</div>
        <button
          type="button"
          onClick={handlePrimaryCTA}
          className="w-full mt-3 py-3 rounded-lg bg-primary text-primary-foreground"
        >
          {auth.is_vip ? "Open Dashboard" : "Join VIP"}
        </button>
        <div className="flex justify-center gap-2 mt-4 text-sm">
          <button
            type="button"
            onClick={() => openSection("signals/")}
            className="px-3 py-1 rounded-full border"
          >
            Signals
          </button>
          <button
            type="button"
            onClick={() => openSection("education/")}
            className="px-3 py-1 rounded-full border"
          >
            Education
          </button>
          <button
            type="button"
            onClick={() => openSection("support/")}
            className="px-3 py-1 rounded-full border"
          >
            Support
          </button>
        </div>
      </header>
      {auth.is_vip ? <VipActive /> : <VipInactive />}
      <SharedSections />
    </div>
  );
}

