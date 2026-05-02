import { describe, it, expect } from "vitest";

/**
 * Pure helper: compute gap months between last open and current month.
 * Only includes past months (excludes current month).
 */
function getGapMonths(
  lastYear: number,
  lastMonth: number,
  currentYear: number,
  currentMonth: number,
): { year: number; month: number }[] {
  const gaps: { year: number; month: number }[] = [];
  let y = lastYear;
  let m = lastMonth;
  while (true) {
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (y === currentYear && m === currentMonth) break;
    gaps.push({ year: y, month: m });
  }
  return gaps;
}

/**
 * Pure helper: find the most recent prior snapshot for a given month.
 */
function findLastSnapshot<T extends { year: number; month: number }>(
  snapshots: T[],
  targetYear: number,
  targetMonth: number,
): T | undefined {
  return [...snapshots]
    .filter(
      (s) => s.year < targetYear || (s.year === targetYear && s.month < targetMonth),
    )
    .sort((a, b) => b.year - a.year || b.month - a.month)[0];
}

describe("getGapMonths", () => {
  it("returns empty when current follows immediately", () => {
    expect(getGapMonths(2024, 3, 2024, 4)).toEqual([]);
  });

  it("returns single gap month", () => {
    expect(getGapMonths(2024, 3, 2024, 5)).toEqual([{ year: 2024, month: 4 }]);
  });

  it("returns multiple gap months", () => {
    expect(getGapMonths(2024, 3, 2024, 7)).toEqual([
      { year: 2024, month: 4 },
      { year: 2024, month: 5 },
      { year: 2024, month: 6 },
    ]);
  });

  it("handles year boundary", () => {
    expect(getGapMonths(2024, 11, 2025, 2)).toEqual([
      { year: 2024, month: 12 },
      { year: 2025, month: 1 },
    ]);
  });

  it("stops before current month", () => {
    const gaps = getGapMonths(2024, 1, 2024, 6);
    const hasCurrent = gaps.some((g) => g.year === 2024 && g.month === 6);
    expect(hasCurrent).toBe(false);
    expect(gaps).toHaveLength(4);
  });
});

describe("findLastSnapshot", () => {
  const incomeSnaps = [
    { year: 2024, month: 1, amountSnapshot: 4000 },
    { year: 2024, month: 3, amountSnapshot: 5000 },
    { year: 2024, month: 5, amountSnapshot: 6000 },
  ];

  it("finds the most recent prior snapshot", () => {
    const last = findLastSnapshot(incomeSnaps, 2024, 4);
    expect(last).toEqual({ year: 2024, month: 3, amountSnapshot: 5000 });
  });

  it("returns undefined when no prior snapshot exists", () => {
    const last = findLastSnapshot(incomeSnaps, 2024, 1);
    expect(last).toBeUndefined();
  });

  it("finds snapshot from earlier year", () => {
    const snaps = [
      { year: 2023, month: 12, amountSnapshot: 4500 },
      { year: 2024, month: 2, amountSnapshot: 5000 },
    ];
    const last = findLastSnapshot(snaps, 2024, 1);
    expect(last).toEqual({ year: 2023, month: 12, amountSnapshot: 4500 });
  });

  it("picks the most recent when multiple snapshots exist", () => {
    const snaps = [
      { year: 2024, month: 2, amountSnapshot: 5000 },
      { year: 2024, month: 4, amountSnapshot: 5500 },
    ];
    const last = findLastSnapshot(snaps, 2024, 5);
    expect(last?.amountSnapshot).toBe(5500);
  });
});

describe("rollover logic - end to end scenario", () => {
  it("carries forward last snapshot value for gap months", () => {
    // User had March snapshot = 5000, then opened in May
    const lastOpen = { year: 2024, month: 3 };
    const current = { year: 2024, month: 5 };
    const gaps = getGapMonths(lastOpen.year, lastOpen.month, current.year, current.month);

    const incomeSnaps = [
      { year: 2024, month: 3, amountSnapshot: 5000 },
    ];
    const globalIncome = 6000; // user changed global in May

    const results = gaps.map((g) => {
      const hasSnap = incomeSnaps.some((s) => s.year === g.year && s.month === g.month);
      if (hasSnap) return null;
      const last = findLastSnapshot(incomeSnaps, g.year, g.month);
      return {
        year: g.year,
        month: g.month,
        amountSnapshot: last?.amountSnapshot ?? globalIncome,
      };
    }).filter(Boolean);

    expect(results).toEqual([{ year: 2024, month: 4, amountSnapshot: 5000 }]);
  });

  it("uses global when no prior snapshot exists", () => {
    const lastOpen = { year: 2024, month: 1 };
    const current = { year: 2024, month: 3 };
    const gaps = getGapMonths(lastOpen.year, lastOpen.month, current.year, current.month);

    const incomeSnaps: { year: number; month: number; amountSnapshot: number }[] = [];
    const globalIncome = 5000;

    const results = gaps.map((g) => {
      const hasSnap = incomeSnaps.some((s) => s.year === g.year && s.month === g.month);
      if (hasSnap) return null;
      const last = findLastSnapshot(incomeSnaps, g.year, g.month);
      return {
        year: g.year,
        month: g.month,
        amountSnapshot: last?.amountSnapshot ?? globalIncome,
      };
    }).filter(Boolean);

    expect(results).toEqual([{ year: 2024, month: 2, amountSnapshot: 5000 }]);
  });
});
