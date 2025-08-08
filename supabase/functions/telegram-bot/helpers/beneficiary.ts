import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Read-only helper to fetch an approved beneficiary by account number
export async function getApprovedBeneficiaryByAccountNumber(
  supabase: SupabaseClient,
  accountNumber: string,
) {
  const table = Deno.env.get("BENEFICIARY_TABLE") || "beneficiaries";
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("account_number", accountNumber)
    .maybeSingle();
  if (error) throw error;
  return data;
}
