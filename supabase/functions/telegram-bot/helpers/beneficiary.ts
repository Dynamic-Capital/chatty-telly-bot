import { createClient } from "npm:@supabase/supabase-js@2";

const BENEFICIARY_TABLE = Deno.env.get("BENEFICIARY_TABLE") ?? "beneficiaries";

export function normalizeAccount(n: string) {
  return n.replace(/\s+/g, "");
}

export async function getApprovedBeneficiaryByAccountNumber(
  supabase: ReturnType<typeof createClient>,
  accountNumber: string
) {
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
