import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const BENEFICIARY_TABLE = Deno.env.get("BENEFICIARY_TABLE") ?? "beneficiaries";

export interface Beneficiary {
  account_name?: string | null;
  account_number?: string | null;
  active?: boolean | null;
  [key: string]: unknown;
}

export function normalizeAccount(n: string) {
  return n.replace(/\s+/g, "");
}

export async function getApprovedBeneficiaryByAccountNumber(
  supabase: SupabaseClient,
  accountNumber: string,
): Promise<Beneficiary | null> {
  const acct = normalizeAccount(accountNumber);
  const { data, error } = await supabase
    .from(BENEFICIARY_TABLE)
    .select("*")
    .eq("account_number", acct)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data; // may be null
}
