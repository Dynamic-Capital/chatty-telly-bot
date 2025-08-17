import { envOrSetting } from "../_shared/config.ts";

export async function readMiniAppEnv() {
  const urlRaw = (await envOrSetting("MINI_APP_URL")) || "";
  const short = (await envOrSetting("MINI_APP_SHORT_NAME")) || "";
  const url = urlRaw.startsWith("https://")
    ? urlRaw.endsWith("/") ? urlRaw : urlRaw + "/"
    : "";
  return { url, short, ready: !!url || !!short };
}
