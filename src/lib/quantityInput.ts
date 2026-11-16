/** Numeric input values must not contain grouping separators or floating-point tails. */
export function quantityInputValue(quantity: number): string {
  return Number.isFinite(quantity) ? String(Number(quantity.toFixed(4))) : '';
}
