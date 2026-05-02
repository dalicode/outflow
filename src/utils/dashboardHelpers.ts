/**
 * Dashboard Multi-Month Helpers
 * ─────────────────────────────
 * Pure utilities for aggregating category and fixed-expense data
 * across multiple months in the dashboard table.
 */

import type {
  Expense,
  MonthlySummary,
  MonthKey,
  MultiMonthCategoryRow,
  MultiMonthFixedRow,
} from "../types";

/**
 * Build an array of MonthKey entries going backwards from the selected month.
 * index 0 = selected/current month, index 1 = previous month, etc.
 */
export function getMonthKeys(
  selectedYear: number,
  selectedMonth: number,
  span: number,
): MonthKey[] {
  const months: MonthKey[] = [];
  for (let i = 0; i < span; i++) {
    const d = new Date(selectedYear, selectedMonth);
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const name = d.toLocaleString("default", { month: "short" });
    months.push({ year, month, key, name });
  }
  return months;
}

/**
 * Aggregate category totals and transaction counts across multiple months.
 * Returns rows sorted by current month (index 0) amount descending.
 * Categories present in previous months but not the current month are appended.
 */
export function computeMultiMonthCategoryRows(
  expenses: Expense[],
  monthKeys: MonthKey[],
  resolveName: (exp: Expense) => string,
): MultiMonthCategoryRow[] {
  // Per-month category totals and counts
  const monthlyTotals: Record<number, Record<string, number>> = {};
  const monthlyCounts: Record<number, Record<string, number>> = {};

  monthKeys.forEach((mk, idx) => {
    monthlyTotals[idx] = {};
    monthlyCounts[idx] = {};
    const monthExpenses = expenses.filter((e) => e.date.startsWith(mk.key));
    monthExpenses.forEach((e) => {
      const name = resolveName(e);
      monthlyTotals[idx][name] = (monthlyTotals[idx][name] || 0) + e.amount;
      monthlyCounts[idx][name] = (monthlyCounts[idx][name] || 0) + 1;
    });
  });

  // Collect all unique category names across all months
  const allNames = new Set<string>();
  monthKeys.forEach((_, idx) => {
    Object.keys(monthlyTotals[idx]).forEach((name) => allNames.add(name));
  });

  // Build rows
  const rows: MultiMonthCategoryRow[] = Array.from(allNames).map((name) => {
    const monthlyAmounts = monthKeys.map(
      (_, idx) => monthlyTotals[idx][name] || 0,
    );
    const totalTransactions = monthKeys.reduce(
      (sum, _, idx) => sum + (monthlyCounts[idx][name] || 0),
      0,
    );
    return { name, totalTransactions, monthlyAmounts };
  });

  // Sort: current month amount descending, then name
  rows.sort((a, b) => {
    const diff = b.monthlyAmounts[0] - a.monthlyAmounts[0];
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  return rows;
}

/**
 * Aggregate fixed expenses across multiple monthly summaries.
 * Returns rows with amounts per month. If a fixed expense didn't exist in a
 * given month, the value is null.
 */
export function computeMultiMonthFixedRows(
  monthSummaries: MonthlySummary[],
): MultiMonthFixedRow[] {
  if (!monthSummaries || monthSummaries.length === 0) return [];

  // Collect all unique fixed expense IDs with their names
  const idToName = new Map<number, string>();
  monthSummaries.forEach((summary) => {
    summary.fixedExpenses.forEach((fe) => {
      if (!idToName.has(fe.id)) {
        idToName.set(fe.id, fe.name);
      }
    });
  });

  // Build lookup: month index -> id -> amount
  const monthLookup: Record<number, Record<number, number>> = {};
  monthSummaries.forEach((summary, idx) => {
    monthLookup[idx] = {};
    summary.fixedExpenses.forEach((fe) => {
      monthLookup[idx][fe.id] = fe.amount;
    });
  });

  return Array.from(idToName.entries())
    .map(([id, name]) => ({
      id,
      name,
      monthlyAmounts: monthSummaries.map(
        (_, idx) => monthLookup[idx][id] ?? null,
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
