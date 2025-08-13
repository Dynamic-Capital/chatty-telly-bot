// >>> DC BLOCK: promo-shared (start)
export function calcFinalAmount(
  price: number,
  type: "percentage" | "fixed",
  value: number,
): number {
  const discount = type === "percentage" ? price * (value / 100) : value;
  const final = price - discount;
  return final < 0 ? 0 : Math.round(final * 100) / 100;
}

export function redeemKey(paymentId: string, code: string): string {
  return btoa(`${paymentId}:${code}`);
}
// <<< DC BLOCK: promo-shared (end)
