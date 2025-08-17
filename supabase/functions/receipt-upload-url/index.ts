import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";
import { bad, mna, ok, oops } from "../_shared/http.ts";
import { version } from "../_shared/version.ts";

type Body = {
  telegram_id: string;
  payment_id: string;
  filename: string;
  content_type?: string;
};

export async function handler(req: Request): Promise<Response> {
  const v = version(req, "receipt-upload-url");
  if (v) return v;
  if (req.method !== "POST") return mna();

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad("Bad JSON");
  }

  const supa = createClient();

  const key = `receipts/${body.telegram_id}/${crypto.randomUUID()}-${body.filename}`;
  const { data: signed, error } = await supa.storage
    .from("receipts")
    .createSignedUploadUrl(key);
  if (error) {
    return oops(error.message);
  }

  return ok({ bucket: "receipts", path: key, signed });
}

if (import.meta.main) serve(handler);
