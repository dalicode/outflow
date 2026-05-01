import { useState } from "react";
import { useSummary } from "../../hooks/useSummary";
import IncomeForm from "./IncomeForm";
import FixedExpensesList from "../fixedExpenses/FixedExpensesList";
import SavingsForm from "./SavingsForm";
import SummarySection from "./SummarySection";
import ChartComponent from "../../components/charts/ChartComponent";
import BreakdownPie from "./BreakdownPie";
import Card from "../../components/ui/Card";
import type { Expense } from "../../types";
import "./summary.css";

type SliceType = "fixed" | "variable" | "savings";

interface SummaryPageProps {
  expenses: Expense[];
}

export default function SummaryPage({ expenses }: SummaryPageProps) {
  const [selectedSlice, setSelectedSlice] = useState<SliceType | null>(
    "variable",
  );

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

  const handleSliceClick = (slice: SliceType) => {
    setSelectedSlice((prev) => (prev === slice ? null : slice));
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-theme-text tracking-tight">
          Summary
        </h1>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <IncomeForm
            income={incomeRaw}
            frequency={incomeFreq}
            onSave={handleIncomeSave}
          />
        </Card>
        <Card>
          <SavingsForm
            savingsRate={savingsRate}
            monthlyIncome={monthlyIncome}
            onSave={handleSavingsRateSave}
          />
        </Card>
      </div>

      <Card>
        <FixedExpensesList
          items={fixedExpenses}
          onAdd={handleAddFixed}
          onUpdate={handleUpdateFixed}
          onDelete={handleDeleteFixed}
        />
      </Card>

      {financialSummary && (
        <Card>
          <SummarySection summary={financialSummary} />
        </Card>
      )}

      {financialSummary && (
        <Card>
          <ChartComponent
            totalFixed={financialSummary.fixedExpensesTotal}
            variableExpenses={financialSummary.variableExpenses}
            savings={financialSummary.autoSavings + financialSummary.remaining}
            onSliceClick={handleSliceClick}
            activeSlice={selectedSlice}
          />
        </Card>
      )}

      {financialSummary && selectedSlice && (
        <Card>
          <BreakdownPie
            type={selectedSlice}
            financialSummary={financialSummary}
            variableBreakdown={variableBreakdown}
          />
        </Card>
      )}
    </main>
  );
}
