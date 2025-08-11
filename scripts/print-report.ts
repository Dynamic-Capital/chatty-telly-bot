const inputs = await new Response(await Deno.stdin.readable).text();
const lines = inputs.trim().split("\n").filter(Boolean).map(s=>{try{return JSON.parse(s)}catch{return {raw:s}}});
function pick(name){ return lines.find(x=>x.__name===name) || {}; }
function as(name,obj){ return JSON.stringify({__name:name, ...obj}); }
function yn(v){ return v ? "yes" : "no"; }
const sec = pick("secrets");
const ver = pick("versions");
const sync = pick("sync");
const ops = pick("ops");
const admin = pick("admin_probe");
const schedules = pick("schedules");
const logsBot = pick("logs_bot");
const logsMini = pick("logs_mini");

function summarizeLogs(j){
  if(!j || !j.lines) return "no logs";
  const txt = j.lines.join("\n");
  const c401 = (txt.match(/\b401\b/g)||[]).length;
  const c403 = (txt.match(/\b403\b/g)||[]).length;
  const c500 = (txt.match(/\b500\b/g)||[]).length;
  const tops = txt.split("\n").filter(s=>/error|fatal|missing|Unauthorized|Secret|Internal/.test(s)).slice(0,3);
  return `401=${c401} 403=${c403} 500=${c500}${tops.length?`\n  - ${tops.join("\n  - ")}`:""}`;
}

const okAll =
  ver.bot_ok && ver.mini_ok &&
  (sync.mismatches?.length===0) &&
  ops.ok &&
  !/500/.test(summarizeLogs(logsBot)) &&
  !/500/.test(summarizeLogs(logsMini));

console.log([
"=== PROD READINESS REPORT ===",
"",
"SECRETS (presence only)",
`- SUPABASE_URL: ${yn(sec.SUPABASE_URL)}`,
`- SUPABASE_ANON_KEY: ${yn(sec.SUPABASE_ANON_KEY)}`,
`- SUPABASE_SERVICE_ROLE_KEY: ${yn(sec.SUPABASE_SERVICE_ROLE_KEY)}`,
`- TELEGRAM_BOT_TOKEN: ${yn(sec.TELEGRAM_BOT_TOKEN)}`,
`- TELEGRAM_WEBHOOK_SECRET (env or DB): ${yn(sec.TELEGRAM_WEBHOOK_SECRET || sec.DB_WEBHOOK_SECRET)}`,
`- MINI_APP_URL: ${yn(sec.MINI_APP_URL)}`,
"",
"ENDPOINTS",
`- /telegram-bot/version: ${ver.bot_status} ok=${yn(ver.bot_ok)}`,
`- /miniapp/version: ${ver.mini_status} ok=${yn(ver.mini_ok)}`,
"",
"SYNC",
`- expected webhook: ${sync.expected_webhook || "-"}`,
`- actual webhook:   ${sync.actual_webhook || "-"}`,
`- expected miniapp: ${sync.expected_mini || "-"}`,
`- chat menu url:    ${sync.actual_menu || "-"}`,
`- mismatches: ${sync.mismatches?.join(", ") || "none"}`,
`- self-heal actions: ${sync.actions?.length ? JSON.stringify(sync.actions) : "none"}`,
"",
"OPS HEALTH",
`- ops-health ok: ${yn(ops.ok)}  db:${yn(ops.db)} secrets_ok:${yn(ops.secrets_ok)}`,
"",
"ADMIN PROBE",
`- admin-review-payment auth: ${admin.status || "-"}`,
"",
"SCHEDULES",
`- found: ${(schedules.names||[]).join(", ") || "-"}`,
"",
"LOGS (15m)",
"- telegram-bot:",
summarizeLogs(logsBot),
"- miniapp:",
summarizeLogs(logsMini),
"",
`OVERALL: ${okAll ? "PASS ✅" : "ATTENTION ⚠️"}`,
okAll ? "" : "Next steps: resolve mismatches via sync-audit fix; ensure ops-health ok; address 500s seen in logs; verify admin header; redeploy failing functions."
].join("\n"));
