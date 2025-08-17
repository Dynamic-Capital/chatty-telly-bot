import { verifyInitDataAndGetUser } from "../_shared/telegram.ts";
import { ok, bad, unauth, mna } from "../_shared/http.ts";

export async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return mna();
  let body: { initData?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return bad("Bad JSON");
  }
  const u = await verifyInitDataAndGetUser(body.initData || "");
  if (!u) return unauth();
  const amount = Number(body.amount);
  if (!amount || isNaN(amount) || amount <= 0) return bad("Invalid amount");
  const intent_id = crypto.randomUUID();
  return ok({ intent_id, amount });
}

Deno.serve(handler);
