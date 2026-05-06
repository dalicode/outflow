import { useState, useMemo, useEffect } from "react";
import { StorageService } from "../services/storageService";
import {
  getYearFinancialSummary,
  getYearVariableGrid,
} from "../utils/financeEngine";
import type {
  AnalyticsData,
  Expense,
  Category,
  Payee,
  YearSummary,
  VariableGridResult,
} from "../types";

interface UseAnalyticsDataParams {
  expenses: Expense[];
  categories: Category[];
  year: number;
}

export function useAnalyticsData({
  expenses,
  categories,
  year,
}: UseAnalyticsDataParams): AnalyticsData {
  const now = new Date();
  const [financials, setFinancials] = useState<YearSummary | null>(null);
  const [variableGrid, setVariableGrid] = useState<VariableGridResult | null>(null);
  const [payees, setPayees] = useState<Payee[]>([]);

  useEffect(() => {
    const load = async () => {
      const [
        snapshots,
        fixedDefs,
        globalIncome,
        globalRate,
        schedules,
        incomeSnaps,
        savingsSnaps,
        allPayees,
      ] = await Promise.all([
        StorageService.getSnapshotsForYear(year),
        StorageService.getFixedExpenses(),
        StorageService.getSetting("monthlyIncome", 0),
        StorageService.getSetting("savingsRate", 0),
        StorageService.getActiveSchedules(),
        StorageService.getIncomeSnapshotsForYear(year),
        StorageService.getSavingsSnapshotsForYear(year),
        StorageService.getPayees(),
      ]);

      const data: import("../types").FinanceEngineData = {
        expenses,
        snapshots,
        fixedExpenses: fixedDefs,
        globalIncome: (globalIncome as number | null) ?? 0,
        globalSavingsRate: (globalRate as number | null) ?? 0,
        schedules,
        incomeSnapshots: incomeSnaps,
        savingsSnapshots: savingsSnaps,
      };

      const fin = getYearFinancialSummary(year, data, {
        currentYear: now.getFullYear(),
        currentMonth: now.getMonth(),
      });
      setFinancials(fin);

      const vGrid = getYearVariableGrid(year, expenses, categories);
      setVariableGrid(vGrid);
      setPayees(allPayees);
    };
    load();
  }, [year, expenses, categories]);

  const monthlyHasData = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const monthStr = String(m + 1).padStart(2, "0");
      return expenses.some((e) => e.date?.startsWith(`${year}-${monthStr}`));
    });
  }, [year, expenses]);

  // Build payee breakdown rows — same shape as variableRows
  const payeeRows = useMemo(() => {
    const payeeById = new Map(payees.map((p) => [p.id, p.name]));
    const monthlyAmountsByPayee = new Map<string, number[]>();

    const yearExpenses = expenses.filter((e) =>
      e.date?.startsWith(`${year}-`),
    );

    for (const exp of yearExpenses) {
      const monthIdx = parseInt(exp.date.slice(5, 7), 10) - 1;
      if (monthIdx < 0 || monthIdx > 11) continue;
      const name = exp.payeeId != null
        ? (payeeById.get(exp.payeeId) ?? "Unknown")
        : "No Payee";
      if (!monthlyAmountsByPayee.has(name)) {
        monthlyAmountsByPayee.set(name, Array(12).fill(0));
      }
      monthlyAmountsByPayee.get(name)![monthIdx] += exp.amount;
    }

    return Array.from(monthlyAmountsByPayee.entries())
      .map(([name, amounts]) => ({
        key: name,
        name,
        amounts,
        yearTotal: amounts.reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.yearTotal - a.yearTotal);
  }, [year, expenses, payees]);

  return useMemo(() => {
    const isLoading = !financials || !variableGrid;
    if (!financials || !variableGrid) {
      return {
        loading: isLoading,
        year,
        monthlyIncome: Array(12).fill(0),
        variableRows: [],
        payeeRows: [],
        grid: {},
        fixedRows: [],
        monthlyFixedTotals: Array(12).fill(0),
        monthlyVariableTotals: Array(12).fill(0),
        monthlyTotals: Array(12).fill(0),
        monthlySavings: Array(12).fill(null),
        monthlyRemaining: Array(12).fill(null),
        monthlyTotalSavings: Array(12).fill(null),
        monthlySavingsRates: Array(12).fill(0),
        monthlySavingsPct: Array(12).fill(null),
        monthlyHasData,
        yearVariableTotal: 0,
        yearFixedTotal: 0,
        yearTotal: 0,
        yearSavings: 0,
        yearRemaining: 0,
        yearTotalIncome: 0,
        avgSavingsPct: 0,
        maxPerMonth: Array(12).fill(0),
      };
    }

    const isCurrentYear = year === now.getFullYear();
    const currentMonthIdx = now.getMonth();

    const monthsToCount = isCurrentYear
      ? financials.months.slice(0, currentMonthIdx + 1)
      : financials.months;

    const yearTotalIncome = monthsToCount.reduce((s, m) => s + m.income, 0);
    const yearFixedTotal = monthsToCount.reduce(
      (s, m) => s + m.fixedExpensesTotal,
      0,
    );
    const yearSavings = monthsToCount.reduce((s, m) => s + m.autoSavings, 0);
    const yearRemaining = monthsToCount.reduce((s, m) => s + m.remaining, 0);
    const yearVariableTotal = monthsToCount.reduce(
      (s, m) => s + m.variableExpenses,
      0,
    );

    return {
      loading: false,
      year,
      monthlyIncome: financials.months.map((m) => m.income),
      variableRows: variableGrid.variableRows,
      payeeRows,
      grid: variableGrid.grid,
      fixedRows: financials.fixedRows,
      monthlyFixedTotals: financials.monthlyFixedTotals,
      monthlyVariableTotals: financials.monthlyVariableTotals,
      monthlyTotals: financials.monthlyTotals,
      monthlySavings: financials.monthlySavings,
      monthlyRemaining: financials.monthlyRemaining,
      monthlyTotalSavings: financials.monthlyTotalSavings,
      monthlySavingsRates: financials.monthlySavingsRates,
      monthlySavingsPct: financials.monthlySavingsPct,
      monthlyHasData,
      yearVariableTotal,
      yearFixedTotal,
      yearTotal: yearFixedTotal + yearVariableTotal,
      yearSavings,
      yearRemaining,
      yearTotalIncome,
      avgSavingsPct: financials.totals.avgSavingsPct,
      maxPerMonth: variableGrid.maxPerMonth,
    };
  }, [year, financials, variableGrid, monthlyHasData, payeeRows]);
}
