import { createClient as createSupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEnv } from "./env.ts";

const url = getEnv("SUPABASE_URL");
const anonKey = getEnv("SUPABASE_ANON_KEY");
const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

const options = { auth: { persistSession: false } };

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;

export function createClient(
  key: "anon" | "service" = "service",
): SupabaseClient {
  const k = key === "service" ? serviceKey : anonKey;
  return createSupabaseClient(url, k, options);
}
