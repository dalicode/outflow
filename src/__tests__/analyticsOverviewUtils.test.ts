import { describe, it, expect } from "vitest";
import { buildAnalyticsOverviewSnapshot } from "../features/analytics/analyticsOverviewUtils";
import type { AnalyticsData } from "../types";

function createAnalyticsData(): AnalyticsData {
  return {
    year: 2026,
    monthlyIncome: [4000, 4000, 4500, 4500, 4500, 4500, 0, 0, 0, 0, 0, 0],
    variableRows: [
      { key: "Groceries", name: "Groceries", amounts: [500, 450, 600, 400, 550, 300, 0, 0, 0, 0, 0, 0], yearTotal: 2800 },
      { key: "Travel", name: "Travel", amounts: [100, 50, 0, 0, 0, 700, 0, 0, 0, 0, 0, 0], yearTotal: 850 },
      { key: "Dining", name: "Dining", amounts: [200, 240, 180, 260, 210, 190, 0, 0, 0, 0, 0, 0], yearTotal: 1280 },
    ],
    payeeRows: [
      { key: "Amazon", name: "Amazon", amounts: [120, 90, 140, 80, 110, 95, 0, 0, 0, 0, 0, 0], yearTotal: 635 },
      { key: "Metro", name: "Metro", amounts: [250, 240, 260, 230, 255, 220, 0, 0, 0, 0, 0, 0], yearTotal: 1455 },
    ],
    grid: {},
    fixedRows: [],
    monthlyFixedTotals: [1000, 1000, 1000, 1000, 1000, 1000, 0, 0, 0, 0, 0, 0],
    monthlyVariableTotals: [800, 740, 780, 660, 760, 590, 0, 0, 0, 0, 0, 0],
    monthlyTotals: [1800, 1740, 1780, 1660, 1760, 1590, 0, 0, 0, 0, 0, 0],
    monthlySavings: [2200, 2260, 2720, 2840, 2740, 2910, 0, 0, 0, 0, 0, 0],
    monthlyRemaining: [2200, 2260, 2720, 2840, 2740, 2910, 0, 0, 0, 0, 0, 0],
    monthlyTotalSavings: [2200, 2260, 2720, 2840, 2740, 2910, 0, 0, 0, 0, 0, 0],
    monthlySavingsRates: [55, 56.5, 60.5, 63.1, 60.9, 64.7, 0, 0, 0, 0, 0, 0],
    monthlySavingsPct: [55, 56.5, 60.5, 63.1, 60.9, 64.7, null, null, null, null, null, null],
    monthlyHasData: [true, true, true, true, true, true, false, false, false, false, false, false],
    yearVariableTotal: 4330,
    yearFixedTotal: 6000,
    yearTotal: 10330,
    yearSavings: 15650,
    yearRemaining: 15650,
    yearTotalIncome: 25980,
    avgSavingsPct: 60.1,
    maxPerMonth: [1800, 1740, 1780, 1660, 1760, 1590, 0, 0, 0, 0, 0, 0],
  };
}

describe("buildAnalyticsOverviewSnapshot", () => {
  it("limits the rows to visible months for the current year and marks the selected row", () => {
    const data = createAnalyticsData();
    const snapshot = buildAnalyticsOverviewSnapshot(data, 2026, 2026, 5, 4);

    expect(snapshot.monthCount).toBe(6);
    expect(snapshot.rows).toHaveLength(6);
    expect(snapshot.selectedRow?.monthIndex).toBe(4);
    expect(snapshot.rows[4].isSelected).toBe(true);
    expect(snapshot.rows[5].isCurrent).toBe(true);
  });

  it("finds the biggest month and best savings month", () => {
    const data = createAnalyticsData();
    const snapshot = buildAnalyticsOverviewSnapshot(data, 2026, 2026, 5, null);

    expect(snapshot.bestSpendRow?.monthLabel).toBe("Jan");
    expect(snapshot.bestSavingsRow?.monthLabel).toBe("Jun");
  });

  it("captures the top category and payee per month", () => {
    const data = createAnalyticsData();
    const snapshot = buildAnalyticsOverviewSnapshot(data, 2026, 2026, 5, 2);

    expect(snapshot.selectedRow?.topCategoryName).toBe("Groceries");
    expect(snapshot.selectedRow?.topPayeeName).toBe("Metro");
    expect(snapshot.selectedRow?.deltaFromPrevious).toBe(40);
  });
});
