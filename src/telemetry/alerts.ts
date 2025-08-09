import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// ---- internal state ----
const errorBuckets = new Map<number, number>(); // minute -> count
const latencyTotals = new Map<number, number>(); // minute -> total ms
const latencyCounts = new Map<number, number>(); // minute -> count
const alertRateLimit = new Map<string, number>(); // type -> last sent ms
let lastWebhookError: number | null = null;

let errorThreshold = 10;
let errorWindowMinutes = 5;

export function setErrorThreshold(n: number, m: number) {
  errorThreshold = n;
  errorWindowMinutes = m;
}

// ---- helpers ----
function prune(map: Map<number, number>, maxMinutes: number) {
  const now = Math.floor(Date.now() / 60000);
  for (const key of map.keys()) {
    if (now - key > maxMinutes) map.delete(key);
  }
}

function sumRecent(map: Map<number, number>, minutes: number): number {
  const now = Math.floor(Date.now() / 60000);
  let total = 0;
  for (const [minute, count] of map) {
    if (now - minute < minutes) total += count;
  }
  return total;
}

function avgLatency(minutes: number): number {
  const now = Math.floor(Date.now() / 60000);
  let total = 0;
  let count = 0;
  for (const [minute, t] of latencyTotals) {
    if (now - minute < minutes) {
      total += t;
      count += latencyCounts.get(minute) || 0;
    }
  }
  return count ? total / count : 0;
}

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  const url = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : undefined;
  const key = typeof Deno !== "undefined"
    ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    : undefined;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

// alert sender can be overridden in tests
let alertSender: (msg: string) => Promise<void> | void = async (msg) => {
  const token = typeof Deno !== "undefined" ? Deno.env.get("TELEGRAM_BOT_TOKEN") : undefined;
  if (!token) {
    console.log("sendAdminAlert", msg);
    return;
  }
  try {
    const sb = getClient();
    const adminIds: number[] = [];
    if (sb) {
      const { data } = await sb.from("kv_config").select("value").eq("key", "admins").single();
      if (data?.value) {
        try {
          const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
          if (Array.isArray(parsed)) {
            adminIds.push(...parsed.map((v) => Number(v)).filter((v) => !isNaN(v)));
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    for (const id of adminIds) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id, text: msg }),
      });
    }
    if (sb) {
      await sb.from("alerts").insert({ ts: new Date().toISOString(), type: "alert", meta: { msg } });
    }
  } catch (err) {
    console.log("sendAdminAlert fallback", (err as Error).message);
  }
};

export function setAlertSender(fn: (msg: string) => Promise<void> | void) {
  alertSender = fn;
}

export async function sendAdminAlert(msg: string, type = "generic"): Promise<void> {
  const now = Date.now();
  const last = alertRateLimit.get(type) || 0;
  if (now - last < 10 * 60 * 1000) return;
  alertRateLimit.set(type, now);
  await alertSender(msg);
}

export function handleEvent(type: string, meta: Record<string, unknown>) {
  if (type === "error") {
    const bucket = Math.floor(Date.now() / 60000);
    errorBuckets.set(bucket, (errorBuckets.get(bucket) || 0) + 1);
    prune(errorBuckets, 60);
    if (sumRecent(errorBuckets, errorWindowMinutes) >= errorThreshold) {
      sendAdminAlert(`Error spike detected: >=${errorThreshold} errors in ${errorWindowMinutes}m`, "error_spike");
    }
  }
  if (typeof meta.latency_ms === "number") {
    const bucket = Math.floor(Date.now() / 60000);
    latencyTotals.set(bucket, (latencyTotals.get(bucket) || 0) + meta.latency_ms);
    latencyCounts.set(bucket, (latencyCounts.get(bucket) || 0) + 1);
    prune(latencyTotals, 60);
    prune(latencyCounts, 60);
  }
}

export function getStats() {
  return {
    errors5m: sumRecent(errorBuckets, 5),
    errors1h: sumRecent(errorBuckets, 60),
    avgLatency5m: avgLatency(5),
    lastWebhookError,
  };
}

export function resetCounters() {
  errorBuckets.clear();
  latencyTotals.clear();
  latencyCounts.clear();
  alertRateLimit.clear();
  lastWebhookError = null;
}

export async function checkWebhookHealth(): Promise<unknown> {
  const token = typeof Deno !== "undefined" ? Deno.env.get("TELEGRAM_BOT_TOKEN") : undefined;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const info = await res.json();
    const lastError = info?.result?.last_error_date;
    lastWebhookError = lastError ? lastError * 1000 : null;
    if (lastWebhookError && Date.now() - lastWebhookError < 10 * 60 * 1000) {
      await sendAdminAlert("Webhook failing…", "webhook");
    }
    return info;
  } catch (err) {
    console.error("checkWebhookHealth error", err);
    return null;
  }
}
