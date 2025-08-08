import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const TABLE = Deno.env.get("BENEFICIARY_TABLE") ?? "beneficiaries";

export async function getApprovedBeneficiaryByAccountNumber(
  supabase: SupabaseClient,
  accountNumber: string,
) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("account_number", accountNumber)
    .maybeSingle();
  if (error) {
    console.error("Error fetching beneficiary", error);
    return null;
  }
  return data;
}
