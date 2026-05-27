import { describe, expect, it } from 'vitest'
import type { AnalyticsData, Expense } from '../types'
import {
  buildCategoryBreakdown,
  buildDailySpendingRows,
  buildMonthDrilldownData,
  buildPayeeBreakdown,
  buildYearTrendRows,
  formatMonthKey,
  getMonthLabelFromIndex,
  getSavingsRate,
} from '../features/analytics/utils/analyticsTrendUtils'

// ── Test data factories ───────────────────────────────────────────────────────

function makeAnalyticsData(overrides: Partial<AnalyticsData> = {}): AnalyticsData {
  return {
    loading: false,
    year: 2026,
    monthlyIncome: Array(12).fill(5000),
    monthlyFixedTotals: Array(12).fill(1000),
    monthlyVariableTotals: Array(12).fill(1500),
    monthlyTotals: Array(12).fill(2500),
    monthlySavings: Array(12).fill(500),
    monthlyRemaining: Array(12).fill(1000),
    monthlyTotalSavings: Array(12).fill(1500),
    monthlySavingsRates: Array(12).fill(20),
    monthlySavingsPct: Array(12).fill(30),
    monthlyHasData: Array(12).fill(true),
    variableRows: [],
    payeeRows: [],
    fixedRows: [],
    grid: {},
    yearVariableTotal: 18000,
    yearFixedTotal: 12000,
    yearTotal: 30000,
    yearSavings: 6000,
    yearRemaining: 12000,
    yearTotalIncome: 60000,
    avgSavingsPct: 30,
    maxPerMonth: Array(12).fill(2500),
    ...overrides,
  }
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 1,
    date: '2026-05-10',
    amount: 100,
    categoryId: 1,
    ...overrides,
  }
}

// ── formatMonthKey ────────────────────────────────────────────────────────────

describe('formatMonthKey', () => {
  it('pads single-digit months with a leading zero', () => {
    expect(formatMonthKey(2026, 0)).toBe('2026-01')
    expect(formatMonthKey(2026, 4)).toBe('2026-05')
    expect(formatMonthKey(2026, 8)).toBe('2026-09')
  })

  it('handles double-digit months correctly', () => {
    expect(formatMonthKey(2026, 9)).toBe('2026-10')
    expect(formatMonthKey(2026, 10)).toBe('2026-11')
    expect(formatMonthKey(2026, 11)).toBe('2026-12')
  })

  it('uses the correct year', () => {
    expect(formatMonthKey(2024, 0)).toBe('2024-01')
    expect(formatMonthKey(2030, 11)).toBe('2030-12')
  })
})

// ── getMonthLabelFromIndex ────────────────────────────────────────────────────

describe('getMonthLabelFromIndex', () => {
  it('returns correct short month names', () => {
    expect(getMonthLabelFromIndex(0)).toBe('Jan')
    expect(getMonthLabelFromIndex(4)).toBe('May')
    expect(getMonthLabelFromIndex(11)).toBe('Dec')
  })

  it('returns empty string for out-of-range index', () => {
    expect(getMonthLabelFromIndex(12)).toBe('')
    expect(getMonthLabelFromIndex(-1)).toBe('')
  })
})

// ── getSavingsRate ────────────────────────────────────────────────────────────

describe('getSavingsRate', () => {
  it('returns null when income is 0', () => {
    expect(getSavingsRate(0, 500)).toBeNull()
    expect(getSavingsRate(0, 0)).toBeNull()
  })

  it('computes correct percentage', () => {
    expect(getSavingsRate(5000, 1000)).toBe(20)
    expect(getSavingsRate(4000, 1000)).toBe(25)
  })

  it('returns 0 when savings is 0', () => {
    expect(getSavingsRate(5000, 0)).toBe(0)
  })

  it('returns negative value for negative savings (refund scenario)', () => {
    const rate = getSavingsRate(5000, -200)
    expect(rate).toBeLessThan(0)
    expect(rate).toBeCloseTo(-4)
  })

  it('can exceed 100% when savings exceeds income', () => {
    const rate = getSavingsRate(1000, 1500)
    expect(rate).toBe(150)
  })
})

