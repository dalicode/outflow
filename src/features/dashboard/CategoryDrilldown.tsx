import { forwardRef } from "react";
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

const CategoryDrilldown = forwardRef<HTMLDivElement, CategoryDrilldownProps>(
  (
    { category, monthName, year, expenses, formatDate, formatAmount, onClose },
    ref,
  ) => {
    return (
      <div ref={ref} className="space-y-2 border-t border-theme-border pt-4">
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="table-header-cell text-left">Date</th>
                <th className="table-header-cell text-left">Description</th>
                <th className="table-header-cell text-right tabular-nums">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => {
                const amountColor =
                  exp.amount < 0 ? "text-theme-success" : "text-theme-primary";
                return (
                  <tr
                    key={exp.id}
                    className="border-b border-theme-muted/10 row-hover"
                  >
                    <td className="px-3 py-1 text-theme-text whitespace-nowrap">
                      {formatDate(exp.date)}
                    </td>
                    <td className="px-3 py-1 text-theme-text max-w-[200px] truncate">
                      {exp.description || "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-1 text-right tabular-nums font-semibold",
                        amountColor,
                      )}
                    >
                      {formatAmount(exp.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {expenses.length === 0 && (
            <p className="text-sm text-theme-muted text-center py-8">
              No expenses
            </p>
          )}
        </div>
      </div>
    );
  },
);

export default CategoryDrilldown;
