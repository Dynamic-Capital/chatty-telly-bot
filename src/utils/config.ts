import process from 'node:process';

// In-memory fallback map when kv_config table is unavailable
const memStore = new Map<string, unknown>();

let supabase: unknown = undefined;
async function getClient(): Promise<unknown | null> {
  if (supabase !== undefined) return supabase;
  const url =
    (typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') : process.env.SUPABASE_URL) || '';
  const key =
    (typeof Deno !== 'undefined'
      ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      : process.env.SUPABASE_SERVICE_ROLE_KEY) || '';
  if (!url || !key) {
    supabase = null;
    return null;
  }
  const mod = await import(
    typeof Deno !== 'undefined' ? 'npm:@supabase/supabase-js@2' : '@supabase/supabase-js'
  );
  supabase = mod.createClient(url, key, { auth: { persistSession: false } });
  return supabase;
}

async function getConfig(key: string, def?: unknown): Promise<unknown> {
  const client = await getClient();
  if (client) {
    try {
      const { data, error } = await client.from('kv_config').select('value').eq('key', key)
        .maybeSingle();
      if (!error && data && typeof data.value !== 'undefined') {
        return data.value;
      }
    } catch (_e) {
      // fall back to memory store
    }
  }
  return memStore.has(key) ? memStore.get(key) : def;
}

async function setConfig(key: string, val: unknown): Promise<void> {
  const client = await getClient();
  if (client) {
    try {
      const { error } = await client.from('kv_config').upsert({ key, value: val });
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
  const snap = await getConfig('features:published', { data: {} });
  return snap?.data?.[name] ?? def;
}

async function setFlag(name: string, val: boolean): Promise<void> {
  const snap = await getConfig('features:draft', { ts: Date.now(), data: {} });
  snap.data[name] = val;
  snap.ts = Date.now();
  await setConfig('features:draft', snap);
}

async function snapshot(_area: 'FEATURES'): Promise<{ ts: number; data: Record<string, boolean> }> {
  await Promise.resolve(); // satisfy require-await
  const snap = await getConfig('features:draft', { ts: Date.now(), data: {} });
  return { ts: Date.now(), data: { ...snap.data } };
}

async function pushSnapshot(label: 'DRAFT' | 'PUBLISHED' | 'ROLLBACK'): Promise<void> {
  const snap = await snapshot('FEATURES');
  await setConfig(`features:${label.toLowerCase()}`, snap);
}

async function publish(adminId?: string): Promise<void> {
  const draft = await getConfig('features:draft', { ts: Date.now(), data: {} });
  const current = await getConfig('features:published', { ts: Date.now(), data: {} });
  await setConfig('features:rollback', current);
  await setConfig('features:published', draft);
  console.log('publish', { from: current, to: draft });
  const client = await getClient();
  if (client) {
    try {
      await client.from('audit_log').insert({
        admin_id: adminId ?? null,
        action: 'publish',
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
  const published = await getConfig('features:published', { ts: Date.now(), data: {} });
  const previous = await getConfig('features:rollback', { ts: Date.now(), data: {} });
  await setConfig('features:published', previous);
  await setConfig('features:rollback', published);
  console.log('rollback', { from: published, to: previous });
  const client = await getClient();
  if (client) {
    try {
      await client.from('audit_log').insert({
        admin_id: adminId ?? null,
        action: 'rollback',
        from: published,
        to: previous,
        ts: new Date().toISOString(),
      });
    } catch (_e) {
      // ignore if table missing
    }
  }
}

async function preview(): Promise<{ ts: number; data: Record<string, boolean> }> {
  await Promise.resolve(); // satisfy require-await
  return await getConfig('features:draft', { ts: Date.now(), data: {} });
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
