import React, { useState, useEffect, useMemo } from "react";
import { StorageService } from "../../services/storageService";
import { useSettings } from "../../context/settingsContext";
import { getMonthlyFinancialSummary } from "../../utils/financeEngine";
import IncomeForm from "./IncomeForm";
import FixedExpensesList from "../fixedExpenses/FixedExpensesList";
import SavingsForm from "./SavingsForm";
import SummarySection from "./SummarySection";
import ChartComponent from "../../components/charts/ChartComponent";

export default function SummaryPage({ expenses }) {
  const [incomeRaw, setIncomeRaw] = useState("");
  const [incomeFreq, setIncomeFreq] = useState("monthly");
  const [savingsRate, setSavingsRate] = useState(0);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [financialSummary, setFinancialSummary] = useState(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Load persisted settings and compute via engine
  useEffect(() => {
    const load = async () => {
      const [
        amt,
        freq,
        monthly,
        rate,
        activeFixed,
        allFixed,
        snapshots,
        incomeRules,
        savingsRules,
      ] = await Promise.all([
        StorageService.getSetting("incomeAmount", ""),
        StorageService.getSetting("incomeFrequency", "monthly"),
        StorageService.getSetting("monthlyIncome", 0),
        StorageService.getSetting("savingsRate", 0),
        StorageService.getActiveFixedExpenses(),
        StorageService.getFixedExpenses(),
        StorageService.getSnapshotsForYear(currentYear),
        StorageService.getSetting("yearlyIncomeOverrides", {}),
        StorageService.getSetting("yearlySavingsOverrides", {}),
      ]);

      setIncomeRaw(amt);
      setIncomeFreq(freq);
      setSavingsRate(rate);
      setFixedExpenses(activeFixed);

      // Build virtual snapshots from active definitions for current month
      const virtualSnapshots = activeFixed.map((f) => ({
        fixedExpenseId: f.id,
        year: currentYear,
        month: currentMonth + 1,
        amountSnapshot: f.amount,
        nameSnapshot: f.name,
      }));

      const data = {
        expenses,
        snapshots: virtualSnapshots,
        fixedExpenses: allFixed,
        incomeRules,
        savingsRules,
        globalIncome: monthly,
        globalSavingsRate: rate,
      };

      const summary = getMonthlyFinancialSummary(currentYear, currentMonth, data);
      setFinancialSummary(summary);
    };
    load();
  }, [expenses, currentYear, currentMonth]);

  const handleIncomeSave = async ({
    income,
    frequency,
    monthlyIncome: monthly,
  }) => {
    const now = new Date();
    const existingSetAt = await StorageService.getSetting("monthlyIncomeSetAt", null);
    await Promise.all([
      StorageService.setSetting("incomeAmount", income),
      StorageService.setSetting("incomeFrequency", frequency),
      StorageService.setSetting("monthlyIncome", monthly),
      !existingSetAt && StorageService.setSetting("monthlyIncomeSetAt", { year: now.getFullYear(), month: now.getMonth() + 1 }),
    ].filter(Boolean));
    setIncomeRaw(income);
    setIncomeFreq(frequency);
    // Re-computation triggered by effect dependency on expenses (settings change will need refresh)
    // For simplicity, reload the page data
    const activeFixed = await StorageService.getActiveFixedExpenses();
    setFixedExpenses(activeFixed);
  };

  const handleSavingsRateSave = async (rate) => {
    const now = new Date();
    const existingSetAt = await StorageService.getSetting("savingsRateSetAt", null);
    await Promise.all([
      StorageService.setSetting("savingsRate", rate),
      !existingSetAt && StorageService.setSetting("savingsRateSetAt", { year: now.getFullYear(), month: now.getMonth() + 1 }),
    ].filter(Boolean));
    setSavingsRate(rate);
  };

  const handleAddFixed = async (item) => {
    await StorageService.addFixedExpense(item);
    setFixedExpenses(await StorageService.getActiveFixedExpenses());
  };

  const handleUpdateFixed = async (id, changes) => {
    await StorageService.updateFixedExpense(id, changes);
    setFixedExpenses(await StorageService.getActiveFixedExpenses());
  };

  const handleDeleteFixed = async (id) => {
    await StorageService.removeFixedExpense(id);
    setFixedExpenses((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
      <h1 className="text-xs font-semibold text-theme-muted uppercase tracking-widest">
        Summary
      </h1>
      <div className="grid sm:grid-cols-2 gap-4">
        <section className="bg-theme-surface rounded-theme-large shadow-sm p-4 card-theme">
          <IncomeForm
            income={incomeRaw}
            frequency={incomeFreq}
            onSave={handleIncomeSave}
          />
        </section>
        <section className="bg-theme-surface rounded-theme-large shadow-sm p-4 card-theme">
          <SavingsForm
            savingsRate={savingsRate}
            onSave={handleSavingsRateSave}
          />
        </section>
      </div>
      <section className="bg-theme-surface rounded-theme-large shadow-sm p-4 card-theme">
        <FixedExpensesList
          items={fixedExpenses}
          onAdd={handleAddFixed}
          onUpdate={handleUpdateFixed}
          onDelete={handleDeleteFixed}
        />
      </section>
      {financialSummary && (
        <section className="bg-theme-surface rounded-theme-large shadow-sm p-4 card-theme">
          <SummarySection summary={financialSummary} />
        </section>
      )}
      <h2 className="text-xs font-semibold text-theme-muted uppercase tracking-widest">
        Spending Breakdown
      </h2>
      {financialSummary && (
        <section className="bg-theme-surface rounded-theme-large shadow-sm p-4 card-theme">
          <ChartComponent
            totalFixed={financialSummary.fixedExpensesTotal}
            variableExpenses={financialSummary.variableExpenses}
            savings={financialSummary.autoSavings}
          />
        </section>
      )}
    </main>
  );
}