// ── buildYearTrendRows ────────────────────────────────────────────────────────

describe('buildYearTrendRows', () => {
  it('returns 12 rows for a past year', () => {
    const data = makeAnalyticsData({ year: 2025 })
    const rows = buildYearTrendRows(data, [], 2025, 2026, 4)
    expect(rows).toHaveLength(12)
  })

  it('returns rows only up to current month for current year', () => {
    const data = makeAnalyticsData({ year: 2026 })
    // currentMonth = 4 (May, 0-indexed) → 5 rows (Jan–May)
    const rows = buildYearTrendRows(data, [], 2026, 2026, 4)
    expect(rows).toHaveLength(5)
  })

  it('returns 0 rows for a future year', () => {
    const data = makeAnalyticsData({ year: 2027 })
    const rows = buildYearTrendRows(data, [], 2027, 2026, 11)
    expect(rows).toHaveLength(0)
  })

  it('sets correct monthKey and monthLabel', () => {
    const data = makeAnalyticsData({ year: 2026 })
    const rows = buildYearTrendRows(data, [], 2026, 2026, 4)
    expect(rows[0].monthKey).toBe('2026-01')
    expect(rows[0].monthLabel).toBe('Jan')
    expect(rows[4].monthKey).toBe('2026-05')
    expect(rows[4].monthLabel).toBe('May')
  })

  it('sets savingsRate to null when income is 0', () => {
    const monthlyIncome = Array(12).fill(0)
    const data = makeAnalyticsData({ year: 2025, monthlyIncome })
    const rows = buildYearTrendRows(data, [], 2025, 2026, 11)
    expect(rows[0].savingsRate).toBeNull()
    expect(rows[11].savingsRate).toBeNull()
  })

  it('uses pre-computed monthlySavingsPct when available', () => {
    const monthlySavingsPct: (number | null)[] = Array(12).fill(25)
    const data = makeAnalyticsData({ year: 2025, monthlySavingsPct })
    const rows = buildYearTrendRows(data, [], 2025, 2026, 11)
    expect(rows[0].savingsRate).toBe(25)
  })

  it('falls back to computing savingsRate when monthlySavingsPct is null', () => {
    const monthlySavingsPct: (number | null)[] = Array(12).fill(null)
    const monthlyIncome = Array(12).fill(5000)
    const monthlyTotalSavings: (number | null)[] = Array(12).fill(1000)
    const data = makeAnalyticsData({
      year: 2025,
      monthlySavingsPct,
      monthlyIncome,
      monthlyTotalSavings,
    })
    const rows = buildYearTrendRows(data, [], 2025, 2026, 11)
    expect(rows[0].savingsRate).toBeCloseTo(20)
  })

  it('counts expense records correctly', () => {
    const expenses: Expense[] = [
      makeExpense({ id: 1, date: '2026-01-05', amount: 50 }),
      makeExpense({ id: 2, date: '2026-01-10', amount: 75 }),
      makeExpense({ id: 3, date: '2026-02-01', amount: 100 }),
    ]
    const data = makeAnalyticsData({ year: 2026 })
    const rows = buildYearTrendRows(data, expenses, 2026, 2026, 4)
    expect(rows[0].expenseCount).toBe(2) // January
    expect(rows[1].expenseCount).toBe(1) // February
    expect(rows[2].expenseCount).toBe(0) // March
  })

  it('reflects hasData from AnalyticsData', () => {
    const monthlyHasData = Array(12).fill(false)
    monthlyHasData[0] = true
    const data = makeAnalyticsData({ year: 2025, monthlyHasData })
    const rows = buildYearTrendRows(data, [], 2025, 2026, 11)
    expect(rows[0].hasData).toBe(true)
    expect(rows[1].hasData).toBe(false)
  })

  it('includes negative expense amounts without clamping', () => {
    const monthlyTotals = Array(12).fill(-200) // refund month
    const data = makeAnalyticsData({ year: 2025, monthlyTotals })
    const rows = buildYearTrendRows(data, [], 2025, 2026, 11)
    expect(rows[0].expenses).toBe(-200)
  })

  it('cumulativeRemaining equals running sum of monthlyTotalSavings when no prior years', () => {
    const monthlyTotalSavings: (number | null)[] = Array(12).fill(500)
    const data = makeAnalyticsData({ year: 2025, monthlyTotalSavings })
    const rows = buildYearTrendRows(data, [], 2025, 2026, 11)
    expect(rows[0].cumulativeRemaining).toBe(500) // Jan only
    expect(rows[1].cumulativeRemaining).toBe(1000) // Jan + Feb
    expect(rows[11].cumulativeRemaining).toBe(6000) // all 12 months
  })

  it('cumulativeRemaining adds prior years baseline', () => {
    // Prior year had 12 months × $500 totalSavings = $6000 total
    const priorMonthlyTotalSavings: (number | null)[] = Array(12).fill(500)
    const priorData = makeAnalyticsData({
      year: 2024,
      monthlyTotalSavings: priorMonthlyTotalSavings,
    })

    const monthlyTotalSavings: (number | null)[] = Array(12).fill(200)
    const data = makeAnalyticsData({ year: 2025, monthlyTotalSavings })

    const rows = buildYearTrendRows(data, [], 2025, 2026, 11, [priorData])
    // baseline = 6000, Jan 2025 adds 200 → 6200
    expect(rows[0].cumulativeRemaining).toBe(6200)
    // baseline = 6000, Jan+Feb 2025 adds 400 → 6400
    expect(rows[1].cumulativeRemaining).toBe(6400)
  })

  it('negative totalSavings months reduce cumulativeRemaining', () => {
    const monthlyTotalSavings: (number | null)[] = [1000, -300, 500, ...Array(9).fill(0)]
    const data = makeAnalyticsData({ year: 2025, monthlyTotalSavings })
    const rows = buildYearTrendRows(data, [], 2025, 2026, 11)
    expect(rows[0].cumulativeRemaining).toBe(1000)
    expect(rows[1].cumulativeRemaining).toBe(700) // 1000 - 300
    expect(rows[2].cumulativeRemaining).toBe(1200) // 700 + 500
  })

  it('null monthlyTotalSavings values are treated as 0', () => {
    const monthlyTotalSavings: (number | null)[] = [500, null, 300, ...Array(9).fill(0)]
    const data = makeAnalyticsData({ year: 2025, monthlyTotalSavings })
    const rows = buildYearTrendRows(data, [], 2025, 2026, 11)
    expect(rows[0].cumulativeRemaining).toBe(500)
    expect(rows[1].cumulativeRemaining).toBe(500) // null treated as 0
    expect(rows[2].cumulativeRemaining).toBe(800)
  })

  it('null values in prior years monthlyTotalSavings are treated as 0', () => {
    const priorData = makeAnalyticsData({
      year: 2024,
      monthlyTotalSavings: [1000, null, 500, ...Array(9).fill(0)],
    })
    const data = makeAnalyticsData({
      year: 2025,
      monthlyTotalSavings: Array(12).fill(100),
    })
    const rows = buildYearTrendRows(data, [], 2025, 2026, 11, [priorData])
    // prior baseline = 1000 + 0 + 500 = 1500
    expect(rows[0].cumulativeRemaining).toBe(1600) // 1500 + 100
  })

  it('accumulates baseline across multiple prior years', () => {
    const prior2023 = makeAnalyticsData({
      year: 2023,
      monthlyTotalSavings: Array(12).fill(100), // 1200 total
    })
    const prior2024 = makeAnalyticsData({
      year: 2024,
      monthlyTotalSavings: Array(12).fill(200), // 2400 total
    })
    const data = makeAnalyticsData({
      year: 2025,
      monthlyTotalSavings: Array(12).fill(50),
    })

    const rows = buildYearTrendRows(data, [], 2025, 2026, 11, [prior2023, prior2024])
    // baseline = 1200 + 2400 = 3600
    expect(rows[0].cumulativeRemaining).toBe(3650) // 3600 + 50
    expect(rows[11].cumulativeRemaining).toBe(4200) // 3600 + (12 × 50)
  })

  it('treats loading prior year as zero baseline', () => {
    const loadingPrior = makeAnalyticsData({
      year: 2024,
      loading: true,
      monthlyTotalSavings: Array(12).fill(0),
    })
    const data = makeAnalyticsData({
      year: 2025,
      monthlyTotalSavings: Array(12).fill(300),
    })

    const rows = buildYearTrendRows(data, [], 2025, 2026, 11, [loadingPrior])
    expect(rows[0].cumulativeRemaining).toBe(300)
  })

  it('cumulativeRemaining can go negative and recover', () => {
    const monthlyTotalSavings: (number | null)[] = [1000, -500, -800, 200, 300, ...Array(7).fill(0)]
    const data = makeAnalyticsData({ year: 2025, monthlyTotalSavings })
    const rows = buildYearTrendRows(data, [], 2025, 2026, 11)

    expect(rows[0].cumulativeRemaining).toBe(1000)
    expect(rows[1].cumulativeRemaining).toBe(500)
    expect(rows[2].cumulativeRemaining).toBe(-300)
    expect(rows[3].cumulativeRemaining).toBe(-100)
    expect(rows[4].cumulativeRemaining).toBe(200)
  })

  it('first month correctly adds to prior baseline', () => {
    const prior = makeAnalyticsData({
      year: 2024,
      monthlyTotalSavings: Array(12).fill(1000), // 12000 total
    })
    const data = makeAnalyticsData({
      year: 2025,
      monthlyTotalSavings: [500, ...Array(11).fill(0)],
    })

    const rows = buildYearTrendRows(data, [], 2025, 2026, 11, [prior])
    expect(rows[0].cumulativeRemaining).toBe(12500) // 12000 + 500
    expect(rows[1].cumulativeRemaining).toBe(12500) // no change in Feb
  })

  it('empty priorYearsData array gives same result as undefined', () => {
    const data = makeAnalyticsData({
      year: 2025,
      monthlyTotalSavings: Array(12).fill(100),
    })

    const rowsNoPrior = buildYearTrendRows(data, [], 2025, 2026, 11)
    const rowsEmptyPrior = buildYearTrendRows(data, [], 2025, 2026, 11, [])

    expect(rowsNoPrior[0].cumulativeRemaining).toBe(rowsEmptyPrior[0].cumulativeRemaining)
    expect(rowsNoPrior[11].cumulativeRemaining).toBe(rowsEmptyPrior[11].cumulativeRemaining)
  })
})

