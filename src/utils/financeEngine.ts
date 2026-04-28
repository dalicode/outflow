/**
 * Financial Timeline Engine
 * ─────────────────────────
 * Pure, framework-agnostic financial computation layer.
 * All income, savings, fixed-expense, and budget calculations live here.
 *
 * RULES
 * - No side effects (no DB writes, no network, no DOM)
 * - No React hooks or UI logic
 * - Identical inputs → identical outputs everywhere
 * - Legacy data formats auto-migrated on read
 */

import type { Expense, FixedExpense, FixedExpenseSnapshot, Schedule, FinanceEngineData, MonthlySummary, YearSummary, VariableGridResult } from "../types";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Apply active schedules for a given type to a month map.
 * Only affects current and future months.
 */
function applySchedules(monthValues: number[], year: number, schedules: Schedule[], scheduleType: string): number[] {
  if (!schedules || schedules.length === 0) return monthValues;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const applicable = schedules
    .filter((s) => s.isActive && s.type === scheduleType)
    .filter((s) => s.effectiveYear < year || (s.effectiveYear === year && s.effectiveMonth <= 12))
    .sort((a, b) => {
      if (a.effectiveYear !== b.effectiveYear) return a.effectiveYear - b.effectiveYear;
      return a.effectiveMonth - b.effectiveMonth;
    });

  if (applicable.length === 0) return monthValues;

  const result = [...monthValues];
  for (let m = 0; m < 12; m++) {
    const monthNum = m + 1;
    const isFutureOrCurrent =
      year > currentYear || (year === currentYear && monthNum >= currentMonth);
    if (!isFutureOrCurrent) continue;

    // Find the latest schedule effective on or before this month
    const latest = applicable
      .filter(
        (s) =>
          s.effectiveYear < year ||
          (s.effectiveYear === year && s.effectiveMonth <= monthNum),
      )
      .pop();

    if (latest) {
      result[m] = latest.newValue;
    }
  }
  return result;
}

/**
 * Resolve per-month values for a year from rules + global fallback + schedules.
 * Handles legacy {2023: 5000} → auto-expands to 12 months.
 */
function resolveMonthlyValues(
  year: number,
  rules: Record<string, number | Record<number, number>> | undefined,
  globalValue: number,
  schedules: Schedule[] | undefined,
  scheduleType: string,
): number[] {
  const yearRules = rules?.[year];
  let values: number[];

  // Legacy format: plain number for the whole year
  if (typeof yearRules === "number") {
    values = Array(12).fill(yearRules);
  } else if (yearRules && typeof yearRules === "object") {
    // New format: nested object { 1: 5000, 2: 5200, ... }
    values = Array.from({ length: 12 }, (_, m) => {
      const month = m + 1;
      return month in yearRules ? yearRules[month] : globalValue;
    });
  } else {
    // No rule for this year — fall back to global
    values = Array(12).fill(globalValue);
  }

  // Apply active schedules for future months
  return applySchedules(values, year, schedules ?? [], scheduleType);
}

/**
 * Build year-level fixed-expense rows from snapshots.
 * Snapshots are pre-augmented with virtual entries for current/future months
 * so this function just reads them directly.
 */
function buildYearFixedRows(year: number, snapshots: FixedExpenseSnapshot[], fixedDefinitions: FixedExpense[]) {
  const rows: Record<string, { name: string; amounts: number[] }> = {};

  snapshots.forEach((s) => {
    if (s.year !== year) return;
    const m = s.month - 1; // 0-indexed
    const key = String(s.fixedExpenseId);
    if (!rows[key]) {
      rows[key] = { name: s.nameSnapshot, amounts: Array(12).fill(0) };
    }
    rows[key].amounts[m] = s.amountSnapshot;
    rows[key].name = s.nameSnapshot;
  });

  const archivedIds = new Set(
    (fixedDefinitions || [])
      .filter((f) => f.isArchived === true)
      .map((f) => String(f.id)),
  );

  return Object.entries(rows).map(([id, { name, amounts }]) => ({
    id,
    name,
    amounts,
    yearTotal: amounts.reduce((s, v) => s + v, 0),
    isArchived: archivedIds.has(id),
  }));
}

