import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  getConfig,
  setConfig,
  getFlag as getFlagBase,
  setFlag as setFlagBase,
} from "../_shared/config.ts";
import { createClient } from "../_shared/client.ts";

interface FlagSnapshot { ts: number; data: Record<string, boolean> }

async function preview(): Promise<FlagSnapshot> {
  return await getConfig<FlagSnapshot>("features:draft", {
    ts: Date.now(),
    data: {},
  });
}

async function publish(adminId?: string): Promise<void> {
  const draft = await getConfig<FlagSnapshot>("features:draft", {
    ts: Date.now(),
    data: {},
  });
  const current = await getConfig<FlagSnapshot>("features:published", {
    ts: Date.now(),
    data: {},
  });
  await setConfig("features:rollback", { ts: current.ts, data: { ...current.data } });
  await setConfig("features:published", { ts: draft.ts, data: { ...draft.data } });
  const client = createClient();
  try {
    await client.from("audit_log").insert({
      admin_id: adminId ?? null,
      action: "publish",
      from: current,
      to: draft,
      ts: new Date().toISOString(),
    });
  } catch (_e) {
    // ignore
  }
}

async function rollback(adminId?: string): Promise<void> {
  const published = await getConfig<FlagSnapshot>("features:published", {
    ts: Date.now(),
    data: {},
  });
  const previous = await getConfig<FlagSnapshot>("features:rollback", {
    ts: Date.now(),
    data: {},
  });
  await setConfig("features:published", { ts: previous.ts, data: { ...previous.data } });
  await setConfig("features:rollback", { ts: published.ts, data: { ...published.data } });
  const client = createClient();
  try {
    await client.from("audit_log").insert({
      admin_id: adminId ?? null,
      action: "rollback",
      from: published,
      to: previous,
      ts: new Date().toISOString(),
    });
  } catch (_e) {
    // ignore
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

serve(async (req) => {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const action = String(body.action || "");
  try {
    switch (action) {
      case "getFlag": {
        const name = String(body.name || "");
        const def = Boolean(body.def);
        const val = await getFlagBase(name, def);
        return json({ data: val });
      }
      case "setFlag": {
        const name = String(body.name || "");
        const value = Boolean(body.value);
        await setFlagBase(name, value);
        return json({ ok: true });
      }
      case "preview": {
        return json(await preview());
      }
      case "publish": {
        await publish(body.adminId as string | undefined);
        return json({ ok: true });
      }
      case "rollback": {
        await rollback(body.adminId as string | undefined);
        return json({ ok: true });
      }
      default:
        return json({ error: "invalid action" }, 400);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