// ── buildDailySpendingRows ────────────────────────────────────────────────────

describe('buildDailySpendingRows', () => {
  it('returns empty array when no expenses in month', () => {
    const rows = buildDailySpendingRows([], 2026, 4)
    expect(rows).toHaveLength(0)
  })

  it('returns empty array when expenses are in a different month', () => {
    const expenses = [makeExpense({ date: '2026-06-01', amount: 100 })]
    const rows = buildDailySpendingRows(expenses, 2026, 4) // May
    expect(rows).toHaveLength(0)
  })

  it('returns one row per day with expenses', () => {
    const expenses: Expense[] = [
      makeExpense({ id: 1, date: '2026-05-01', amount: 50 }),
      makeExpense({ id: 2, date: '2026-05-15', amount: 75 }),
      makeExpense({ id: 3, date: '2026-05-31', amount: 25 }),
    ]
    const rows = buildDailySpendingRows(expenses, 2026, 4)
    expect(rows).toHaveLength(3)
  })

  it('combines multiple expenses on the same day', () => {
    const expenses: Expense[] = [
      makeExpense({ id: 1, date: '2026-05-10', amount: 50 }),
      makeExpense({ id: 2, date: '2026-05-10', amount: 30 }),
      makeExpense({ id: 3, date: '2026-05-10', amount: 20 }),
    ]
    const rows = buildDailySpendingRows(expenses, 2026, 4)
    expect(rows).toHaveLength(1)
    expect(rows[0].dailySpent).toBe(100)
    expect(rows[0].expenseCount).toBe(3)
  })

  it('sorts rows by date ascending', () => {
    const expenses: Expense[] = [
      makeExpense({ id: 1, date: '2026-05-20', amount: 50 }),
      makeExpense({ id: 2, date: '2026-05-05', amount: 30 }),
      makeExpense({ id: 3, date: '2026-05-12', amount: 20 }),
    ]
    const rows = buildDailySpendingRows(expenses, 2026, 4)
    expect(rows[0].day).toBe(5)
    expect(rows[1].day).toBe(12)
    expect(rows[2].day).toBe(20)
  })

  it('computes correct cumulative totals', () => {
    const expenses: Expense[] = [
      makeExpense({ id: 1, date: '2026-05-01', amount: 100 }),
      makeExpense({ id: 2, date: '2026-05-05', amount: 200 }),
      makeExpense({ id: 3, date: '2026-05-10', amount: 50 }),
    ]
    const rows = buildDailySpendingRows(expenses, 2026, 4)
    expect(rows[0].cumulativeSpent).toBe(100)
    expect(rows[1].cumulativeSpent).toBe(300)
    expect(rows[2].cumulativeSpent).toBe(350)
  })

  it('parses day correctly from date string', () => {
    const expenses = [makeExpense({ date: '2026-05-07', amount: 10 })]
    const rows = buildDailySpendingRows(expenses, 2026, 4)
    expect(rows[0].day).toBe(7)
    expect(rows[0].date).toBe('2026-05-07')
  })

  it('includes negative amounts (refunds) without clamping', () => {
    const expenses: Expense[] = [
      makeExpense({ id: 1, date: '2026-05-01', amount: 100 }),
      makeExpense({ id: 2, date: '2026-05-01', amount: -30 }), // refund
    ]
    const rows = buildDailySpendingRows(expenses, 2026, 4)
    expect(rows[0].dailySpent).toBe(70)
  })
})

