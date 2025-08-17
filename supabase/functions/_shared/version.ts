import { ok, mna } from "./http.ts";

export function version(req: Request, name: string): Response | null {
  const url = new URL(req.url);
  if (!url.pathname.endsWith("/version")) return null;
  if (req.method === "GET") {
    return ok({ name, ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") {
    return ok();
  }
  return mna();
}
