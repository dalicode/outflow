import type { PayeeBreakdownRow } from "../../../utils/analyticsTrendUtils";

interface IncomeTrendPayeeHighlightsProps {
  rows: PayeeBreakdownRow[];
  formatAmount: (n: number) => string;
}

export default function IncomeTrendPayeeHighlights({
  rows,
  formatAmount,
}: IncomeTrendPayeeHighlightsProps) {
  if (rows.length === 0) return null;

  const maxAmount = rows[0]?.amount ?? 0;

  return (
    <div className="space-y-2.5">
      {rows.slice(0, 5).map((row) => {
        const barWidth = maxAmount > 0 ? (row.amount / maxAmount) * 100 : 0;
        return (
          <div key={row.name} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-theme-text truncate min-w-0">
                {row.name}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-theme-muted tabular-nums">
                  {row.pct.toFixed(1)}%
                </span>
                <span className="text-sm font-medium text-theme-text tabular-nums w-20 text-right">
                  {formatAmount(row.amount)}
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-theme-background overflow-hidden">
              <div
                className="h-full rounded-full bg-theme-primary transition-all duration-500"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
