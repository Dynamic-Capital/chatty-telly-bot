import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../../../src/integrations/supabase/types.ts";
import { getEnv } from "./env.ts";

const url = getEnv("SUPABASE_URL");
const anonKey = getEnv("SUPABASE_ANON_KEY");
const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

const options = { auth: { persistSession: false } };

export function createClient(
  key: "anon" | "service" = "service",
): SupabaseClient<Database> {
  const k = key === "service" ? serviceKey : anonKey;
  return createSupabaseClient<Database>(url, k, options);
}
