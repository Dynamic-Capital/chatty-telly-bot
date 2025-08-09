import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!client) {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

const cache = new Map<string, string>();

export async function getSecret(key: string): Promise<string | null> {
  if (cache.has(key)) return cache.get(key)!;
  try {
    const { data, error } = await getClient()
      .from("secrets")
      .select("value")
      .eq("key", key)
      .single();
    if (error) {
      console.error(`getSecret error for ${key}`, error);
      return null;
    }
    const value = data?.value ?? null;
    if (value) cache.set(key, value);
    return value;
  } catch (err) {
    console.error(`getSecret unexpected error for ${key}`, err);
    return null;
  }
}
