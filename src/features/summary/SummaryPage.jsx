import React, { useState, useEffect, useMemo } from "react";
import { StorageService } from "../../services/storageService";
import { useSettings } from "../../context/settingsContext";
import IncomeForm from "./IncomeForm";
import FixedExpensesList from "../fixedExpenses/FixedExpensesList";
import SavingsForm from "./SavingsForm";
import SummarySection from "./SummarySection";
import ChartComponent from "../../components/charts/ChartComponent";

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

export default function SummaryPage({ expenses }) {
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [incomeRaw, setIncomeRaw] = useState("");
  const [incomeFreq, setIncomeFreq] = useState("monthly");
  const [savingsRate, setSavingsRate] = useState(0);
  const [fixedExpenses, setFixedExpenses] = useState([]);

  // Load persisted settings and fixed expenses on mount
  useEffect(() => {
    Promise.all([
      StorageService.getSetting("incomeAmount", ""),
      StorageService.getSetting("incomeFrequency", "monthly"),
      StorageService.getSetting("monthlyIncome", 0),
      StorageService.getSetting("savingsRate", 0),
      StorageService.getFixedExpenses(),
    ]).then(([amt, freq, monthly, rate, fixed]) => {
      setIncomeRaw(amt);
      setIncomeFreq(freq);
      setMonthlyIncome(monthly);
      setSavingsRate(rate);
      setFixedExpenses(fixed);
    });
  }, []);

  const handleIncomeSave = async ({
    income,
    frequency,
    monthlyIncome: monthly,
  }) => {
    await Promise.all([
      StorageService.setSetting("incomeAmount", income),
      StorageService.setSetting("incomeFrequency", frequency),
      StorageService.setSetting("monthlyIncome", monthly),
    ]);
    setIncomeRaw(income);
    setIncomeFreq(frequency);
    setMonthlyIncome(monthly);
  };

  const handleSavingsRateSave = async (rate) => {
    await StorageService.setSetting("savingsRate", rate);
    setSavingsRate(rate);
  };

  const handleAddFixed = async (item) => {
    await StorageService.addFixedExpense(item);
    setFixedExpenses(await StorageService.getFixedExpenses());
  };

  const handleUpdateFixed = async (id, changes) => {
    await StorageService.updateFixedExpense(id, changes);
    setFixedExpenses(await StorageService.getFixedExpenses());
  };

  const handleDeleteFixed = async (id) => {
    await StorageService.removeFixedExpense(id);
    setFixedExpenses((prev) => prev.filter((f) => f.id !== id));
  };

  // Derived values — memoized
  const totalFixed = useMemo(
    () => fixedExpenses.reduce((s, f) => s + f.amount, 0),
    [fixedExpenses],
  );

  const variableExpenses = useMemo(() => {
    const key = currentMonthKey();
    return expenses
      .filter((e) => e.date.startsWith(key))
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  const available = monthlyIncome - totalFixed;
  const savings = Math.max(0, available * (savingsRate / 100));

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
      <section className="bg-theme-surface rounded-theme-large shadow-sm p-4 card-theme">
        <SummarySection
          monthlyIncome={monthlyIncome}
          totalFixed={totalFixed}
          variableExpenses={variableExpenses}
          savingsRate={savingsRate}
        />
      </section>
      <h2 className="text-xs font-semibold text-theme-muted uppercase tracking-widest">
        Spending Breakdown
      </h2>
      <section className="bg-theme-surface rounded-theme-large shadow-sm p-4 card-theme">
        <ChartComponent
          totalFixed={totalFixed}
          variableExpenses={variableExpenses}
          savings={savings}
        />
      </section>
    </main>
  );
}