// ── buildCategoryBreakdown ────────────────────────────────────────────────────

describe('buildCategoryBreakdown', () => {
  it('returns empty array when no variableRows', () => {
    const data = makeAnalyticsData({ variableRows: [] })
    expect(buildCategoryBreakdown(data, 4)).toHaveLength(0)
  })

  it('excludes categories with zero amount for the month', () => {
    const variableRows = [
      { key: 'a', name: 'Groceries', amounts: Array(12).fill(0), yearTotal: 0 },
      { key: 'b', name: 'Dining', amounts: Array(12).fill(200), yearTotal: 2400 },
    ]
    const data = makeAnalyticsData({ variableRows })
    const rows = buildCategoryBreakdown(data, 4)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Dining')
  })

  it('sorts by amount descending', () => {
    const amounts = Array(12).fill(0)
    const variableRows = [
      {
        key: 'a',
        name: 'Small',
        amounts: amounts.map((_, i) => (i === 4 ? 50 : 0)),
        yearTotal: 50,
      },
      {
        key: 'b',
        name: 'Large',
        amounts: amounts.map((_, i) => (i === 4 ? 300 : 0)),
        yearTotal: 300,
      },
      {
        key: 'c',
        name: 'Medium',
        amounts: amounts.map((_, i) => (i === 4 ? 150 : 0)),
        yearTotal: 150,
      },
    ]
    const data = makeAnalyticsData({ variableRows })
    const rows = buildCategoryBreakdown(data, 4)
    expect(rows[0].name).toBe('Large')
    expect(rows[1].name).toBe('Medium')
    expect(rows[2].name).toBe('Small')
  })

  it('computes pct values that sum to ~100', () => {
    const amounts = Array(12).fill(0)
    const variableRows = [
      { key: 'a', name: 'A', amounts: amounts.map((_, i) => (i === 4 ? 300 : 0)), yearTotal: 300 },
      { key: 'b', name: 'B', amounts: amounts.map((_, i) => (i === 4 ? 200 : 0)), yearTotal: 200 },
    ]
    const data = makeAnalyticsData({ variableRows })
    const rows = buildCategoryBreakdown(data, 4)
    const totalPct = rows.reduce((sum, r) => sum + r.pct, 0)
    expect(totalPct).toBeCloseTo(100, 5)
    expect(rows[0].pct).toBeCloseTo(60, 5)
    expect(rows[1].pct).toBeCloseTo(40, 5)
  })

  it('sets all pct to 0 when total is 0', () => {
    const variableRows = [{ key: 'a', name: 'A', amounts: Array(12).fill(0), yearTotal: 0 }]
    const data = makeAnalyticsData({ variableRows })
    const rows = buildCategoryBreakdown(data, 4)
    // All amounts are 0 so the row is excluded
    expect(rows).toHaveLength(0)
  })
})

