import { useMemo } from "react";
import { cn } from "../../utils/cn";
import type { Expense } from "../../types";

interface CategoryDrilldownProps {
  category: string;
  monthName: string;
  year: number;
  expenses: Expense[];
  formatDate: (iso: string) => string;
  formatAmount: (n: number) => string;
  onClose: () => void;
}

export default function CategoryDrilldown({
  category,
  monthName,
  year,
  expenses,
  formatDate,
  formatAmount,
  onClose,
}: CategoryDrilldownProps) {
  const groupedExpenses = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    expenses.forEach((exp) => {
      if (!groups[exp.date]) groups[exp.date] = [];
      groups[exp.date].push(exp);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses]);

  return (
    <div className="space-y-2 border-t border-theme-border pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-theme-text">
          {category} — {monthName} {year}
        </h3>
        <button
          onClick={onClose}
          className="text-xs font-medium text-theme-muted hover:text-theme-text transition-colors"
        >
          Close
        </button>
      </div>
      <div className="divide-y divide-theme-border">
        {groupedExpenses.map(([date, items]) => (
          <div key={date}>
            <div className="py-1 px-3 text-xs text-theme-muted bg-theme-background/50">
              {formatDate(date)}
            </div>
            {items.map((exp) => {
              const amountColor =
                exp.amount < 0 ? "text-theme-success" : "text-theme-primary";
              return (
                <div
                  key={exp.id}
                  className="flex items-center justify-between py-2 px-3 row-hover"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-theme-text truncate">
                      {exp.description || "—"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      amountColor,
                    )}
                  >
                    {formatAmount(exp.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
