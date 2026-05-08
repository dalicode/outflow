import { useSummary } from "../../hooks/useSummary";
import IncomeForm from "./IncomeForm";
import FixedExpensesList from "../fixedExpenses/FixedExpensesList";
import SavingsForm from "./SavingsForm";
import BudgetFlow from "./BudgetFlow";
import BudgetPaceSection from "./BudgetPaceSection";
import SpendingBreakdown from "./SpendingBreakdown";
import type { Expense } from "../../types";
import "./summary.css";

interface SummaryPageProps {
  expenses: Expense[];
}

export default function SummaryPage({ expenses }: SummaryPageProps) {
  const {
    incomeRaw,
    incomeFreq,
    monthlyIncome,
    savingsRate,
    fixedExpenses,
    financialSummary,
    variableBreakdown,
    handleIncomeSave,
    handleSavingsRateSave,
    handleAddFixed,
    handleUpdateFixed,
    handleDeleteFixed,
  } = useSummary({ expenses });

  const incomeIsSet = parseFloat(String(incomeRaw || 0)) > 0;

  return (
    <main
      className="max-w-4xl w-full mx-auto px-4 py-6 space-y-6"
      data-testid="summary-page"
    >
      <h1 className="text-2xl font-bold text-theme-text tracking-tight">
        Budget
      </h1>
      <div className="space-y-4 md:max-w-3xl mx-auto">
        {!incomeIsSet && (
          <div className="rounded-theme-large border border-dashed border-theme-border bg-theme-surface p-5 text-center space-y-1">
            <p className="text-sm font-medium text-theme-text">
              Set up your budget
            </p>
            <p className="text-xs text-theme-muted">
              Add your income below to see your budget breakdown.
            </p>
          </div>
        )}

        <div className="rounded-theme-large border border-theme-border bg-theme-surface p-4 md:p-5">
          <IncomeForm
            income={incomeRaw}
            frequency={incomeFreq}
            onSave={handleIncomeSave}
          />
        </div>

        <div className="rounded-theme-large border border-theme-border bg-theme-surface p-4 md:p-5">
          <SavingsForm
            savingsRate={savingsRate}
            monthlyIncome={monthlyIncome}
            onSave={handleSavingsRateSave}
          />
        </div>

        <div className="rounded-theme-large border border-theme-border bg-theme-surface p-4 md:p-5">
          <FixedExpensesList
            items={fixedExpenses}
            onAdd={handleAddFixed}
            onUpdate={handleUpdateFixed}
            onDelete={handleDeleteFixed}
          />
        </div>

        {financialSummary && incomeIsSet && (
          <BudgetFlow
            summary={financialSummary}
            variableBreakdown={variableBreakdown}
          />
        )}

        {financialSummary && (
          <BudgetPaceSection expenses={expenses} summary={financialSummary} />
        )}

        {variableBreakdown.length > 0 && (
          <SpendingBreakdown
            items={variableBreakdown}
            total={financialSummary?.variableExpenses ?? 0}
          />
        )}
      </div>
    </main>
  );
}
