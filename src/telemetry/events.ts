import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { handleEvent } from "./alerts.ts";

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

/**
 * Best-effort telemetry event tracking. Attempts to insert into the optional
 * `bot_events` table; falls back to console logging if unavailable.
 */
export async function trackEvent(
  type: string,
  meta: Record<string, unknown> = {},
  userId?: string | number,
): Promise<void> {
  const payload = { ts: new Date().toISOString(), type, user_id: userId, meta };
  try {
    const sb = getClient();
    if (sb) {
      const { error } = await sb.from("bot_events").insert(payload);
      if (error) throw error;
    } else {
      throw new Error("no-supabase");
    }
  } catch (err) {
    console.log("trackEvent fallback", { payload, err: (err as Error).message });
  }
  // Pass the event to the alerting subsystem (fire and forget)
  try {
    handleEvent(type, meta);
  } catch (err) {
    console.error("handleEvent error", err);
  }
}

/**
 * Wrap a handler to automatically track start, success, error and latency.
 */
export function wrapHandler<Args extends unknown[], Ret>(
  name: string,
  handler: (...args: Args) => Promise<Ret>,
  getUserId?: (...args: Args) => string | number | undefined,
): (...args: Args) => Promise<Ret> {
  return async (...args: Args): Promise<Ret> => {
    const userId = getUserId?.(...args);
    const start = Date.now();
    await trackEvent(`${name}_start`, {}, userId);
    try {
      const result = await handler(...args);
      const latency = Date.now() - start;
      await trackEvent(`${name}_success`, { latency_ms: latency }, userId);
      return result;
    } catch (err) {
      const latency = Date.now() - start;
      const stack = err instanceof Error && err.stack
        ? err.stack.split("\n").slice(0, 5).join("\n")
        : undefined;
      await trackEvent("error", { handler: name, message: String(err), stack }, userId);
      await trackEvent(
        `${name}_error`,
        { message: String(err), stack, latency_ms: latency },
        userId,
      );
      throw err;
    }
  };
}