// ── buildPayeeBreakdown ───────────────────────────────────────────────────────

describe('buildPayeeBreakdown', () => {
  it('returns empty array when payeeRows is empty', () => {
    const data = makeAnalyticsData({ payeeRows: [] })
    expect(buildPayeeBreakdown(data, 4)).toHaveLength(0)
  })

  it('returns empty array when payeeRows is undefined-like (empty)', () => {
    const data = makeAnalyticsData({ payeeRows: [] })
    expect(buildPayeeBreakdown(data, 4)).toEqual([])
  })

  it('excludes payees with zero amount for the month', () => {
    const payeeRows = [
      { key: 'p1', name: 'Amazon', amounts: Array(12).fill(0), yearTotal: 0 },
      { key: 'p2', name: 'Costco', amounts: Array(12).fill(150), yearTotal: 1800 },
    ]
    const data = makeAnalyticsData({ payeeRows })
    const rows = buildPayeeBreakdown(data, 4)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Costco')
  })

  it('sorts by amount descending', () => {
    const amounts = Array(12).fill(0)
    const payeeRows = [
      {
        key: 'p1',
        name: 'Small',
        amounts: amounts.map((_, i) => (i === 4 ? 50 : 0)),
        yearTotal: 50,
      },
      {
        key: 'p2',
        name: 'Large',
        amounts: amounts.map((_, i) => (i === 4 ? 400 : 0)),
        yearTotal: 400,
      },
    ]
    const data = makeAnalyticsData({ payeeRows })
    const rows = buildPayeeBreakdown(data, 4)
    expect(rows[0].name).toBe('Large')
    expect(rows[1].name).toBe('Small')
  })

  it('computes pct values correctly', () => {
    const amounts = Array(12).fill(0)
    const payeeRows = [
      { key: 'p1', name: 'A', amounts: amounts.map((_, i) => (i === 4 ? 100 : 0)), yearTotal: 100 },
      { key: 'p2', name: 'B', amounts: amounts.map((_, i) => (i === 4 ? 400 : 0)), yearTotal: 400 },
    ]
    const data = makeAnalyticsData({ payeeRows })
    const rows = buildPayeeBreakdown(data, 4)
    expect(rows[0].pct).toBeCloseTo(80, 5) // 400/500
    expect(rows[1].pct).toBeCloseTo(20, 5) // 100/500
  })
})

