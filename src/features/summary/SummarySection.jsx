import React from "react";
import { useSettings } from "../../context/settingsContext";

function Card({ label, value, colorClass = "text-theme-text" }) {
  return (
    <div className="bg-theme-surface rounded-xl shadow-sm px-4 py-3 flex flex-col gap-0.5 border border-theme-border">
      <span className="text-xs text-theme-muted uppercase tracking-widest mb-2">
        {label}
      </span>
      <span className={`text-xl font-semibold ${colorClass}`}>{value}</span>
    </div>
  );
}

export default function SummarySection({ summary }) {
  const { formatAmount } = useSettings();
  if (!summary) return null;

  const {
    income,
    fixedExpensesTotal,
    variableExpenses,
    savingsRate,
    autoSavings,
    remaining,
  } = summary;

  const available = income - fixedExpensesTotal;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
        Financial Summary
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card
          label="Monthly Income"
          value={formatAmount(income)}
          colorClass="text-theme-primary"
        />
        <Card
          label="Fixed Expenses"
          value={formatAmount(fixedExpensesTotal)}
          colorClass="text-theme-primary"
        />
        <Card
          label="Variable Expenses"
          value={formatAmount(variableExpenses)}
          colorClass="text-theme-primary"
        />
        <Card
          label="Available Income"
          value={formatAmount(Math.max(0, available))}
          colorClass="text-theme-primary"
        />
        <Card
          label="Auto Savings"
          value={formatAmount(Math.max(0, autoSavings))}
          colorClass="text-theme-primary"
        />
        <Card
          label="Remaining Budget"
          value={formatAmount(remaining)}
          colorClass={
            remaining > 0
              ? "text-theme-success"
              : remaining < 0
                ? "text-theme-danger"
                : "text-theme-text"
          }
        />
      </div>
    </div>
  );
}
