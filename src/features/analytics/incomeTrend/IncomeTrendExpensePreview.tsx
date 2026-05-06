import { useMemo } from "react";
import { cn } from "../../../utils/cn";
import type { Expense, Category, Payee } from "../../../types";

interface IncomeTrendExpensePreviewProps {
  expenses: Expense[];
  categories: Category[];
  payees: Payee[];
  formatAmount: (n: number) => string;
  formatDate: (iso: string) => string;
}

export default function IncomeTrendExpensePreview({
  expenses,
  categories,
  payees,
  formatAmount,
  formatDate,
}: IncomeTrendExpensePreviewProps) {
  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );
  const payeeMap = useMemo(
    () => new Map(payees.map((p) => [p.id, p.name])),
    [payees],
  );

  if (expenses.length === 0) {
    return (
      <p className="text-xs text-theme-muted py-2 text-center">
        No expenses this month
      </p>
    );
  }

  return (
    <ul className="divide-y divide-theme-border">
      {expenses.map((exp) => {
        const catName =
          exp.categoryId != null
            ? (catMap.get(exp.categoryId) ?? "Uncategorized")
            : "Uncategorized";
        const payeeName =
          exp.payeeId != null ? (payeeMap.get(exp.payeeId) ?? null) : null;

        return (
          <li
            key={exp.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm text-theme-text truncate">
                {exp.description || catName}
              </div>
              <div className="text-xs text-theme-muted truncate">
                {formatDate(exp.date)}
                {payeeName && ` · ${payeeName}`}
                {!exp.description && !payeeName && ` · ${catName}`}
              </div>
            </div>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums shrink-0",
                exp.amount < 0 ? "text-theme-success" : "text-theme-text",
              )}
            >
              {formatAmount(exp.amount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
