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

export default function SummarySection({
  monthlyIncome,
  totalFixed,
  variableExpenses,
  savingsRate,
}) {
  const { formatAmount, getNumberColorClass } = useSettings();
  const available = monthlyIncome - totalFixed;
  const savings = available * (savingsRate / 100);
  const remaining = available - savings - variableExpenses;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
        Financial Summary
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card
          label="Monthly Income"
          value={formatAmount(monthlyIncome)}
          colorClass="text-theme-primary"
        />
        <Card
          label="Fixed Expenses"
          value={formatAmount(totalFixed)}
          colorClass="text-orange-500"
        />
        <Card
          label="Variable Expenses"
          value={formatAmount(variableExpenses)}
          colorClass="text-yellow-600"
        />
        <Card
          label="Available Income"
          value={formatAmount(Math.max(0, available))}
          colorClass="text-blue-600"
        />
        <Card
          label="Savings"
          value={formatAmount(Math.max(0, savings))}
          colorClass="positive-number"
        />
        <Card
          label="Remaining Budget"
          value={formatAmount(remaining)}
          colorClass={remaining >= 0 ? "positive-number" : "negative-number"}
        />
      </div>
    </div>
  );
}
