import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const BENEFICIARY_TABLE = Deno.env.get("BENEFICIARY_TABLE") ?? "beneficiaries";

export function normalizeAccount(n: string) {
  return n.replace(/\s+/g, "");
}

export async function getApprovedBeneficiaryByAccountNumber(
  supabase: SupabaseClient,
  accountNumber: string,
): Promise<{ account_name?: string | null } | null> {
  const acct = normalizeAccount(accountNumber);
  const { data, error } = await supabase
    .from<{ account_name?: string | null }>(BENEFICIARY_TABLE)
    .select("account_name")
    .eq("account_number", acct)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data; // may be null
}
