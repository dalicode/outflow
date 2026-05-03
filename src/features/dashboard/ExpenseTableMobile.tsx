import { useMemo } from "react";
import { useLongPress } from "../../hooks/useLongPress";
import { cn } from "../../utils/cn";
import type { Expense } from "../../types";

interface ExpenseTableMobileProps {
  expenses: Expense[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onCellEdit: (expense: Expense) => void;
  formatDate: (iso: string) => string;
  formatAmount: (n: number) => string;
  resolveName: (exp: Expense) => string;
}

export default function ExpenseTableMobile({
  expenses,
  selectedIds,
  onToggleSelect,
  onCellEdit,
  formatDate,
  formatAmount,
  resolveName,
}: ExpenseTableMobileProps) {
  const groupedExpenses = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    expenses.forEach((exp) => {
      if (!groups[exp.date]) groups[exp.date] = [];
      groups[exp.date].push(exp);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses]);

  const { onTouchStart, onTouchMove, onTouchEnd } = useLongPress({
    onLongPress: (id: number) => {
      onToggleSelect(id);
    },
  });

  return (
    <div>
      {groupedExpenses.map(([date, items]) => (
        <div key={date}>
          <div className="py-1 px-3 text-xs text-theme-muted bg-theme-background">
            {formatDate(date)}
          </div>
          {items.map((exp) => {
            const isSelected = selectedIds.has(exp.id as number);
            const amountColor =
              exp.amount < 0 ? "text-theme-success" : "text-theme-primary";
            return (
              <div
                key={exp.id}
                className={cn(
                  "flex items-center justify-between py-1 px-3",
                  isSelected &&
                    "selected-row border-l-4 border-theme-primary",
                  "row-hover",
                )}
                onTouchStart={(e) => onTouchStart(e, exp.id as number)}
                onTouchMove={onTouchMove}
                onTouchEnd={(e) => onTouchEnd(e, exp.id as number)}
                onClick={() => {
                  if (selectedIds.size > 0) {
                    onToggleSelect(exp.id as number);
                  } else {
                    onCellEdit(exp);
                  }
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-theme-text truncate">
                    {exp.description || "—"}
                  </p>
                  <p className="text-xs text-theme-muted">{resolveName(exp)}</p>
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
  );
}
