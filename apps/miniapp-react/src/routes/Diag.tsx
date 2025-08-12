import { useEffect, useState } from "react";
import { useTelegram } from "@/shared/useTelegram";
import { functionUrl } from "@/lib/edge";

export default function Diag() {
  const { initData, user } = useTelegram();
  const [out, setOut] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const url = functionUrl("miniapp-smoke");
      const r = await fetch(url!, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initData,
          telegram_id: user?.id ? String(user.id) : undefined,
        }),
      });
      const j = await r.json();
      setOut(j);
    } catch (e) {
      setOut({ ok: false, error: String(e) });
    }
    setLoading(false);
  }

  useEffect(() => {
    run();
  }, [initData, user?.id]);

  return (
    <section className="rounded-2xl shadow p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur space-y-3">
      <h2 className="text-xl font-semibold">Diagnostics</h2>
      <div className="text-sm opacity-80">
        Checks reachability, initData verification, and VIP status.
      </div>
      <button
        type="button"
        onClick={run}
        className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm shadow hover:bg-blue-700 disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Running…" : "Re-run checks"}
      </button>
      <pre className="text-xs bg-black/70 text-emerald-100 p-3 rounded-xl overflow-auto max-h-96">
        {out ? JSON.stringify(out, null, 2) : "…"}
      </pre>
    </section>
  );
}
