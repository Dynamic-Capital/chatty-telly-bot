import type { SupabaseClient } from "@supabase/supabase-js";

// In-memory fallback map when kv_config table is unavailable
const memStore = new Map<string, unknown>();

let supabase: SupabaseClient | null | undefined = undefined;
async function getClient(): Promise<SupabaseClient | null> {
  if (supabase !== undefined) return supabase;
  const url =
    (typeof Deno !== "undefined"
      ? Deno.env.get("SUPABASE_URL")
      : process.env.SUPABASE_URL) || "";
  const key =
    (typeof Deno !== "undefined"
      ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      : process.env.SUPABASE_SERVICE_ROLE_KEY) || "";
  if (!url || !key) {
    supabase = null;
    return null;
  }
  const mod = await import(
    typeof Deno !== "undefined"
      ? "npm:@supabase/supabase-js@2"
      : "@supabase/supabase-js"
  );
  supabase = mod.createClient(url, key, { auth: { persistSession: false } });
  return supabase ?? null;
}

async function getConfig<T = unknown>(key: string, def?: T): Promise<T> {
  const client = await getClient();
  if (client) {
    try {
      const { data, error } = await client.from("kv_config").select("value").eq(
        "key",
        key,
      ).maybeSingle();
      if (!error && data && typeof data.value !== "undefined") {
        return data.value;
      }
    } catch (_e) {
      // fall back to memory store
    }
  }
  return (memStore.has(key) ? memStore.get(key) : def) as T;
}

async function setConfig(key: string, val: unknown): Promise<void> {
  const client = await getClient();
  if (client) {
    try {
      const { error } = await client.from("kv_config").upsert({
        key,
        value: val,
      });
      if (!error) {
        memStore.set(key, val);
        return;
      }
    } catch (_e) {
      // ignore and fall back
    }
  }
  memStore.set(key, val);
}

async function getFlag(name: string, def = false): Promise<boolean> {
  const snap = await getConfig<{ data: Record<string, boolean> }>(
    "features:published",
    { data: {} },
  );
  return snap.data[name] ?? def;
}

async function setFlag(name: string, val: boolean): Promise<void> {
  const snap = await getConfig<{ ts: number; data: Record<string, boolean> }>(
    "features:draft",
    { ts: Date.now(), data: {} },
  );
  snap.data[name] = val;
  snap.ts = Date.now();
  await setConfig("features:draft", snap);
}

async function snapshot(
  _area: "FEATURES",
): Promise<{ ts: number; data: Record<string, boolean> }> {
  const snap = await getConfig<{ ts: number; data: Record<string, boolean> }>(
    "features:draft",
    { ts: Date.now(), data: {} },
  );
  return { ts: Date.now(), data: { ...snap.data } };
}

async function pushSnapshot(
  label: "DRAFT" | "PUBLISHED" | "ROLLBACK",
): Promise<void> {
  const snap = await snapshot("FEATURES");
  await setConfig(`features:${label.toLowerCase()}`, snap);
}

async function publish(adminId?: string): Promise<void> {
  const draft = await getConfig<{ ts: number; data: Record<string, boolean> }>(
    "features:draft",
    { ts: Date.now(), data: {} },
  );
  const current = await getConfig<
    { ts: number; data: Record<string, boolean> }
  >(
    "features:published",
    { ts: Date.now(), data: {} },
  );
  // clone snapshots to avoid shared references between draft, published and rollback
  await setConfig("features:rollback", {
    ts: current.ts,
    data: { ...current.data },
  });
  await setConfig("features:published", {
    ts: draft.ts,
    data: { ...draft.data },
  });
  console.log("publish", { from: current, to: draft });
  const client = await getClient();
  if (client) {
    try {
      await client.from("audit_log").insert({
        admin_id: adminId ?? null,
        action: "publish",
        from: current,
        to: draft,
        ts: new Date().toISOString(),
      });
    } catch (_e) {
      // ignore if table missing
    }
  }
}

async function rollback(adminId?: string): Promise<void> {
  const published = await getConfig<
    { ts: number; data: Record<string, boolean> }
  >(
    "features:published",
    { ts: Date.now(), data: {} },
  );
  const previous = await getConfig<
    { ts: number; data: Record<string, boolean> }
  >(
    "features:rollback",
    { ts: Date.now(), data: {} },
  );
  await setConfig("features:published", {
    ts: previous.ts,
    data: { ...previous.data },
  });
  await setConfig("features:rollback", {
    ts: published.ts,
    data: { ...published.data },
  });
  console.log("rollback", { from: published, to: previous });
  const client = await getClient();
  if (client) {
    try {
      await client.from("audit_log").insert({
        admin_id: adminId ?? null,
        action: "rollback",
        from: published,
        to: previous,
        ts: new Date().toISOString(),
      });
    } catch (_e) {
      // ignore if table missing
    }
  }
}

async function preview(): Promise<
  { ts: number; data: Record<string, boolean> }
> {
  return await getConfig<{ ts: number; data: Record<string, boolean> }>(
    "features:draft",
    { ts: Date.now(), data: {} },
  );
}

export {
  getConfig,
  getFlag,
  preview,
  publish,
  pushSnapshot,
  rollback,
  setConfig,
  setFlag,
  snapshot,
};
