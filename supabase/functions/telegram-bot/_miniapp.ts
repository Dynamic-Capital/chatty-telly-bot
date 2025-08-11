import { optionalEnv } from "../_shared/env.ts";

export function readMiniAppEnv() {
  const urlRaw = optionalEnv("MINI_APP_URL") || "";
  const short = optionalEnv("MINI_APP_SHORT_NAME") || "";
  const url = urlRaw ? (urlRaw.endsWith("/") ? urlRaw : urlRaw + "/") : "";
  return { url, short, ready: !!url || !!short };
}
