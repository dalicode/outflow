import { getCategoryColor } from "../../summary/summaryColorUtils";
import type { CategoryBreakdownRow } from "../../../utils/analyticsTrendUtils";

interface IncomeTrendCategoryBreakdownProps {
  rows: CategoryBreakdownRow[];
  formatAmount: (n: number) => string;
}

export default function IncomeTrendCategoryBreakdown({
  rows,
  formatAmount,
}: IncomeTrendCategoryBreakdownProps) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-theme-muted py-4 text-center">
        No category data for this month
      </p>
    );
  }

  const maxAmount = rows[0]?.amount ?? 0;

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const barWidth = maxAmount > 0 ? (row.amount / maxAmount) * 100 : 0;
        const color = getCategoryColor(row.name);
        return (
          <div key={row.name} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-theme-text truncate">{row.name}</span>
              </div>
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
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barWidth}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
