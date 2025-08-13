#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Registers a Supabase log drain that forwards logs to Logtail (or any
 * compatible HTTP log collector).
 *
 * Required env vars:
 *   SUPABASE_PROJECT_ID   - Project reference, e.g. abcdefghijklmnop
 *   SUPABASE_ACCESS_TOKEN - Personal access token with project write access
 *   LOGTAIL_SOURCE_TOKEN  - Ingestion token for Logtail/Better Stack
 *
 * Optional env vars:
 *   LOGTAIL_URL           - Override ingestion URL (default https://in.logtail.com)
 */

const projectId = Deno.env.get("SUPABASE_PROJECT_ID");
const accessToken = Deno.env.get("SUPABASE_ACCESS_TOKEN");
const sourceToken = Deno.env.get("LOGTAIL_SOURCE_TOKEN");
const sinkUrl = Deno.env.get("LOGTAIL_URL") ?? "https://in.logtail.com";

if (!projectId) throw new Error("SUPABASE_PROJECT_ID missing");
if (!accessToken) throw new Error("SUPABASE_ACCESS_TOKEN missing");
if (!sourceToken) throw new Error("LOGTAIL_SOURCE_TOKEN missing");

const body = {
  name: "logtail",
  type: "https",
  sink: {
    url: sinkUrl,
    headers: { Authorization: `Bearer ${sourceToken}` },
  },
  enabled: true,
};

const resp = await fetch(
  `https://api.supabase.com/v1/projects/${projectId}/log-drains`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  },
);

const text = await resp.text();
console.log(resp.status, text);
if (!resp.ok) {
  throw new Error(`Failed to create log drain: ${resp.status}`);
}
