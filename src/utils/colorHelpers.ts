/**
 * Savings Gradient Color
 * ──────────────────────
 * Computes a color between red (danger) and green (success) based on
 * how close the actual savings ratio is to the target savings rate.
 *
 * @param ratioPct   Actual savings as % of income
 * @param savingsRate Target savings rate %
 * @returns CSS color string
 */
export function getSavingsGradientColor(
  ratioPct: number,
  savingsRate: number,
): string {
  if (ratioPct <= 0) return "var(--theme-danger)";
  const upperBound = savingsRate * 1.5;
  if (ratioPct >= upperBound) return "var(--theme-success)";
  const stepped = Math.round((ratioPct / upperBound) * 20) / 20;
  const normalized = Math.max(0, Math.min(1, stepped));
  const dangerPct = Math.round((1 - normalized) * 100);
  const successPct = Math.round(normalized * 100);
  return `color-mix(in hsl, var(--theme-danger) ${dangerPct}%, var(--theme-success) ${successPct}%)`;
}
