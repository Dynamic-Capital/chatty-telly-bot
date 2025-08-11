export function readMiniAppEnv() {
  const urlRaw = Deno.env.get("MINI_APP_URL") || "";
  const short = Deno.env.get("MINI_APP_SHORT_NAME") || "";
  const url = urlRaw ? (urlRaw.endsWith("/") ? urlRaw : urlRaw + "/") : "";
  return { url, short, ready: !!url || !!short };
}
