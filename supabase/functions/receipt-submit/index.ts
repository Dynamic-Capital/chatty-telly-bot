import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getEnv } from "../_shared/env.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const url = getEnv("SUPABASE_URL");
  const srv = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supa = createClient(url, srv, { auth: { persistSession: false } });

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
