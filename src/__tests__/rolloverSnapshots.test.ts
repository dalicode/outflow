import { describe, expect, it } from 'vitest'

/**
 * Pure helper: compute months to snapshot between last open and current.
 * Includes last open month; excludes current month.
 */
function getGapMonths(
  lastYear: number,
  lastMonth: number,
  currentYear: number,
  currentMonth: number,
): { year: number; month: number }[] {
  const gaps: { year: number; month: number }[] = []
  let y = lastYear
  let m = lastMonth
  while (true) {
    if (y === currentYear && m === currentMonth) break
    gaps.push({ year: y, month: m })
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return gaps
}

describe('getGapMonths', () => {
  it('returns only last open month when current follows immediately', () => {
    expect(getGapMonths(2024, 3, 2024, 4)).toEqual([{ year: 2024, month: 3 }])
  })

  it('returns single month including last open', () => {
    expect(getGapMonths(2024, 3, 2024, 5)).toEqual([
      { year: 2024, month: 3 },
      { year: 2024, month: 4 },
    ])
  })

  it('returns multiple months', () => {
    expect(getGapMonths(2024, 3, 2024, 7)).toEqual([
      { year: 2024, month: 3 },
      { year: 2024, month: 4 },
      { year: 2024, month: 5 },
      { year: 2024, month: 6 },
    ])
  })

  it('handles year boundary', () => {
    expect(getGapMonths(2024, 11, 2025, 2)).toEqual([
      { year: 2024, month: 11 },
      { year: 2024, month: 12 },
      { year: 2025, month: 1 },
    ])
  })

  it('stops before current month', () => {
    const gaps = getGapMonths(2024, 1, 2024, 6)
    const hasCurrent = gaps.some((g) => g.year === 2024 && g.month === 6)
    expect(hasCurrent).toBe(false)
    expect(gaps).toHaveLength(5)
  })
})

describe('always-global rollover logic', () => {
  it('uses global value for all gap months', () => {
    const gaps = getGapMonths(2024, 1, 2024, 5)
    const globalIncome = 5000

    const results = gaps.map((g) => ({
      year: g.year,
      month: g.month,
      amountSnapshot: globalIncome,
    }))

    expect(results).toEqual([
      { year: 2024, month: 1, amountSnapshot: 5000 },
      { year: 2024, month: 2, amountSnapshot: 5000 },
      { year: 2024, month: 3, amountSnapshot: 5000 },
      { year: 2024, month: 4, amountSnapshot: 5000 },
    ])
  })

  it('ignores prior snapshots and always uses global', () => {
    const gaps = getGapMonths(2024, 3, 2024, 7)
    const globalIncome = 6000

    const results = gaps.map((g) => ({
      year: g.year,
      month: g.month,
      amountSnapshot: globalIncome,
    }))

    expect(results).toEqual([
      { year: 2024, month: 3, amountSnapshot: 6000 },
      { year: 2024, month: 4, amountSnapshot: 6000 },
      { year: 2024, month: 5, amountSnapshot: 6000 },
      { year: 2024, month: 6, amountSnapshot: 6000 },
    ])
  })

  it('handles year boundary with global', () => {
    const gaps = getGapMonths(2024, 11, 2025, 2)
    const globalIncome = 5500

    const results = gaps.map((g) => ({
      year: g.year,
      month: g.month,
      amountSnapshot: globalIncome,
    }))

    expect(results).toEqual([
      { year: 2024, month: 11, amountSnapshot: 5500 },
      { year: 2024, month: 12, amountSnapshot: 5500 },
      { year: 2025, month: 1, amountSnapshot: 5500 },
    ])
  })
})