// ── buildMonthDrilldownData ───────────────────────────────────────────────────

describe('buildMonthDrilldownData', () => {
  it('sets correct monthKey and monthLabel', () => {
    const data = makeAnalyticsData()
    const result = buildMonthDrilldownData(data, [], 2026, 4)
    expect(result.monthKey).toBe('2026-05')
    expect(result.monthLabel).toBe('May')
    expect(result.year).toBe(2026)
    expect(result.monthIndex).toBe(4)
  })

  it('sets savingsRate to null when income is 0', () => {
    const monthlyIncome = Array(12).fill(0)
    const data = makeAnalyticsData({ monthlyIncome })
    const result = buildMonthDrilldownData(data, [], 2026, 4)
    expect(result.savingsRate).toBeNull()
  })

  it('computes savingsRate correctly when income > 0', () => {
    const monthlyIncome = Array(12).fill(5000)
    const monthlyTotalSavings: (number | null)[] = Array(12).fill(1000)
    const data = makeAnalyticsData({ monthlyIncome, monthlyTotalSavings })
    const result = buildMonthDrilldownData(data, [], 2026, 4)
    expect(result.savingsRate).toBeCloseTo(20)
  })

  it('expensePreview contains at most 20 items', () => {
    const expenses: Expense[] = Array.from({ length: 25 }, (_, i) =>
      makeExpense({ id: i + 1, date: '2026-05-10', amount: (i + 1) * 10 }),
    )
    const data = makeAnalyticsData()
    const result = buildMonthDrilldownData(data, expenses, 2026, 4)
    expect(result.expensePreview).toHaveLength(20)
  })

  it('expensePreview is sorted by amount descending', () => {
    const expenses: Expense[] = [
      makeExpense({ id: 1, date: '2026-05-01', amount: 50 }),
      makeExpense({ id: 2, date: '2026-05-02', amount: 200 }),
      makeExpense({ id: 3, date: '2026-05-03', amount: 10 }),
    ]
    const data = makeAnalyticsData()
    const result = buildMonthDrilldownData(data, expenses, 2026, 4)
    expect(result.expensePreview[0].amount).toBe(200)
    expect(result.expensePreview[1].amount).toBe(50)
    expect(result.expensePreview[2].amount).toBe(10)
  })

  it('expensePreview only includes expenses from the selected month', () => {
    const expenses: Expense[] = [
      makeExpense({ id: 1, date: '2026-05-01', amount: 100 }),
      makeExpense({ id: 2, date: '2026-06-01', amount: 999 }), // different month
    ]
    const data = makeAnalyticsData()
    const result = buildMonthDrilldownData(data, expenses, 2026, 4)
    expect(result.expensePreview).toHaveLength(1)
    expect(result.expensePreview[0].amount).toBe(100)
  })

  it('returns empty payeeBreakdown when no payee data', () => {
    const data = makeAnalyticsData({ payeeRows: [] })
    const result = buildMonthDrilldownData(data, [], 2026, 4)
    expect(result.payeeBreakdown).toEqual([])
  })

  it('populates all sub-arrays', () => {
    const amounts = Array(12).fill(0)
    const variableRows = [
      {
        key: 'a',
        name: 'Groceries',
        amounts: amounts.map((_, i) => (i === 4 ? 300 : 0)),
        yearTotal: 300,
      },
    ]
    const expenses: Expense[] = [
      makeExpense({ id: 1, date: '2026-05-10', amount: 100 }),
      makeExpense({ id: 2, date: '2026-05-15', amount: 200 }),
    ]
    const data = makeAnalyticsData({ variableRows })
    const result = buildMonthDrilldownData(data, expenses, 2026, 4)
    expect(result.dailyRows).toHaveLength(2)
    expect(result.categoryBreakdown).toHaveLength(1)
    expect(result.categoryBreakdown[0].name).toBe('Groceries')
  })

  it('handles month where all expenses are refunds', () => {
    const expenses: Expense[] = [
      makeExpense({ id: 1, date: '2026-05-01', amount: -100 }),
      makeExpense({ id: 2, date: '2026-05-02', amount: -50 }),
    ]
    const data = makeAnalyticsData()
    const result = buildMonthDrilldownData(data, expenses, 2026, 4)
    expect(result.expensePreview[0].amount).toBe(-50)
    expect(result.expensePreview[1].amount).toBe(-100)
  })

  it('daily rows combine positive and negative amounts on same day', () => {
    const expenses: Expense[] = [
      makeExpense({ id: 1, date: '2026-05-10', amount: 200 }),
      makeExpense({ id: 2, date: '2026-05-10', amount: -50 }),
    ]
    const rows = buildDailySpendingRows(expenses, 2026, 4)
    expect(rows).toHaveLength(1)
    expect(rows[0].dailySpent).toBe(150)
    expect(rows[0].expenseCount).toBe(2)
  })
})
