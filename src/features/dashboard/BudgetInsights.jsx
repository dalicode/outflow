import React from "react";
import { useSettings } from "../../context/settingsContext";

export default function BudgetInsights({ summary }) {
  const { formatAmount, getNumberColorClass } = useSettings();

  if (!summary) return null;

  const {
    income,
    fixedExpensesTotal,
    autoSavings,
    remaining,
    fixedExpenses,
  } = summary;

  const totalSavings = autoSavings + remaining;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-theme-muted uppercase tracking-widest">
        Budget Insights
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Monthly Spending", value: summary.variableExpenses, tone: "primary" },
          { label: "Auto Savings", value: autoSavings, tone: "primary" },
          { label: "Remaining Budget", value: remaining, tone: "remaining" },
          { label: "Total Savings", value: totalSavings, tone: "primary" },
        ].map(({ label, value, tone }) => {
          const toneClasses = {
            warning: "text-yellow-600",
            savings: getNumberColorClass(value),
            remaining:
              value > 0
                ? "text-theme-success"
                : value < 0
                  ? "text-theme-danger"
                  : "text-theme-text",
            totalSavings: getNumberColorClass(value),
            primary: "text-theme-primary",
          };
          return (
            <div
              key={label}
              className="bg-theme-surface rounded-theme-large shadow-sm px-4 py-3 border border-theme-border"
            >
              <p className="text-xs text-theme-muted uppercase tracking-widest mb-2">
                {label}
              </p>
              <p className={`text-xl font-semibold ${toneClasses[tone]}`}>
                {formatAmount(value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Fixed Expenses summary card */}
      <div className="bg-theme-surface rounded-theme-large shadow-sm px-4 py-3 space-y-2 border border-theme-border">
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
            Fixed Expenses
          </p>
          <p className="text-lg font-semibold text-theme-primary">
            {formatAmount(fixedExpensesTotal)}
          </p>
        </div>
        {fixedExpenses.length === 0 ? (
          <p className="text-sm text-theme-muted">
            No fixed expenses added yet.
          </p>
        ) : (
          <ul className="divide-y divide-theme-border">
            {fixedExpenses.map((f) => (
              <li key={f.id} className="flex justify-between py-1 text-sm">
                <span className="text-theme-text">{f.name}</span>
                <span className={`text-theme-text font-medium text-theme-primary`}>
                  {formatAmount(f.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
