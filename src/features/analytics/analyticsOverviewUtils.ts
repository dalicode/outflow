import type { AnalyticsData } from "../../types";

export interface AnalyticsOverviewMonthRow {
  monthIndex: number;
  monthLabel: string;
  income: number;
  fixed: number;
  variable: number;
  spending: number;
  remaining: number;
  savingsRate: number;
  deltaFromPrevious: number | null;
  topCategoryName: string;
  topCategoryAmount: number;
  topPayeeName: string;
  topPayeeAmount: number;
  isSelected: boolean;
  isCurrent: boolean;
}

export interface AnalyticsOverviewSnapshot {
  monthCount: number;
  rows: AnalyticsOverviewMonthRow[];
  selectedRow: AnalyticsOverviewMonthRow | null;
  previousRow: AnalyticsOverviewMonthRow | null;
  bestSpendRow: AnalyticsOverviewMonthRow | null;
  bestSavingsRow: AnalyticsOverviewMonthRow | null;
  averageSpend: number;
  averageSavingsRate: number;
}

function getVisibleMonthCount(
  year: number,
  currentYear: number,
  currentMonth: number,
): number {
  if (year > currentYear) return 0;
  if (year === currentYear) return currentMonth + 1;
  return 12;
}

function getMonthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex).toLocaleString("default", {
    month: "short",
  });
}

function getTopSeriesRow(
  rows: AnalyticsData["variableRows"] | AnalyticsData["payeeRows"],
  monthIndex: number,
  fallbackName: string,
): { name: string; amount: number } {
  let topName = fallbackName;
  let topAmount = 0;

  for (const row of rows) {
    const amount = row.amounts?.[monthIndex] ?? 0;
    if (amount > topAmount) {
      topAmount = amount;
      topName = row.name;
    }
  }

  return { name: topName, amount: topAmount };
}

export function buildAnalyticsOverviewSnapshot(
  data: AnalyticsData,
  year: number,
  currentYear: number,
  currentMonth: number,
  selectedMonth: number | null,
): AnalyticsOverviewSnapshot {
  const monthCount = getVisibleMonthCount(year, currentYear, currentMonth);
  const rows: AnalyticsOverviewMonthRow[] = [];

  for (let monthIndex = 0; monthIndex < monthCount; monthIndex += 1) {
    const previousSpending = monthIndex > 0 ? data.monthlyTotals[monthIndex - 1] ?? 0 : null;
    const spending = data.monthlyTotals[monthIndex] ?? 0;
    const fixed = data.monthlyFixedTotals[monthIndex] ?? 0;
    const variable = data.monthlyVariableTotals[monthIndex] ?? 0;
    const remaining = data.monthlyRemaining[monthIndex] ?? 0;
    const income = data.monthlyIncome[monthIndex] ?? 0;
    const savingsRate = data.monthlySavingsRates[monthIndex] ?? 0;
    const topCategory = getTopSeriesRow(
      data.variableRows,
      monthIndex,
      "No category",
    );
    const topPayee = getTopSeriesRow(data.payeeRows, monthIndex, "No payee");

    rows.push({
      monthIndex,
      monthLabel: getMonthLabel(year, monthIndex),
      income,
      fixed,
      variable,
      spending,
      remaining,
      savingsRate,
      deltaFromPrevious:
        previousSpending === null ? null : spending - previousSpending,
      topCategoryName: topCategory.name,
      topCategoryAmount: topCategory.amount,
      topPayeeName: topPayee.name,
      topPayeeAmount: topPayee.amount,
      isSelected:
        selectedMonth !== null ? selectedMonth === monthIndex : monthIndex === monthCount - 1,
      isCurrent: year === currentYear && monthIndex === currentMonth,
    });
  }

  const selectedRow =
    selectedMonth !== null
      ? rows.find((row) => row.monthIndex === selectedMonth) ?? null
      : rows.length > 0 ? rows[rows.length - 1] : null;

  const previousRow =
    selectedRow && selectedRow.monthIndex > 0
      ? rows.find((row) => row.monthIndex === selectedRow.monthIndex - 1) ?? null
      : null;

  const bestSpendRow = rows.reduce<AnalyticsOverviewMonthRow | null>((best, row) => {
    if (!best || row.spending > best.spending) return row;
    return best;
  }, null);

  const bestSavingsRow = rows.reduce<AnalyticsOverviewMonthRow | null>((best, row) => {
    if (!best || row.savingsRate > best.savingsRate) return row;
    return best;
  }, null);

  const averageSpend =
    rows.length > 0
      ? rows.reduce((sum, row) => sum + row.spending, 0) / rows.length
      : 0;
  const averageSavingsRate =
    rows.length > 0
      ? rows.reduce((sum, row) => sum + row.savingsRate, 0) / rows.length
      : 0;

  return {
    monthCount,
    rows,
    selectedRow,
    previousRow,
    bestSpendRow,
    bestSavingsRow,
    averageSpend,
    averageSavingsRate,
  };
}
