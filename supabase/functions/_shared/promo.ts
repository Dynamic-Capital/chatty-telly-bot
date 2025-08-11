// >>> DC BLOCK: promo-shared (start)
export function calcFinalAmount(price: number, type: string, value: number): number {
  const discount = type === "percent" ? price * (value / 100) : value;
  const final = price - discount;
  return final < 0 ? 0 : Math.round(final * 100) / 100;
}

export function redeemKey(paymentId: string, code: string): string {
  return btoa(`${paymentId}:${code}`);
}
// <<< DC BLOCK: promo-shared (end)
