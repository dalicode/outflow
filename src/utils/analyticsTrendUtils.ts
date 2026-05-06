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
    return sum + d.monthlyRemaining.reduce<number>((s, v) => s + (v ?? 0), 0);
  }, 0);

  let withinYearRunning = 0;

  for (let m = 0; m < monthCount; m++) {
    const remaining = data.monthlyRemaining[m] ?? 0;
    withinYearRunning += remaining;

    const monthKey = formatMonthKey(year, m);
    const income = data.monthlyIncome[m] ?? 0;
    const expensesTotal = data.monthlyTotals[m] ?? 0;
    const saved = data.monthlyTotalSavings[m] ?? 0;
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
