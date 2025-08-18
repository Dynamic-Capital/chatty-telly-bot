import { envOrSetting } from "./config.ts";

interface MiniAppEnv {
  url: string | null;
  short: string | null;
  ready?: boolean;
}

export async function readMiniAppEnv(): Promise<MiniAppEnv> {
  const urlRaw = await envOrSetting<string>("MINI_APP_URL");
  const short = await envOrSetting<string>("MINI_APP_SHORT_NAME");

  const url = urlRaw?.startsWith("https://")
    ? (urlRaw.endsWith("/") ? urlRaw : `${urlRaw}/`)
    : null;

  return { url, short: short ?? null, ready: Boolean(url || short) };
}
