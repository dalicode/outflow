import { useMemo } from "react";
import { useLongPress } from "../../hooks/useLongPress";
import { cn } from "../../utils/cn";
import type { Expense } from "../../types";

interface ExpenseTableMobileProps {
  expenses: Expense[];
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onCellEdit?: (expense: Expense) => void;
  formatDate: (iso: string) => string;
  formatAmount: (n: number) => string;
  resolveName: (exp: Expense) => string;
  resolvePayeeName?: (exp: Expense) => string;
  hideCategory?: boolean;
}

export default function ExpenseTableMobile({
  expenses,
  selectedIds,
  onToggleSelect,
  onCellEdit,
  formatDate,
  formatAmount,
  resolveName,
  resolvePayeeName,
  hideCategory,
}: ExpenseTableMobileProps) {
  const resolvedSelectedIds = selectedIds ?? new Set<number>();
  const resolvedOnToggleSelect = onToggleSelect ?? (() => {});
  const resolvedOnCellEdit = onCellEdit ?? (() => {});
  const isInteractive = onToggleSelect != null || onCellEdit != null;

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
      resolvedOnToggleSelect(id);
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
            const isSelected = resolvedSelectedIds.has(exp.id as number);
            const amountColor =
              exp.amount < 0 ? "text-theme-success" : "text-theme-primary";
            return (
              <div
                key={exp.id}
                data-testid={`expense-row-mobile-${exp.id}`}
                className={cn(
                  "grid items-center gap-x-3 py-1 px-3 expense-row-mobile",
                  isSelected && "selected-row border-l-4 border-theme-primary",
                  "row-hover",
                )}
                style={{
                  gridTemplateColumns:
                    "minmax(60px, auto) 1fr minmax(60px, auto)",
                }}
                onTouchStart={
                  isInteractive
                    ? (e) => onTouchStart(e, exp.id as number)
                    : undefined
                }
                onTouchMove={isInteractive ? onTouchMove : undefined}
                onTouchEnd={
                  isInteractive
                    ? (e) => onTouchEnd(e, exp.id as number)
                    : undefined
                }
                onClick={() => {
                  if (!isInteractive) return;
                  if (resolvedSelectedIds.size > 0) {
                    resolvedOnToggleSelect(exp.id as number);
                  } else {
                    resolvedOnCellEdit(exp);
                  }
                }}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-theme-text truncate">
                    {resolvePayeeName?.(exp) || exp.description || "—"}
                  </span>
                  {!hideCategory && (
                    <span className="text-xs text-theme-muted truncate">
                      {resolveName(exp)}
                    </span>
                  )}
                </div>
                <div className="text-right min-w-0">
                  {exp.description && (
                    <span className="text-sm text-theme-muted truncate block">
                      {exp.description}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums text-right",
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
