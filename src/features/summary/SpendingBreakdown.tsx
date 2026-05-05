import { useSettings } from "../../context/settingsContext";
import { cn } from "../../utils/cn";

interface BreakdownItem {
  name: string;
  amount: number;
  pct: number;
}

interface SpendingBreakdownProps {
  items: BreakdownItem[];
  total: number;
}

// Palette cycles through theme tokens via inline style vars
const BAR_COLORS = [
  "var(--theme-primary)",
  "var(--theme-secondary)",
  "var(--theme-success)",
  "var(--theme-danger)",
  "var(--theme-muted)",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

export default function SpendingBreakdown({ items, total }: SpendingBreakdownProps) {
  const { formatAmount } = useSettings();

  if (items.length === 0) return null;

  const maxAmount = items[0]?.amount ?? 0;

  return (
    <div className="rounded-theme-large border border-theme-border bg-theme-surface p-5 space-y-4">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-theme-text">Variable Spending</p>
        <p className="text-sm font-semibold text-theme-text tabular-nums">
          {formatAmount(total)}
        </p>
      </div>

      {/* Category rows */}
      <div className="space-y-3">
        {items.map((item, i) => {
          const barWidth = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
          const color = BAR_COLORS[i % BAR_COLORS.length];

          return (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-theme-text truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-theme-muted tabular-nums">
                    {item.pct.toFixed(1)}%
                  </span>
                  <span className="text-sm font-medium text-theme-text tabular-nums w-20 text-right">
                    {formatAmount(item.amount)}
                  </span>
                </div>
              </div>
              {/* Inline bar */}
              <div className="h-1.5 w-full rounded-full bg-theme-background overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: transaction count hint */}
      <p className="text-xs text-theme-muted pt-1 border-t border-theme-border">
        {items.length} {items.length === 1 ? "category" : "categories"} · current month
      </p>
    </div>
  );
}
