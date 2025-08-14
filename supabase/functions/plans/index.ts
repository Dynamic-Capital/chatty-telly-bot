import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";

serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supa = createClient("anon");

  const { data, error } = await supa
    .from("subscription_plans")
    .select("id,name,duration_months,price,currency,is_lifetime,features,created_at")
    .order("price", { ascending: true });

  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500 },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, plans: data }),
    { headers: { "content-type": "application/json" } },
  );
});
