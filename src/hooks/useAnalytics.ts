import { useState, useMemo, useCallback, useEffect } from "react";
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
  FixedExpense,
  FixedExpenseSnapshot,
  IncomeSnapshot,
  SavingsSnapshot,
  Schedule,
} from "../types";

export interface AnalyticsSessionState {
  year: number;
  trendMonth: number | null;
  trendDrilldown: boolean;
}

interface UseAnalyticsParams {
  expenses: Expense[];
  categories: Category[];
  sessionState?: AnalyticsSessionState;
  onSessionStateChange?: (patch: Partial<AnalyticsSessionState>) => void;
}

// ---------------------------------------------------------------------------
// Shared DB state fetched once for all years
// ---------------------------------------------------------------------------
interface SharedAnalyticsDB {
  fixedDefs: FixedExpense[];
  allFixedSnaps: FixedExpenseSnapshot[];
  allIncomeSnaps: IncomeSnapshot[];
  allSavingsSnaps: SavingsSnapshot[];
  globalIncome: number;
  globalRate: number;
  schedules: Schedule[];
  payees: Payee[];
}

function makeEmptyAnalyticsData(year: number): AnalyticsData {
  return {
    loading: true,
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
    monthlyHasData: Array(12).fill(false),
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

function buildAnalyticsDataForYear(
  year: number,
  expenses: Expense[],
  categories: Category[],
  db: SharedAnalyticsDB,
  now: Date,
): AnalyticsData {
  const incomeSnaps = db.allIncomeSnaps.filter((s) => s.year === year);
  const savingsSnaps = db.allSavingsSnaps.filter((s) => s.year === year);
  const fixedSnaps = db.allFixedSnaps.filter((s) => s.year === year);

  const fin = getYearFinancialSummary(
    year,
    {
      expenses,
      snapshots: fixedSnaps,
      fixedExpenses: db.fixedDefs,
      globalIncome: db.globalIncome,
      globalSavingsRate: db.globalRate,
      schedules: db.schedules,
      incomeSnapshots: incomeSnaps,
      savingsSnapshots: savingsSnaps,
    },
    { currentYear: now.getFullYear(), currentMonth: now.getMonth() },
  );

  const vGrid = getYearVariableGrid(year, expenses, categories);

  const payeeById = new Map(db.payees.map((p) => [p.id, p.name]));
  const monthlyAmountsByPayee = new Map<string, number[]>();
  const yearExpenses = expenses.filter((e) => e.date?.startsWith(`${year}-`));
  for (const exp of yearExpenses) {
    const monthIdx = parseInt(exp.date.slice(5, 7), 10) - 1;
    if (monthIdx < 0 || monthIdx > 11) continue;
    const name =
      exp.payeeId != null
        ? (payeeById.get(exp.payeeId) ?? "Unknown")
        : "No Payee";
    if (!monthlyAmountsByPayee.has(name))
      monthlyAmountsByPayee.set(name, Array(12).fill(0));
    monthlyAmountsByPayee.get(name)![monthIdx] += exp.amount;
  }
  const payeeRows = Array.from(monthlyAmountsByPayee.entries())
    .map(([name, amounts]) => ({
      key: name,
      name,
      amounts,
      yearTotal: amounts.reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.yearTotal - a.yearTotal);

  const monthlyHasData = Array.from({ length: 12 }, (_, m) => {
    const monthStr = String(m + 1).padStart(2, "0");
    return expenses.some((e) => e.date?.startsWith(`${year}-${monthStr}`));
  });

  const isCurrentYear = year === now.getFullYear();
  const currentMonthIdx = now.getMonth();
  const monthsToCount = isCurrentYear
    ? fin.months.slice(0, currentMonthIdx + 1)
    : fin.months;

  return {
    loading: false,
    year,
    monthlyIncome: fin.months.map((m) => m.income),
    variableRows: vGrid.variableRows,
    payeeRows,
    grid: vGrid.grid,
    fixedRows: fin.fixedRows,
    monthlyFixedTotals: fin.monthlyFixedTotals,
    monthlyVariableTotals: fin.monthlyVariableTotals,
    monthlyTotals: fin.monthlyTotals,
    monthlySavings: fin.monthlySavings,
    monthlyRemaining: fin.monthlyRemaining,
    monthlyTotalSavings: fin.monthlyTotalSavings,
    monthlySavingsRates: fin.monthlySavingsRates,
    monthlySavingsPct: fin.monthlySavingsPct,
    monthlyHasData,
    yearVariableTotal: monthsToCount.reduce((s, m) => s + m.variableExpenses, 0),
    yearFixedTotal: monthsToCount.reduce((s, m) => s + m.fixedExpensesTotal, 0),
    yearTotal:
      monthsToCount.reduce((s, m) => s + m.fixedExpensesTotal, 0) +
      monthsToCount.reduce((s, m) => s + m.variableExpenses, 0),
    yearSavings: monthsToCount.reduce((s, m) => s + m.autoSavings, 0),
    yearRemaining: monthsToCount.reduce((s, m) => s + m.remaining, 0),
    yearTotalIncome: monthsToCount.reduce((s, m) => s + m.income, 0),
    avgSavingsPct: fin.totals.avgSavingsPct,
    maxPerMonth: vGrid.maxPerMonth,
  };
}

export function useAnalytics({
  expenses,
  categories,
  sessionState,
  onSessionStateChange,
}: UseAnalyticsParams) {
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [year, setYearState] = useState(sessionState?.year ?? currentYear);

  const setYear = useCallback(
    (newYear: number | ((prev: number) => number)) => {
      setYearState((prev) => {
        const next = typeof newYear === "function" ? newYear(prev) : newYear;
        onSessionStateChange?.({ year: next, trendMonth: null, trendDrilldown: false });
        return next;
      });
    },
    [onSessionStateChange],
  );

  const handleYearChange = useCallback(
    (newYear: number) => {
      setYear(newYear);
      onSessionStateChange?.({ year: newYear, trendMonth: null, trendDrilldown: false });
    },
    [setYear, onSessionStateChange],
  );

  // Derive the earliest year with expense data
  const earliestYear = useMemo(() => {
    let min = year;
    for (const e of expenses) {
      if (e.date) {
        const y = parseInt(e.date.slice(0, 4), 10);
        if (!isNaN(y) && y < min) min = y;
      }
    }
    return min;
  }, [expenses, year]);

  // All years to load: from earliestYear up to the selected year
  const yearsToLoad = useMemo(() => {
    const result: number[] = [];
    for (let y = earliestYear; y <= year; y++) result.push(y);
    return result;
  }, [earliestYear, year]);

  // Single DB fetch for all shared data
  const [db, setDb] = useState<SharedAnalyticsDB | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      StorageService.getFixedExpenses(),
      StorageService.getAllFixedExpenseSnapshots(),
      StorageService.getAllIncomeSnapshots(),
      StorageService.getAllSavingsSnapshots(),
      StorageService.getSetting("monthlyIncome", 0),
      StorageService.getSetting("savingsRate", 0),
      StorageService.getActiveSchedules(),
      StorageService.getPayees(),
    ]).then(
      ([fixedDefs, allFixedSnaps, allIncomeSnaps, allSavingsSnaps, globalIncome, globalRate, schedules, payees]) => {
        if (!cancelled) {
          setDb({
            fixedDefs: fixedDefs as FixedExpense[],
            allFixedSnaps: allFixedSnaps as FixedExpenseSnapshot[],
            allIncomeSnaps: allIncomeSnaps as IncomeSnapshot[],
            allSavingsSnaps: allSavingsSnaps as SavingsSnapshot[],
            globalIncome: (globalIncome as number | null) ?? 0,
            globalRate: (globalRate as number | null) ?? 0,
            schedules: schedules as Schedule[],
            payees: payees as Payee[],
          });
        }
      },
    );
    return () => { cancelled = true; };
  }, [expenses]); // re-fetch when expenses change (new data may have been saved)

  // Compute AnalyticsData for every year in one pass
  const multiYearData = useMemo<AnalyticsData[]>(() => {
    if (!db) return yearsToLoad.map(makeEmptyAnalyticsData);
    return yearsToLoad.map((y) =>
      buildAnalyticsDataForYear(y, expenses, categories, db, now),
    );
  }, [db, yearsToLoad, expenses, categories, now]);

  // The entry for the selected year
  const data = useMemo(
    () => multiYearData.find((d) => d.year === year) ?? makeEmptyAnalyticsData(year),
    [multiYearData, year],
  );

  const lastMonth =
    year === currentYear ? currentMonth : year < currentYear ? 11 : -1;

  return {
    year,
    handleYearChange,
    currentYear,
    currentMonth,
    canGoForward: year < currentYear,
    lastMonth,
    data,
    multiYearData,
    trendMonth: sessionState?.trendMonth ?? null,
    trendDrilldown: sessionState?.trendDrilldown ?? false,
  };
}
