import { useState, useEffect, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { StorageService } from "../../services/storageService";
import { useSettings } from "../../context/settingsContext";
import { getMonthlyFinancialSummary } from "../../utils/financeEngine";
import IncomeForm from "./IncomeForm";
import FixedExpensesList from "../fixedExpenses/FixedExpensesList";
import SavingsForm from "./SavingsForm";
import SummarySection from "./SummarySection";
import ChartComponent from "../../components/charts/ChartComponent";
import Card from "../../components/ui/Card";

type SliceType = "fixed" | "variable" | "savings";

function BreakdownPie({ type, financialSummary, variableBreakdown }) {
  const { currency, currentTheme } = useSettings();

  const data = useMemo(() => {
    if (type === "fixed") {
      return financialSummary.fixedExpenses
        .map((item) => ({ name: item.name, value: item.amount }))
        .filter((d) => d.value > 0);
    }
    if (type === "variable") {
      return variableBreakdown
        .map((item) => ({ name: item.name, value: item.amount }))
        .filter((d) => d.value > 0);
    }
    return [
      { name: "Auto Savings", value: financialSummary.autoSavings },
      { name: "Remaining", value: financialSummary.remaining },
    ];
  }, [type, financialSummary, variableBreakdown]);

  const baseColors = [
    currentTheme.colors.primary,
    currentTheme.colors.secondary,
    currentTheme.colors.success,
    currentTheme.colors.danger,
    currentTheme.colors.muted,
  ];

  // Pie charts cannot render negative slices — switch to text list for negative remaining
  const hasNegative = data.some((d) => d.value < 0);

  if (hasNegative) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-theme-danger font-medium">
          Budget exceeded — overspend detected
        </p>
        {data.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between py-1.5 border-b border-theme-border/30 last:border-0"
          >
            <span className="text-sm text-theme-text">{item.name}</span>
            <span
              className={`text-sm font-medium tabular-nums ${
                item.value < 0 ? "text-theme-danger" : "text-theme-text"
              }`}
            >
              {currency(item.value)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between py-1.5 border-t border-theme-border/50 pt-2">
          <span className="text-sm font-medium text-theme-text">Total Savings</span>
          <span className="text-sm font-bold tabular-nums text-theme-success">
            {currency(financialSummary.autoSavings + financialSummary.remaining)}
          </span>
        </div>
      </div>
    );
  }

  const positiveData = data.filter((d) => d.value > 0);

  if (positiveData.length === 0) {
    return (
      <p className="text-sm text-theme-muted text-center py-6">
        No data to display.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={positiveData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {positiveData.map((_, i) => (
              <Cell key={i} fill={baseColors[i % baseColors.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => currency(v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function SummaryPage({ expenses }) {
  const [incomeRaw, setIncomeRaw] = useState("");
  const [incomeFreq, setIncomeFreq] = useState("monthly");
  const [savingsRate, setSavingsRate] = useState(0);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [selectedSlice, setSelectedSlice] = useState<SliceType | null>("variable");

  const { currency, currentTheme } = useSettings();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

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
        schedules,
        incomeSnaps,
        savingsSnaps,
      ] = await Promise.all([
        StorageService.getSetting("incomeAmount", ""),
        StorageService.getSetting("incomeFrequency", "monthly"),
        StorageService.getSetting("monthlyIncome", 0),
        StorageService.getSetting("savingsRate", 0),
        StorageService.getActiveFixedExpenses(),
        StorageService.getFixedExpenses(),
        StorageService.getSnapshotsForYear(currentYear),
        StorageService.getActiveSchedules(),
        StorageService.getIncomeSnapshotsForYear(currentYear),
        StorageService.getSavingsSnapshotsForYear(currentYear),
      ]);

      setIncomeRaw(amt);
      setIncomeFreq(freq);
      setSavingsRate(rate);
      setFixedExpenses(activeFixed);

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
        globalIncome: monthly,
        globalSavingsRate: rate,
        schedules,
        incomeSnapshots: incomeSnaps,
        savingsSnapshots: savingsSnaps,
      };

      const summary = getMonthlyFinancialSummary(currentYear, currentMonth, data);
      setFinancialSummary(summary);
    };
    load();
  }, [expenses, currentYear, currentMonth]);

  const variableBreakdown = useMemo(() => {
    const monthStr = String(currentMonth + 1).padStart(2, "0");
    const prefix = `${currentYear}-${monthStr}`;
    const monthExpenses = expenses.filter((e) => e.date?.startsWith(prefix));

    const byCategory: Record<string, number> = {};
    monthExpenses.forEach((e) => {
      const key = e.category || "Uncategorized";
      byCategory[key] = (byCategory[key] || 0) + (e.amount || 0);
    });

    const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
    return Object.entries(byCategory)
      .map(([name, amount]) => ({
        name,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, currentYear, currentMonth]);

  const handleIncomeSave = async ({ income, frequency, monthlyIncome: monthly }) => {
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
    await StorageService.setIncomeSnapshot(now.getFullYear(), now.getMonth() + 1, monthly);
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
    await StorageService.setSavingsSnapshot(now.getFullYear(), now.getMonth() + 1, rate);
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

  const handleSliceClick = (slice: SliceType) => {
    setSelectedSlice((prev) => (prev === slice ? null : slice));
  };

  const sliceTitle = {
    fixed: "Fixed Breakdown",
    variable: "Variable Breakdown",
    savings: "Savings Breakdown",
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-theme-text tracking-tight">Summary</h1>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card title="Income">
          <IncomeForm income={incomeRaw} frequency={incomeFreq} onSave={handleIncomeSave} />
        </Card>
        <Card title="Savings Rate">
          <SavingsForm savingsRate={savingsRate} onSave={handleSavingsRateSave} />
        </Card>
      </div>

      <Card title="Fixed Expenses">
        <FixedExpensesList
          items={fixedExpenses}
          onAdd={handleAddFixed}
          onUpdate={handleUpdateFixed}
          onDelete={handleDeleteFixed}
        />
      </Card>

      {financialSummary && (
        <Card title="Monthly Overview">
          <SummarySection summary={financialSummary} />
        </Card>
      )}

      {financialSummary && (
        <Card title="Spending Breakdown">
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
        <Card title={sliceTitle[selectedSlice]}>
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