/**
 * Get fixed expenses for a specific month.
 * Schedules can override amounts for future months.
 */
function getFixedExpensesForMonth(
  year: number,
  month: number,
  snapshots: FixedExpenseSnapshot[],
  fixedDefinitions: FixedExpense[],
  schedules: Schedule[] | undefined,
) {
  // month is 0-indexed (0-11)
  const targetMonth = month + 1;
  const monthSnaps = snapshots.filter(
    (s) => s.year === year && s.month === targetMonth,
  );

  const defMap = new Map((fixedDefinitions || []).map((f) => [String(f.id), f]));

  const items = monthSnaps.map((s) => ({
    id: s.fixedExpenseId,
    name: s.nameSnapshot,
    amount: s.amountSnapshot,
    isArchived: defMap.get(String(s.fixedExpenseId))?.isArchived === true,
  }));

  // Apply active schedules for future months
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isFutureOrCurrent =
    year > currentYear || (year === currentYear && targetMonth >= currentMonth);

  if (isFutureOrCurrent && schedules && schedules.length > 0) {
    const applicable = schedules
      .filter((s) => s.isActive && s.type === "fixedExpense")
      .filter(
        (s) =>
          s.effectiveYear < year ||
          (s.effectiveYear === year && s.effectiveMonth <= targetMonth),
      )
      .sort((a, b) => {
        if (a.effectiveYear !== b.effectiveYear)
          return a.effectiveYear - b.effectiveYear;
        return a.effectiveMonth - b.effectiveMonth;
      });

    for (const item of items) {
      const latest = applicable
        .filter((s) => s.targetId === item.id)
        .pop();
      if (latest) {
        item.amount = latest.newValue;
      }
    }
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return { total, items };
}

/**
 * Get variable expenses for a specific month.
 */
function getVariableExpensesForMonth(year: number, month: number, expenses: Expense[]) {
  const monthStr = String(month + 1).padStart(2, "0");
  const prefix = `${year}-${monthStr}`;
  return (expenses || [])
    .filter((e) => e.date && e.date.startsWith(prefix))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute the financial summary for a single month.
 * @param year
 * @param month  — 0-indexed (0-11)
 * @param data
 * @returns {MonthlySummary}
 */
export function getMonthlyFinancialSummary(year: number, month: number, data: FinanceEngineData): MonthlySummary {
  const {
    expenses,
    snapshots,
    fixedExpenses,
    incomeRules,
    savingsRules,
    globalIncome,
    globalSavingsRate,
    schedules,
  } = data;

  const incomeValues = resolveMonthlyValues(year, incomeRules, globalIncome, schedules, "income");
  const savingsRateValues = resolveMonthlyValues(year, savingsRules, globalSavingsRate, schedules, "savingsRate");

  const income = incomeValues[month] || 0;
  const savingsRate = savingsRateValues[month] || 0;

  const fixedResult = getFixedExpensesForMonth(year, month, snapshots, fixedExpenses, schedules);
  const fixedExpensesTotal = fixedResult.total;

  const variableExpenses = getVariableExpensesForMonth(year, month, expenses);

  const autoSavings = Math.max(0, income * (savingsRate / 100));
  const remaining = income - fixedExpensesTotal - autoSavings - variableExpenses;

  return {
    income,
    fixedExpensesTotal,
    savingsRate,
    autoSavings,
    remaining,
    variableExpenses,
    fixedExpenses: fixedResult.items,
  };
}

/**
 * Compute the full financial summary for a year.
 * @param year
 * @param data
 * @param opts
 * @returns {YearSummary}
 */
export function getYearFinancialSummary(year: number, data: FinanceEngineData, opts: { currentYear?: number; currentMonth?: number } = {}): YearSummary {
  const { currentYear, currentMonth = 11 } = opts;
  const nowYear = currentYear ?? new Date().getFullYear();
  const nowMonth = currentMonth;

  // ── Augment snapshots with virtual entries for current/future months ──
  // Active fixed expenses are projected forward so Analytics shows them
  // in future months (both within current year and in future years).
  const augmentedSnapshots = [...data.snapshots];
  if (year >= nowYear) {
    for (let m = 0; m < 12; m++) {
      // Past months in current year already have real snapshots
      if (year === nowYear && m < nowMonth) continue;
      const month = m + 1;
      const existingIds = new Set(
        data.snapshots
          .filter((s) => s.year === year && s.month === month)
          .map((s) => String(s.fixedExpenseId)),
      );
      (data.fixedExpenses || []).forEach((f) => {
        if (f.isArchived === true) return;
        if (!existingIds.has(String(f.id))) {
          augmentedSnapshots.push({
            fixedExpenseId: f.id as number,
            year,
            month,
            amountSnapshot: f.amount,
            nameSnapshot: f.name,
          });
        }
      });
    }
  }

  const augmentedData = { ...data, snapshots: augmentedSnapshots };

  // 1. Build 12 monthly summaries using augmented snapshots
  const months: MonthlySummary[] = [];
  for (let m = 0; m < 12; m++) {
    months.push(getMonthlyFinancialSummary(year, m, augmentedData));
  }

  // 2. Build year-level fixed rows using augmented snapshots
  const fixedRows = buildYearFixedRows(year, augmentedSnapshots, data.fixedExpenses);

  // 3. Derived arrays
  const monthlyFixedTotals = months.map((m) => m.fixedExpensesTotal);
  const monthlyVariableTotals = months.map((m) => m.variableExpenses);
  const monthlyTotals = months.map((m) => m.fixedExpensesTotal + m.variableExpenses);
  const monthlySavings = months.map((m) => m.autoSavings);
  const monthlyRemaining = months.map((m) => m.remaining);
  const monthlyTotalSavings = months.map((m) => m.autoSavings + m.remaining);
  const monthlySavingsRates = months.map((m) => m.savingsRate);

  // Savings % includes both auto savings and remaining budget
  const monthlySavingsPct = months.map((m) =>
    m.income > 0 ? ((m.autoSavings + m.remaining) / m.income) * 100 : null,
  );

  // 4. Totals
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalFixed = months.reduce((s, m) => s + m.fixedExpensesTotal, 0);
  const totalVariable = months.reduce((s, m) => s + m.variableExpenses, 0);
  const totalSavings = months.reduce((s, m) => s + m.autoSavings, 0);
  const totalRemaining = months.reduce((s, m) => s + m.remaining, 0);
  const totalSavingsWithRemaining = totalSavings + totalRemaining;

  const validMonths = months.filter((m) => m.income > 0);
  const avgSavingsPct =
    validMonths.length > 0
      ? (totalSavingsWithRemaining / validMonths.reduce((s, m) => s + m.income, 0)) * 100
      : 0;

  const yearTotal = totalFixed + totalVariable;

  return {
    months,
    fixedRows,
    monthlyFixedTotals,
    monthlyVariableTotals,
    monthlyTotals,
    monthlySavings,
    monthlyRemaining,
    monthlyTotalSavings,
    monthlySavingsRates,
    monthlySavingsPct,
    totals: {
      totalIncome,
      totalFixed,
      totalVariable,
      totalSavings,
      totalRemaining,
      totalSavingsWithRemaining,
      yearTotal,
      avgSavingsPct,
    },
  };
}

/**
 * Build the variable expense category grid for a year.
 * Groups expenses by category and returns monthly breakdowns.
 *
 * @param year
 * @param expenses
 * @param categories
 * @returns {VariableGridResult}
 */
export function getYearVariableGrid(year: number, expenses: Expense[], categories: { id?: number; name: string; isDeleted?: boolean }[]): VariableGridResult {
  const activeCategories = (categories || []).filter((c) => !c.isDeleted);

  const yearExpenses = (expenses || []).filter((e) => e.date && e.date.startsWith(`${year}-`));

  const grid: Record<string, number[]> = {};
  yearExpenses.forEach((e) => {
    const key = e.categoryId != null ? String(e.categoryId) : e.category || "Uncategorized";
    const m = parseInt(e.date.slice(5, 7), 10) - 1;
    if (!grid[key]) grid[key] = Array(12).fill(0);
    grid[key][m] += e.amount || 0;
  });

  const result: Array<{ key: string; name: string }> = [];
  const covered = new Set<string>();
  activeCategories.forEach((cat) => {
    const key = String(cat.id);
    if (grid[key]) {
      result.push({ key, name: cat.name });
      covered.add(key);
    }
  });
  Object.keys(grid).forEach((key) => {
    if (!covered.has(key)) result.push({ key, name: key });
  });

  const variableRows = result.map((row) => {
    const amounts = grid[row.key] || Array(12).fill(0);
    return {
      key: row.key,
      name: row.name,
      amounts,
      yearTotal: amounts.reduce((s, v) => s + v, 0),
    };
  });

  const monthlyVariableTotals = Array.from({ length: 12 }, (_, m) =>
    variableRows.reduce((s, r) => s + (r.amounts[m] || 0), 0),
  );

  const maxPerMonth = Array.from({ length: 12 }, (_, m) =>
    Math.max(0, ...variableRows.map((r) => r.amounts[m] || 0)),
  );

  const yearVariableTotal = monthlyVariableTotals.reduce((s, v) => s + v, 0);

  return { grid, variableRows, monthlyVariableTotals, maxPerMonth, yearVariableTotal };
}

/**
 * Generate a backfill preview timeline from modal form state.
 * Returns a 12-month financial grid for live preview.
 *
 * @param items
 * @param incomeConfig
 * @param savingsConfig
 * @returns {BackfillMonthResult[]}
 */
export function getBackfillPreviewTimeline(
  items: Array<{ name: string; amount: number; startMonth: number; endMonth: number }>,
  incomeConfig: { amount: number; startMonth: number; endMonth: number } | null | undefined,
  savingsConfig: { rate: number; startMonth: number; endMonth: number } | null | undefined,
) {
  const safeItems = items
    .filter((i) => i.name.trim() && !isNaN(parseFloat(String(i.amount))))
    .map((i) => ({
      name: i.name.trim(),
      amount: parseFloat(String(i.amount)) || 0,
      startMonth: Math.max(1, Math.min(12, i.startMonth || 1)),
      endMonth: Math.max(1, Math.min(12, i.endMonth || 12)),
    }));

  const incomeAmt = parseFloat(String(incomeConfig?.amount)) || 0;
  const incomeSm = Math.max(1, Math.min(12, incomeConfig?.startMonth || 1));
  const incomeEm = Math.max(1, Math.min(12, incomeConfig?.endMonth || 12));

  const savingsRate = parseFloat(String(savingsConfig?.rate)) || 0;
  const savingsSm = Math.max(1, Math.min(12, savingsConfig?.startMonth || 1));
  const savingsEm = Math.max(1, Math.min(12, savingsConfig?.endMonth || 12));

  return Array.from({ length: 12 }, (_, m) => {
    const month = m + 1;

    const fixedItems = safeItems
      .filter((i) => month >= i.startMonth && month <= i.endMonth)
      .map((i) => ({ name: i.name, amount: i.amount }));

    const fixedTotal = fixedItems.reduce((s, i) => s + i.amount, 0);

    const income = month >= incomeSm && month <= incomeEm ? incomeAmt : 0;
    const rate = month >= savingsSm && month <= savingsEm ? savingsRate : 0;

    const autoSavings = Math.max(0, income * (rate / 100));
    const remaining = income - fixedTotal - autoSavings;

    return {
      month,
      income,
      fixedTotal,
      fixedItems,
      savingsRate: rate,
      autoSavings,
      remaining,
    };
  });
}

/**
 * Export month names for consumers.
 */
export { MONTHS };
