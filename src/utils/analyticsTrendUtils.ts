/**
 * analyticsTrendUtils.ts
 * ──────────────────────
 * Pure utility functions for the Income Trend drilldown feature.
 * No React, no Dexie, no side effects — all functions take plain data
 * and return plain data.
 *
 * Data sources:
 *   - AnalyticsData arrays are 0-indexed (index 0 = January)
 *   - monthlyTotals = fixed + variable expenses
 *   - monthlyTotalSavings = autoSavings + remaining
 *   - monthlySavingsPct = (totalSavings / income) × 100, or null when income = 0
 */

import type { AnalyticsData, Expense } from "../types";

// ── Short month labels ────────────────────────────────────────────────────────

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

// ── Interfaces ────────────────────────────────────────────────────────────────

/**
 * One row of data for the year-level Income Trend chart.
 * One row per visible month (Jan–Dec for past years, Jan–current for current year).
 */
export interface YearTrendRow {
  /** 0-indexed (0 = January, 11 = December) */
  monthIndex: number;
  /** "YYYY-MM" format, e.g. "2026-05" */
  monthKey: string;
  /** Short month name, e.g. "May" */
  monthLabel: string;
  /** Resolved monthly income (from snapshot → schedule → global setting) */
  income: number;
  /** Total expenses = fixed + variable */
  expenses: number;
  /** Total savings = autoSavings + remaining */
  saved: number;
  /** (saved / income) × 100, or null when income is 0 */
  savingsRate: number | null;
  /** Number of raw expense records in this month */
  expenseCount: number;
  /** True if monthlyHasData[monthIndex] is true */
  hasData: boolean;
  /** Cumulative cash flow from all time up to this month */
  cumulativeRemaining: number;
}

/**
 * One row of daily spending data for the month drilldown chart.
 * Only days with at least one expense are included.
 */
export interface DailySpendingRow {
  /** Day of month, 1–31 */
  day: number;
  /** Full ISO date string, e.g. "2026-05-15" */
  date: string;
  /** Sum of expense amounts on this day */
  dailySpent: number;
  /** Number of expense records on this day */
  expenseCount: number;
  /** Running cumulative total from day 1 to this day */
  cumulativeSpent: number;
}

/**
 * One row of category breakdown for the month drilldown.
 */
export interface CategoryBreakdownRow {
  name: string;
  amount: number;
  /** amount / totalExpenses × 100; 0 if totalExpenses is 0 */
  pct: number;
}

/**
 * One row of payee breakdown for the month drilldown.
 */
export interface PayeeBreakdownRow {
  name: string;
  amount: number;
  /** amount / totalPayeeExpenses × 100; 0 if total is 0 */
  pct: number;
}

/**
 * Full data bundle for the month drilldown view.
 * Assembled by buildMonthDrilldownData().
 */
