import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";

type Body = {
  telegram_id: string;
  payment_id: string;
  filename: string;
  content_type?: string;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const supa = createClient();

  const key = `receipts/${body.telegram_id}/${crypto.randomUUID()}-${body.filename}`;
  const { data: signed, error } = await supa.storage
    .from("receipts")
    .createSignedUploadUrl(key);
  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500 },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, bucket: "receipts", path: key, signed }),
    { headers: { "content-type": "application/json" } },
  );
});
