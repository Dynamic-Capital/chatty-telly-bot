import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";

type Body = {
  telegram_id: string;
  payment_id: string;
  storage_path: string;
  storage_bucket?: string;
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

  const { error } = await supa
    .from("payments")
    .update({
      status: "pending",
      webhook_data: {
        storage_bucket: body.storage_bucket || "receipts",
        storage_path: body.storage_path,
      },
    })
    .eq("id", body.payment_id);
  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500 },
    );
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { headers: { "content-type": "application/json" } },
  );
});
