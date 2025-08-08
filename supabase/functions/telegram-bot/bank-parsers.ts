/**
 * Utility functions for parsing bank receipt text.
 */
export interface BankReceipt {
  bankName: string;
  total: number | null;
}

/**
 * Attempt to extract basic receipt information from raw text.
 * Currently detects a few common South African bank names
 * and tries to parse a transaction amount.
 */
export function parseBankReceipt(text: string): BankReceipt {
  // Use a lower‑cased copy for case‑insensitive searches.
  const lower = text.toLowerCase();

  // Parse first number that looks like a monetary amount.
  const amtMatch = lower.match(/([0-9]+[.,][0-9]{2})/);
  const total = amtMatch ? Number(amtMatch[1].replace(",", ".")) : null;

  let bankName = "unknown";
  if (lower.includes("fnb")) bankName = "FNB";
  else if (lower.includes("standard bank")) bankName = "Standard Bank";
  else if (lower.includes("capitec")) bankName = "Capitec";

  return { bankName, total };
}
