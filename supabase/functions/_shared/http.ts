export function json(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  const h = new Headers({
    "content-type": "application/json; charset=utf-8",
    ...extra,
  });
  return new Response(JSON.stringify(data), { status, headers: h });
}
export const ok = (data: unknown = {}) =>
  json({ ok: true, ...((typeof data === "object" && data) || {}) }, 200);
export const bad = (message = "Bad Request", hint?: unknown) =>
  json({ ok: false, error: message, hint }, 400);
export const unauth = (message = "Unauthorized") =>
  json({ ok: false, error: message }, 401);
export const nf = (message = "Not Found") =>
  json({ ok: false, error: message }, 404);
export const mna = () => json({ ok: false, error: "Method Not Allowed" }, 405);
export const oops = (message: string, hint?: unknown) =>
  json({ ok: false, error: message, hint }, 500);
