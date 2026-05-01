import { useState, useEffect, useMemo, useCallback } from "react";
import { StorageService } from "../services/storageService";
import { getMonthlyFinancialSummary } from "../utils/financeEngine";
import type { Expense, FixedExpense, MonthlyFinancialSummary } from "../types";

interface UseSummaryParams {
  expenses: Expense[];
}

interface VariableBreakdownItem {
  name: string;
  amount: number;
  pct: number;
}

export function useSummary({ expenses }: UseSummaryParams) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [incomeRaw, setIncomeRaw] = useState("");
  const [incomeFreq, setIncomeFreq] = useState("monthly");
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [savingsRate, setSavingsRate] = useState(0);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [financialSummary, setFinancialSummary] =
    useState<MonthlyFinancialSummary | null>(null);

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
      setMonthlyIncome(monthly);
      setSavingsRate(rate);
      setFixedExpenses(activeFixed);

      const virtualSnapshots = activeFixed.map((f: FixedExpense) => ({
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
        globalIncome: monthly as number,
        globalSavingsRate: rate as number,
        schedules,
        incomeSnapshots: incomeSnaps,
        savingsSnapshots: savingsSnaps,
      };

      const summary = getMonthlyFinancialSummary(currentYear, currentMonth, data);
      setFinancialSummary(summary);
    };
    load();
  }, [expenses, currentYear, currentMonth]);

  const variableBreakdown = useMemo<VariableBreakdownItem[]>(() => {
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

  const handleIncomeSave = useCallback(
    async ({
      income,
      frequency,
      monthlyIncome: monthly,
    }: {
      income: string;
      frequency: string;
      monthlyIncome: number;
    }) => {
      const existingSetAt = await StorageService.getSetting(
        "monthlyIncomeSetAt",
        null,
      );
      await Promise.all(
        [
          StorageService.setSetting("incomeAmount", income),
          StorageService.setSetting("incomeFrequency", frequency),
          StorageService.setSetting("monthlyIncome", monthly),
          !existingSetAt &&
            StorageService.setSetting("monthlyIncomeSetAt", {
              year: now.getFullYear(),
              month: now.getMonth() + 1,
            }),
        ].filter(Boolean),
      );
      setIncomeRaw(income);
      setIncomeFreq(frequency);
      setMonthlyIncome(monthly);
      await StorageService.setIncomeSnapshot(
        now.getFullYear(),
        now.getMonth() + 1,
        monthly,
      );
      const activeFixed = await StorageService.getActiveFixedExpenses();
      setFixedExpenses(activeFixed);
    },
    [],
  );

  const handleSavingsRateSave = useCallback(async (rate: number) => {
    const existingSetAt = await StorageService.getSetting(
      "savingsRateSetAt",
      null,
    );
    await Promise.all(
      [
        StorageService.setSetting("savingsRate", rate),
        !existingSetAt &&
          StorageService.setSetting("savingsRateSetAt", {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
          }),
      ].filter(Boolean),
    );
    await StorageService.setSavingsSnapshot(
      now.getFullYear(),
      now.getMonth() + 1,
      rate,
    );
    setSavingsRate(rate);
  }, []);

  const handleAddFixed = useCallback(async (item: Omit<FixedExpense, "id">) => {
    await StorageService.addFixedExpense(item);
    setFixedExpenses(await StorageService.getActiveFixedExpenses());
  }, []);

  const handleUpdateFixed = useCallback(
    async (id: number, changes: Partial<FixedExpense>) => {
      await StorageService.updateFixedExpense(id, changes);
      setFixedExpenses(await StorageService.getActiveFixedExpenses());
    },
    [],
  );

  const handleDeleteFixed = useCallback(async (id: number) => {
    await StorageService.removeFixedExpense(id);
    setFixedExpenses((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return {
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
  };
}
