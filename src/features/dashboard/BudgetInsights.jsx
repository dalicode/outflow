import React from "react";
import { useSettings } from "../../context/settingsContext";

export default function BudgetInsights({
  monthTotal,
  monthlyIncome,
  savingsRate,
  totalFixed,
  fixedExpenses,
}) {
  const { formatAmount, getNumberColorClass } = useSettings();
  const available = monthlyIncome - totalFixed;
  const savings = Math.max(0, monthlyIncome * (savingsRate / 100));
  const remaining = available - savings - monthTotal;
  const totalSavings = savings + remaining;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-theme-muted uppercase tracking-widest">
        Budget Insights
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Monthly Spending", value: monthTotal, tone: "warning" },
          { label: "Auto Savings", value: savings, tone: "positive" },
          {
            label: "Remaining Budget",
            value: remaining,
            tone: remaining >= 0 ? "positive" : "negative",
          },
          {
            label: "Total Savings",
            value: totalSavings,
            tone: totalSavings >= 0 ? "positive" : "negative",
          },
        ].map(({ label, value, tone }) => {
          const toneClasses = {
            warning: "text-yellow-600",
            positive: "positive-number",
            negative: "negative-number",
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
          <p className="text-lg font-semibold text-orange-600">
            {formatAmount(totalFixed)}
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
                <span
                  className={`text-theme-text font-medium ${getNumberColorClass(f.amount)}`}
                >
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