export interface MonthDrilldownData {
  /** "YYYY-MM" format */
  monthKey: string;
  /** Short month name, e.g. "May" */
  monthLabel: string;
  year: number;
  /** 0-indexed */
  monthIndex: number;
  income: number;
  expenses: number;
  saved: number;
  savingsRate: number | null;
  dailyRows: DailySpendingRow[];
  categoryBreakdown: CategoryBreakdownRow[];
  /** Empty array if no payee data exists */
  payeeBreakdown: PayeeBreakdownRow[];
  /** Top 20 expenses by amount descending */
  expensePreview: Expense[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function getVisibleMonthCount(
  year: number,
  currentYear: number,
  currentMonth: number,
): number {
  if (year > currentYear) return 0;
  if (year === currentYear) return currentMonth + 1;
  return 12;
}

// ── Exported utilities ────────────────────────────────────────────────────────

/**
 * Returns a "YYYY-MM" string for a given year and 0-indexed month.
 *
 * @example formatMonthKey(2026, 4) → "2026-05"
 */
export function formatMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/**
 * Returns the short month label for a 0-indexed month.
 *
 * @example getMonthLabelFromIndex(4) → "May"
 */
export function getMonthLabelFromIndex(monthIndex: number): string {
  return MONTH_LABELS[monthIndex] ?? "";
}

/**
 * Returns savings rate as a percentage (0–100+), or null if income is 0.
 * Does NOT clamp — savings can exceed income (e.g. refund months).
 */
export function getSavingsRate(
  income: number,
  totalSavings: number,
): number | null {
  if (income === 0) return null;
  return (totalSavings / income) * 100;
}

/**
 * Builds the array of YearTrendRow for the year-level Income Trend chart.
 * Only includes months up to the current month for the current year.
 * Returns an empty array for future years.
 */
export function buildYearTrendRows(
  data: AnalyticsData,
  expenses: Expense[],
  year: number,
  currentYear: number,
  currentMonth: number,
  priorYearsData?: AnalyticsData[],
): YearTrendRow[] {
  const monthCount = getVisibleMonthCount(year, currentYear, currentMonth);
  const rows: YearTrendRow[] = [];

  const priorYearsBaseline = (priorYearsData ?? []).reduce((sum, d) => {
    if (d.loading) return sum;
    return sum + d.monthlyTotalSavings.reduce<number>((s, v) => s + (v ?? 0), 0);
  }, 0);

  let withinYearRunning = 0;

  for (let m = 0; m < monthCount; m++) {
    const saved = data.monthlyTotalSavings[m] ?? 0;
    withinYearRunning += saved;

    const monthKey = formatMonthKey(year, m);
    const income = data.monthlyIncome[m] ?? 0;
    const expensesTotal = data.monthlyTotals[m] ?? 0;
    // saved already declared above for the running total
    // Prefer pre-computed savingsPct from AnalyticsData; fall back to computing it
    const rawPct = data.monthlySavingsPct[m];
    const savingsRate =
      income === 0
        ? null
        : rawPct != null
          ? rawPct
          : getSavingsRate(income, saved);
    const hasData = data.monthlyHasData[m] ?? false;

    // Count raw expense records for this month
    const expenseCount = expenses.filter((e) =>
      e.date?.startsWith(monthKey),
    ).length;

    rows.push({
      monthIndex: m,
      monthKey,
      monthLabel: getMonthLabelFromIndex(m),
      income,
      expenses: expensesTotal,
      saved,
      savingsRate,
      expenseCount,
      hasData,
      cumulativeRemaining: priorYearsBaseline + withinYearRunning,
    });
  }

  return rows;
}

/**
 * Builds daily spending rows for the month drilldown chart.
 * Only includes days that have at least one expense.
 * Rows are sorted by date ascending with a running cumulative total.
 */
export function buildDailySpendingRows(
  expenses: Expense[],
  year: number,
  monthIndex: number,
): DailySpendingRow[] {
  const monthKey = formatMonthKey(year, monthIndex);

  // Filter to this month only
  const monthExpenses = expenses.filter((e) => e.date?.startsWith(monthKey));

  // Group by date
  const byDate = new Map<string, { dailySpent: number; expenseCount: number }>();
  for (const expense of monthExpenses) {
    const date = expense.date;
    if (!date) continue;
    const existing = byDate.get(date) ?? { dailySpent: 0, expenseCount: 0 };
    byDate.set(date, {
      dailySpent: existing.dailySpent + (expense.amount ?? 0),
      expenseCount: existing.expenseCount + 1,
    });
  }

  // Sort by date ascending and build rows with cumulative total
  const sortedDates = Array.from(byDate.keys()).sort();
  let cumulative = 0;
  const rows: DailySpendingRow[] = [];

  for (const date of sortedDates) {
    const { dailySpent, expenseCount } = byDate.get(date)!;
    cumulative += dailySpent;
    // Parse day from "YYYY-MM-DD" → last two chars
    const day = parseInt(date.slice(8, 10), 10);
    rows.push({
      day,
      date,
      dailySpent,
      expenseCount,
      cumulativeSpent: cumulative,
    });
  }

  return rows;
}

/**
 * Builds category breakdown rows for a specific month.
 * Uses pre-computed variableRows from AnalyticsData (no re-aggregation needed).
 * Excludes categories with zero spend for the month.
 * Sorted by amount descending.
 */
export function buildCategoryBreakdown(
  data: AnalyticsData,
  monthIndex: number,
): CategoryBreakdownRow[] {
  const rows: CategoryBreakdownRow[] = [];

  for (const row of data.variableRows) {
    const amount = row.amounts?.[monthIndex] ?? 0;
    if (amount <= 0) continue;
    rows.push({ name: row.name, amount, pct: 0 });
  }

  rows.sort((a, b) => b.amount - a.amount);

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  if (total > 0) {
    for (const row of rows) {
      row.pct = (row.amount / total) * 100;
    }
  }

  return rows;
}

/**
 * Builds payee breakdown rows for a specific month.
 * Returns an empty array if no payee data exists.
 * Sorted by amount descending.
 */
export function buildPayeeBreakdown(
  data: AnalyticsData,
  monthIndex: number,
): PayeeBreakdownRow[] {
  if (!data.payeeRows || data.payeeRows.length === 0) return [];

  const rows: PayeeBreakdownRow[] = [];

  for (const row of data.payeeRows) {
    const amount = row.amounts?.[monthIndex] ?? 0;
    if (amount <= 0) continue;
    rows.push({ name: row.name, amount, pct: 0 });
  }

  rows.sort((a, b) => b.amount - a.amount);

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  if (total > 0) {
    for (const row of rows) {
      row.pct = (row.amount / total) * 100;
    }
  }

  return rows;
}

/**
 * Assembles the full data bundle for the month drilldown view.
 * Call this when the user presses "View {Month}".
 */
export function buildMonthDrilldownData(
  data: AnalyticsData,
  expenses: Expense[],
  year: number,
  monthIndex: number,
): MonthDrilldownData {
  const monthKey = formatMonthKey(year, monthIndex);
  const income = data.monthlyIncome[monthIndex] ?? 0;
  const expensesTotal = data.monthlyTotals[monthIndex] ?? 0;
  const saved = data.monthlyTotalSavings[monthIndex] ?? 0;
  const savingsRate = income === 0 ? null : getSavingsRate(income, saved);

  // Top 20 expenses by amount descending
  const expensePreview = expenses
    .filter((e) => e.date?.startsWith(monthKey))
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, 20);

  return {
    monthKey,
    monthLabel: getMonthLabelFromIndex(monthIndex),
    year,
    monthIndex,
    income,
    expenses: expensesTotal,
    saved,
    savingsRate,
    dailyRows: buildDailySpendingRows(expenses, year, monthIndex),
    categoryBreakdown: buildCategoryBreakdown(data, monthIndex),
    payeeBreakdown: buildPayeeBreakdown(data, monthIndex),
    expensePreview,
  };
}

/**
 * Flattens all years of AnalyticsData into a single chronological array
 * for use as the full-history dataset in the brush mini-timeline.
 *
 * Each entry has a "MMM YY" label (e.g. "Jan 24") and the cumulative
 * remaining at that point in time. Prior-year saved is attached per point
 * so the comparison lines work across any brushed window.
 */
export interface AllTimeRow {
  /** "MMM YY" display label, e.g. "Jan 24" */
  label: string;
  /** Short month name, e.g. "Jan" */
  monthLabel: string;
  /** "YYYY-MM" key for identifying the month */
  monthKey: string;
  /** 0-indexed month within its year */
  monthIndex: number;
  year: number;
  cumulativeRemaining: number;
  saved: number;
  /** saved amount for the same month in the prior year, or null */
  priorSaved: number | null;
  /** saved - priorSaved, or null */
  savedDelta: number | null;
  income: number;
  expenses: number;
  savingsRate: number | null;
  hasData: boolean;
}

export function buildAllYearsTrendRows(
  allYearsData: Array<{ year: number; data: AnalyticsData }>,
  currentYear: number,
  currentMonth: number,
): AllTimeRow[] {
  const rows: AllTimeRow[] = [];
  let runningCumulative = 0;

  // Sort years ascending
  const sorted = [...allYearsData].sort((a, b) => a.year - b.year);

  // Build a lookup: year → monthIndex → saved, for prior-year attachment
  const savedByYearMonth = new Map<string, number>();

  for (const { year, data } of sorted) {
    if (data.loading) continue;
    const monthCount = getVisibleMonthCount(year, currentYear, currentMonth);
    for (let m = 0; m < monthCount; m++) {
      const saved = data.monthlyTotalSavings[m] ?? 0;
      savedByYearMonth.set(`${year}-${m}`, saved);
    }
  }

  for (const { year, data } of sorted) {
    if (data.loading) continue;
    const monthCount = getVisibleMonthCount(year, currentYear, currentMonth);
    for (let m = 0; m < monthCount; m++) {
      const saved = data.monthlyTotalSavings[m] ?? 0;
      runningCumulative += saved;
      const monthKey = formatMonthKey(year, m);
      const income = data.monthlyIncome[m] ?? 0;
      // saved already declared above for the running total
      const rawPct = data.monthlySavingsPct[m];
      const savingsRate =
        income === 0
          ? null
          : rawPct != null
            ? rawPct
            : getSavingsRate(income, saved);
      const shortYear = String(year).slice(2);

      const priorSaved = savedByYearMonth.get(`${year - 1}-${m}`) ?? null;
      const savedDelta = priorSaved != null ? saved - priorSaved : null;

      rows.push({
        label: `${MONTH_LABELS[m]} ${shortYear}`,
        monthLabel: MONTH_LABELS[m],
        monthKey,
        monthIndex: m,
        year,
        cumulativeRemaining: runningCumulative,
        saved,
        priorSaved,
        savedDelta,
        income,
        expenses: data.monthlyTotals[m] ?? 0,
        savingsRate,
        hasData: data.monthlyHasData[m] ?? false,
      });
    }
  }

  return rows;
}

/**
 * Builds a synthetic AnalyticsData from a slice of AllTimeRows (the brush window).
 * The result has monthly arrays re-indexed 0..N-1 for the visible months,
 * with year totals re-aggregated across the range.
 *
 * variableRows and payeeRows are merged across years — same category/payee key
 * gets its amounts concatenated in chronological order.
 */
export function buildRangeAnalyticsData(
  window: AllTimeRow[],
  allYearsData: Array<{ year: number; data: AnalyticsData }>,
): AnalyticsData {
  if (window.length === 0) {
    return {
      loading: false,
      year: 0,
      monthlyIncome: [],
      variableRows: [],
      payeeRows: [],
      grid: {},
      fixedRows: [],
      monthlyFixedTotals: [],
      monthlyVariableTotals: [],
      monthlyTotals: [],
      monthlySavings: [],
      monthlyRemaining: [],
      monthlyTotalSavings: [],
      monthlySavingsRates: [],
      monthlySavingsPct: [],
      monthlyHasData: [],
      yearVariableTotal: 0,
      yearFixedTotal: 0,
      yearTotal: 0,
      yearSavings: 0,
      yearRemaining: 0,
      yearTotalIncome: 0,
      avgSavingsPct: 0,
      maxPerMonth: [],
    };
  }

  // Build lookup: year → AnalyticsData
  const dataByYear = new Map(allYearsData.map((d) => [d.year, d.data]));

  const n = window.length;
  const monthlyIncome: number[] = new Array(n).fill(0);
  const monthlyFixedTotals: number[] = new Array(n).fill(0);
  const monthlyVariableTotals: number[] = new Array(n).fill(0);
  const monthlyTotals: number[] = new Array(n).fill(0);
  const monthlySavings: (number | null)[] = new Array(n).fill(null);
  const monthlyRemaining: (number | null)[] = new Array(n).fill(null);
  const monthlyTotalSavings: (number | null)[] = new Array(n).fill(null);
  const monthlySavingsRates: number[] = new Array(n).fill(0);
  const monthlySavingsPct: (number | null)[] = new Array(n).fill(null);
  const monthlyHasData: boolean[] = new Array(n).fill(false);
  const maxPerMonth: number[] = new Array(n).fill(0);

  // Per-category and per-payee amounts across the window
  const varMap = new Map<string, { name: string; amounts: number[] }>();
  const payeeMap = new Map<string, { name: string; amounts: number[] }>();
  const fixedMap = new Map<string, { id: string; name: string; amounts: number[]; isArchived: boolean }>();

  for (let i = 0; i < n; i++) {
    const row = window[i];
    const yearData = dataByYear.get(row.year);
    if (!yearData) continue;
    const m = row.monthIndex;

    monthlyIncome[i] = yearData.monthlyIncome[m] ?? 0;
    monthlyFixedTotals[i] = yearData.monthlyFixedTotals[m] ?? 0;
    monthlyVariableTotals[i] = yearData.monthlyVariableTotals[m] ?? 0;
    monthlyTotals[i] = yearData.monthlyTotals[m] ?? 0;
    monthlySavings[i] = yearData.monthlySavings[m] ?? null;
    monthlyRemaining[i] = yearData.monthlyRemaining[m] ?? null;
    monthlyTotalSavings[i] = yearData.monthlyTotalSavings[m] ?? null;
    monthlySavingsRates[i] = yearData.monthlySavingsRates[m] ?? 0;
    monthlySavingsPct[i] = yearData.monthlySavingsPct[m] ?? null;
    monthlyHasData[i] = yearData.monthlyHasData[m] ?? false;
    maxPerMonth[i] = yearData.maxPerMonth[m] ?? 0;

    // Variable rows
    for (const vr of yearData.variableRows) {
      if (!varMap.has(vr.key)) {
        varMap.set(vr.key, { name: vr.name, amounts: new Array(n).fill(0) });
      }
      varMap.get(vr.key)!.amounts[i] = vr.amounts[m] ?? 0;
    }

    // Payee rows
    for (const pr of yearData.payeeRows) {
      if (!payeeMap.has(pr.key)) {
        payeeMap.set(pr.key, { name: pr.name, amounts: new Array(n).fill(0) });
      }
      payeeMap.get(pr.key)!.amounts[i] = pr.amounts[m] ?? 0;
    }

    // Fixed rows
    for (const fr of yearData.fixedRows) {
      if (!fixedMap.has(fr.id)) {
        fixedMap.set(fr.id, {
          id: fr.id,
          name: fr.name,
          amounts: new Array(n).fill(0),
          isArchived: fr.isArchived,
        });
      }
      fixedMap.get(fr.id)!.amounts[i] = fr.amounts[m] ?? 0;
    }
  }

  const variableRows = Array.from(varMap.entries()).map(([key, v]) => ({
    key,
    name: v.name,
    amounts: v.amounts,
    yearTotal: v.amounts.reduce((s, a) => s + a, 0),
  }));

  const payeeRows = Array.from(payeeMap.entries()).map(([key, v]) => ({
    key,
    name: v.name,
    amounts: v.amounts,
    yearTotal: v.amounts.reduce((s, a) => s + a, 0),
  }));

  const fixedRows = Array.from(fixedMap.values()).map((fr) => ({
    ...fr,
    yearTotal: fr.amounts.reduce((s, a) => s + a, 0),
  }));

  const yearTotalIncome = monthlyIncome.reduce((s, v) => s + v, 0);
  const yearFixedTotal = monthlyFixedTotals.reduce((s, v) => s + v, 0);
  const yearVariableTotal = monthlyVariableTotals.reduce((s, v) => s + v, 0);
  const yearTotal = monthlyTotals.reduce((s, v) => s + v, 0);
  const yearSavings = (monthlySavings as number[]).reduce((s, v) => s + (v ?? 0), 0);
  const yearRemaining = (monthlyRemaining as number[]).reduce((s, v) => s + (v ?? 0), 0);
  const validPcts = (monthlySavingsPct as (number | null)[]).filter((v): v is number => v != null);
  const avgSavingsPct = validPcts.length > 0
    ? validPcts.reduce((s, v) => s + v, 0) / validPcts.length
    : 0;

  return {
    loading: false,
    year: window[window.length - 1].year,
    monthlyIncome,
    variableRows,
    payeeRows,
    grid: {},
    fixedRows,
    monthlyFixedTotals,
    monthlyVariableTotals,
    monthlyTotals,
    monthlySavings,
    monthlyRemaining,
    monthlyTotalSavings,
    monthlySavingsRates,
    monthlySavingsPct,
    monthlyHasData,
    yearVariableTotal,
    yearFixedTotal,
    yearTotal,
    yearSavings,
    yearRemaining,
    yearTotalIncome,
    avgSavingsPct,
    maxPerMonth,
  };
}
