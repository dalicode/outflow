import { expect, test } from "@playwright/test";
import {
  addFixedExpense,
  addSchedule,
  clearAllData,
  getFixedExpenseSnapshots,
  getFixedExpenses,
  getIncomeSnapshots,
  getSavingsSnapshots,
  getSchedules,
  getSetting,
  gotoAndWait,
  seedSettings,
  waitForRouteReady,
} from "./helpers";

type MonthRef = {
  year: number;
  month: number;
  key: string;
};

function shiftMonth(base: Date, offset: number): MonthRef {
  const next = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const year = next.getFullYear();
  const month = next.getMonth() + 1;

  return {
    year,
    month,
    key: `${year}-${String(month).padStart(2, "0")}`,
  };
}

function getGapMonths(lastOpen: MonthRef, current: MonthRef): MonthRef[] {
  const gapMonths: MonthRef[] = [];
  let year = lastOpen.year;
  let month = lastOpen.month;

  while (!(year === current.year && month === current.month)) {
    gapMonths.push({
      year,
      month,
      key: `${year}-${String(month).padStart(2, "0")}`,
    });

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return gapMonths;
}

function sortByMonth<T extends { year: number; month: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
}

function simplifyIncomeSnapshots(
  rows: Array<{ year: number; month: number; amountSnapshot: number }>,
): Array<{ year: number; month: number; amountSnapshot: number }> {
  return sortByMonth(rows).map(({ year, month, amountSnapshot }) => ({
    year,
    month,
    amountSnapshot,
  }));
}

function simplifySavingsSnapshots(
  rows: Array<{ year: number; month: number; rateSnapshot: number }>,
): Array<{ year: number; month: number; rateSnapshot: number }> {
  return sortByMonth(rows).map(({ year, month, rateSnapshot }) => ({
    year,
    month,
    rateSnapshot,
  }));
}

function simplifyFixedExpenseSnapshots(
  rows: Array<{ year: number; month: number; amountSnapshot: number; nameSnapshot: string }>,
): Array<{ year: number; month: number; amountSnapshot: number; nameSnapshot: string }> {
  return sortByMonth(rows).map(({ year, month, amountSnapshot, nameSnapshot }) => ({
    year,
    month,
    amountSnapshot,
    nameSnapshot,
  }));
}

test.describe("Monthly rollover", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndWait(page, "/settings");
    await clearAllData(page);
    await waitForRouteReady(page, "/settings");
  });

  test("backfills missed months from global income, savings, and fixed expense values", async ({
    page,
  }) => {
    const now = new Date();
    const currentMonth = shiftMonth(now, 0);
    const lastOpenMonth = shiftMonth(now, -3);
    const gapMonths = getGapMonths(lastOpenMonth, currentMonth);

    await seedSettings(page, {
      monthlyIncome: 5000,
      savingsRate: 12,
      lastAppOpenMonthKey: lastOpenMonth.key,
    });
    await addFixedExpense(page, { name: "Rent", amount: 1200 });

    await page.reload();
    await waitForRouteReady(page, "/settings");

    await expect
      .poll(async () => {
        const [incomeSnapshots, savingsSnapshots, fixedSnapshots] = await Promise.all([
          getIncomeSnapshots(page),
          getSavingsSnapshots(page),
          getFixedExpenseSnapshots(page),
        ]);

        return [incomeSnapshots.length, savingsSnapshots.length, fixedSnapshots.length];
      })
      .toEqual([gapMonths.length, gapMonths.length, gapMonths.length]);

    const [incomeSnapshots, savingsSnapshots, fixedSnapshots, lastAppOpenMonthKey] =
      await Promise.all([
        getIncomeSnapshots(page),
        getSavingsSnapshots(page),
        getFixedExpenseSnapshots(page),
        getSetting(page, "lastAppOpenMonthKey"),
      ]);

    expect(simplifyIncomeSnapshots(incomeSnapshots)).toEqual(
      gapMonths.map(({ year, month }) => ({
        year,
        month,
        amountSnapshot: 5000,
      })),
    );

    expect(simplifySavingsSnapshots(savingsSnapshots)).toEqual(
      gapMonths.map(({ year, month }) => ({
        year,
        month,
        rateSnapshot: 12,
      })),
    );

    expect(simplifyFixedExpenseSnapshots(fixedSnapshots)).toEqual(
      gapMonths.map(({ year, month }) => ({
        year,
        month,
        amountSnapshot: 1200,
        nameSnapshot: "Rent",
      })),
    );

    expect(lastAppOpenMonthKey).toBe(currentMonth.key);
  });

  test("uses each schedule's historical value while catching up after months away", async ({
    page,
  }) => {
    const now = new Date();
    const currentMonth = shiftMonth(now, 0);
    const lastOpenMonth = shiftMonth(now, -4);
    const gapMonths = getGapMonths(lastOpenMonth, currentMonth);

    const fixedExpenseId = await addFixedExpense(page, { name: "Rent", amount: 1200 });

    await seedSettings(page, {
      monthlyIncome: 5000,
      savingsRate: 10,
      lastAppOpenMonthKey: lastOpenMonth.key,
    });

    await addSchedule(page, {
      type: "income",
      targetId: null,
      effectiveYear: gapMonths[1].year,
      effectiveMonth: gapMonths[1].month,
      newValue: 6200,
      note: "Raise one",
    });
    await addSchedule(page, {
      type: "income",
      targetId: null,
      effectiveYear: gapMonths[3].year,
      effectiveMonth: gapMonths[3].month,
      newValue: 6600,
      note: "Raise two",
    });
    await addSchedule(page, {
      type: "income",
      targetId: null,
      effectiveYear: currentMonth.year,
      effectiveMonth: currentMonth.month,
      newValue: 7000,
      note: "Current raise",
    });
    await addSchedule(page, {
      type: "savingsRate",
      targetId: null,
      effectiveYear: gapMonths[2].year,
      effectiveMonth: gapMonths[2].month,
      newValue: 18,
      note: "Savings bump",
    });
    await addSchedule(page, {
      type: "fixedExpense",
      targetId: fixedExpenseId,
      effectiveYear: gapMonths[2].year,
      effectiveMonth: gapMonths[2].month,
      newValue: 1400,
      note: "Lease renewal",
    });

    await page.reload();
    await waitForRouteReady(page, "/settings");

    await expect
      .poll(async () => {
        const [incomeSnapshots, savingsSnapshots, fixedSnapshots] = await Promise.all([
          getIncomeSnapshots(page),
          getSavingsSnapshots(page),
          getFixedExpenseSnapshots(page),
        ]);

        return [incomeSnapshots.length, savingsSnapshots.length, fixedSnapshots.length];
      })
      .toEqual([gapMonths.length, gapMonths.length, gapMonths.length]);

    const [incomeSnapshots, savingsSnapshots, fixedSnapshots, schedules, monthlyIncome, liveFixed] =
      await Promise.all([
        getIncomeSnapshots(page),
        getSavingsSnapshots(page),
        getFixedExpenseSnapshots(page),
        getSchedules(page),
        getSetting(page, "monthlyIncome"),
        getFixedExpenses(page),
      ]);

    expect(simplifyIncomeSnapshots(incomeSnapshots)).toEqual([
      { year: gapMonths[0].year, month: gapMonths[0].month, amountSnapshot: 5000 },
      { year: gapMonths[1].year, month: gapMonths[1].month, amountSnapshot: 6200 },
      { year: gapMonths[2].year, month: gapMonths[2].month, amountSnapshot: 6200 },
      { year: gapMonths[3].year, month: gapMonths[3].month, amountSnapshot: 6600 },
    ]);

    expect(simplifySavingsSnapshots(savingsSnapshots)).toEqual([
      { year: gapMonths[0].year, month: gapMonths[0].month, rateSnapshot: 10 },
      { year: gapMonths[1].year, month: gapMonths[1].month, rateSnapshot: 10 },
      { year: gapMonths[2].year, month: gapMonths[2].month, rateSnapshot: 18 },
      { year: gapMonths[3].year, month: gapMonths[3].month, rateSnapshot: 18 },
    ]);

    expect(simplifyFixedExpenseSnapshots(fixedSnapshots)).toEqual([
      {
        year: gapMonths[0].year,
        month: gapMonths[0].month,
        amountSnapshot: 1200,
        nameSnapshot: "Rent",
      },
      {
        year: gapMonths[1].year,
        month: gapMonths[1].month,
        amountSnapshot: 1200,
        nameSnapshot: "Rent",
      },
      {
        year: gapMonths[2].year,
        month: gapMonths[2].month,
        amountSnapshot: 1400,
        nameSnapshot: "Rent",
      },
      {
        year: gapMonths[3].year,
        month: gapMonths[3].month,
        amountSnapshot: 1400,
        nameSnapshot: "Rent",
      },
    ]);

    expect(monthlyIncome).toBe(7000);
    expect(liveFixed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fixedExpenseId,
          name: "Rent",
          amount: 1400,
        }),
      ]),
    );

    expect(schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "income",
          note: "Raise one",
          isActive: 0,
        }),
        expect.objectContaining({
          type: "income",
          note: "Raise two",
          isActive: 0,
        }),
        expect.objectContaining({
          type: "income",
          note: "Current raise",
          isActive: 1,
          materializedAt: currentMonth.key,
        }),
        expect.objectContaining({
          type: "savingsRate",
          note: "Savings bump",
          isActive: 0,
        }),
        expect.objectContaining({
          type: "fixedExpense",
          note: "Lease renewal",
          isActive: 0,
          targetId: fixedExpenseId,
        }),
      ]),
    );
  });
});
