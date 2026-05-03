import { useSettings } from "../../context/settingsContext";
import type { FixedExpense } from "../../types";

interface FixedExpensesCardProps {
  fixedExpenses: FixedExpense[];
  total: number;
}

export default function FixedExpensesCard({
  fixedExpenses,
  total,
}: FixedExpensesCardProps) {
  const { formatAmount } = useSettings();

  return (
    <div className="rounded-theme-large bg-theme-surface shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-theme-text tracking-tight">
          Fixed Expenses
        </h3>
        <span className="text-lg font-bold text-theme-primary tabular-nums">
          {formatAmount(total)}
        </span>
      </div>

      {fixedExpenses.length === 0 ? (
        <p className="text-sm text-theme-muted">No fixed expenses added yet.</p>
      ) : (
        <ul className="space-y-0">
          {fixedExpenses.map((f, i) => (
            <li
              key={f.id}
              className={`flex items-center justify-between py-2 text-sm ${
                i !== fixedExpenses.length - 1
                  ? "border-b border-theme-muted/10"
                  : ""
              }`}
            >
              <span className="text-theme-text font-medium">{f.name}</span>
              <span className="text-theme-primary font-semibold tabular-nums">
                {formatAmount(f.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
