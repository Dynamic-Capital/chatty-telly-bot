import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";
import { mna, oops, ok } from "../_shared/http.ts";
import { version } from "../_shared/version.ts";

export async function handler(req: Request): Promise<Response> {
  const v = version(req, "plans");
  if (v) return v;
  if (req.method !== "GET") {
    return mna();
  }

  const supa = createClient("anon");

  const { data, error } = await supa
    .from("subscription_plans")
    .select("id,name,duration_months,price,currency,is_lifetime,features,created_at")
    .order("price", { ascending: true });

  if (error) {
    return oops(error.message);
  }

  return ok({ plans: data });
}

if (import.meta.main) serve(handler);
