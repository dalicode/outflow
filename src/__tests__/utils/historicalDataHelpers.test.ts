import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RangeItem } from '@/utils/historicalDataHelpers'
import {
  checkRangeOverlaps,
  findGapToFill,
  flattenRangesToMonthMap,
  getMaxMonthForYear,
  getYearlyVariableTotals,
  isFullyCovered,
  monthMapToRanges,
  parseISODate,
  removeRangeAndMerge,
  shouldMaterializeNow,
  toISODate,
  updateRangeEndAndCascade,
} from '@/utils/historicalDataHelpers'

const makeRange = (id: string, startMonth: number, endMonth: number): RangeItem => ({
  id,
  amount: '100',
  startMonth,
  endMonth,
})

describe('getMaxMonthForYear', () => {
  function mockDate(year: number, month: number) {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(year, month - 1, 15))
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 12 for past years', () => {
    mockDate(2025, 6)
    expect(getMaxMonthForYear(2024)).toBe(12)
    vi.useRealTimers()
  })

  it('returns currentMonth - 1 for current year', () => {
    mockDate(2025, 6)
    expect(getMaxMonthForYear(2025)).toBe(5)
    vi.useRealTimers()
  })

  it('returns 0 for current year in January', () => {
    mockDate(2025, 1)
    expect(getMaxMonthForYear(2025)).toBe(0)
    vi.useRealTimers()
  })

  it('returns 12 for future years', () => {
    mockDate(2025, 6)
    expect(getMaxMonthForYear(2026)).toBe(12)
    vi.useRealTimers()
  })
})

describe('findGapToFill', () => {
  it('returns full year when no ranges exist', () => {
    expect(findGapToFill([], 12)).toEqual({ startMonth: 1, endMonth: 12 })
  })

  it('fills gap after last range when there is a range starting mid-year', () => {
    const ranges = [makeRange('a', 4, 12)]
    expect(findGapToFill(ranges, 12)).toBeNull() // already reaches maxMonth
  })

  it('fills gap between ranges', () => {
    const ranges = [makeRange('a', 1, 3), makeRange('b', 7, 12)]
    expect(findGapToFill(ranges, 12)).toEqual({ startMonth: 4, endMonth: 6 })
  })

  it('extends tail when no internal gaps', () => {
    const ranges = [makeRange('a', 1, 6)]
    expect(findGapToFill(ranges, 12)).toEqual({ startMonth: 7, endMonth: 12 })
  })

  it('returns null when fully covered', () => {
    const ranges = [makeRange('a', 1, 12)]
    expect(findGapToFill(ranges, 12)).toBeNull()
  })

  it('returns null for multiple contiguous ranges covering full year', () => {
    const ranges = [makeRange('a', 1, 3), makeRange('b', 4, 8), makeRange('c', 9, 12)]
    expect(findGapToFill(ranges, 12)).toBeNull()
  })

  it('respects maxMonth less than 12', () => {
    const ranges = [makeRange('a', 1, 3)]
    expect(findGapToFill(ranges, 5)).toEqual({ startMonth: 4, endMonth: 5 })
  })
})

describe('removeRangeAndMerge', () => {
  it('removes middle range leaving neighbors unchanged', () => {
    const ranges = [makeRange('a', 1, 3), makeRange('b', 4, 6), makeRange('c', 7, 12)]
    const result = removeRangeAndMerge(ranges, 'b')
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.id === 'a')).toEqual(makeRange('a', 1, 3))
    expect(result.find((r) => r.id === 'c')).toEqual(makeRange('c', 7, 12))
  })

  it('removes last range leaving previous unchanged', () => {
    const ranges = [makeRange('a', 1, 3), makeRange('b', 4, 12)]
    const result = removeRangeAndMerge(ranges, 'b')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(makeRange('a', 1, 3))
  })

  it('removes only range and returns empty array', () => {
    const ranges = [makeRange('a', 1, 12)]
    const result = removeRangeAndMerge(ranges, 'a')
    expect(result).toHaveLength(0)
  })

  it('returns unchanged array when id not found', () => {
    const ranges = [makeRange('a', 1, 6)]
    const result = removeRangeAndMerge(ranges, 'missing')
    expect(result).toEqual(ranges)
  })
})

describe('updateRangeEndAndCascade', () => {
  it('leaves next range start unchanged when endMonth shrinks (gap allowed)', () => {
    const ranges = [makeRange('a', 1, 6), makeRange('b', 7, 12)]
    const result = updateRangeEndAndCascade(ranges, 'a', 4)
    const a = result.find((r) => r.id === 'a') as RangeItem
    const b = result.find((r) => r.id === 'b') as RangeItem
    expect(a.endMonth).toBe(4)
    expect(b.startMonth).toBe(7) // unchanged — gap is fine
  })

  it('pushes next range start forward when endMonth overlaps it', () => {
    const ranges = [makeRange('a', 1, 6), makeRange('b', 7, 12)]
    const result = updateRangeEndAndCascade(ranges, 'a', 9)
    const a = result.find((r) => r.id === 'a') as RangeItem
    const b = result.find((r) => r.id === 'b') as RangeItem
    expect(a.endMonth).toBe(9)
    expect(b.startMonth).toBe(10)
  })

  it('removes squeezed range when overlap collapses it', () => {
    const ranges = [makeRange('a', 1, 6), makeRange('b', 7, 8), makeRange('c', 9, 12)]
    const result = updateRangeEndAndCascade(ranges, 'a', 9)
    expect(result).toHaveLength(2)
    const a = result.find((r) => r.id === 'a') as RangeItem
    const c = result.find((r) => r.id === 'c') as RangeItem
    expect(a.endMonth).toBe(9)
    expect(c.startMonth).toBe(10)
  })

  it('returns unchanged when id not found', () => {
    const ranges = [makeRange('a', 1, 6)]
    const result = updateRangeEndAndCascade(ranges, 'missing', 4)
    expect(result).toEqual(ranges)
  })

  it('handles single range without crash', () => {
    const ranges = [makeRange('a', 1, 12)]
    const result = updateRangeEndAndCascade(ranges, 'a', 6)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ ...makeRange('a', 1, 12), endMonth: 6 })
  })
})

describe('checkRangeOverlaps', () => {
  it('returns empty for valid contiguous ranges', () => {
    const ranges = [makeRange('a', 1, 3), makeRange('b', 4, 12)]
    expect(checkRangeOverlaps(ranges, 'Income')).toEqual([])
  })

  it('detects overlap', () => {
    const ranges = [makeRange('a', 1, 5), makeRange('b', 4, 12)]
    expect(checkRangeOverlaps(ranges, 'Income')).toContain('Income ranges must not overlap.')
  })

  it('detects gap', () => {
    // Gaps are now allowed — no error expected
    const ranges = [makeRange('a', 1, 3), makeRange('b', 5, 12)]
    expect(checkRangeOverlaps(ranges, 'Savings')).toEqual([])
  })

  it('detects inverted range', () => {
    const ranges = [{ id: 'a', amount: '100', startMonth: 6, endMonth: 3 }]
    expect(checkRangeOverlaps(ranges, 'Income')).toContain(
      'Income start month must be ≤ end month.',
    )
  })
})

describe('isFullyCovered', () => {
  it('returns false for empty ranges', () => {
    expect(isFullyCovered([], 12)).toBe(false)
  })

  it('returns true when first range does not start at 1 but is internally contiguous and reaches maxMonth', () => {
    expect(isFullyCovered([makeRange('a', 2, 12)], 12)).toBe(true)
  })

  it('returns false when there is a gap between ranges', () => {
    expect(isFullyCovered([makeRange('a', 1, 3), makeRange('b', 5, 12)], 12)).toBe(false)
  })

  it('returns false when tail does not reach maxMonth', () => {
    expect(isFullyCovered([makeRange('a', 1, 6)], 12)).toBe(false)
  })

  it('returns true for single full-year range', () => {
    expect(isFullyCovered([makeRange('a', 1, 12)], 12)).toBe(true)
  })

  it('returns true for multiple contiguous ranges covering full year', () => {
    const ranges = [makeRange('a', 1, 4), makeRange('b', 5, 8), makeRange('c', 9, 12)]
    expect(isFullyCovered(ranges, 12)).toBe(true)
  })
})

describe('monthMapToRanges', () => {
  it('converts a contiguous month map to a single range', () => {
    const map: Record<number, number> = {}
    for (let m = 1; m <= 12; m++) map[m] = 5000
    const result = monthMapToRanges(map)
    expect(result).toHaveLength(1)
    expect(result[0].startMonth).toBe(1)
    expect(result[0].endMonth).toBe(12)
    expect(result[0].amount).toBe(5000)
  })

  it('merges adjacent money values that are equivalent at cent precision', () => {
    const result = monthMapToRanges({
      1: 5221.3,
      2: 5221.3,
      3: 5221.3,
      4: 5221.3,
      5: 5221.3000000001,
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ startMonth: 1, endMonth: 5, amount: 5221.3 })
  })

  it('merges adjacent savings rates that are equivalent at input precision', () => {
    const result = monthMapToRanges({
      1: 18.2,
      2: 18.2000000001,
      3: 18.204,
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ startMonth: 1, endMonth: 3, amount: 18.2 })
  })

  it('splits on gaps into multiple ranges', () => {
    const map: Record<number, number | null | undefined> = {
      1: 5000,
      2: 5000,
      3: 5000,
      4: null,
      5: 5500,
      6: 5500,
      7: undefined,
      8: 5000,
      9: 5000,
      10: 5000,
      11: 5000,
      12: 5000,
    }
    const result = monthMapToRanges(map)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ startMonth: 1, endMonth: 3, amount: 5000 })
    expect(result[1]).toMatchObject({ startMonth: 5, endMonth: 6, amount: 5500 })
    expect(result[2]).toMatchObject({ startMonth: 8, endMonth: 12, amount: 5000 })
  })

  it('treats zero values as gaps', () => {
    const map: Record<number, number | null | undefined> = {
      1: 100,
      2: 100,
      3: 0,
      4: 100,
      5: 100,
    }
    const result = monthMapToRanges(map)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ startMonth: 1, endMonth: 2, amount: 100 })
    expect(result[1]).toMatchObject({ startMonth: 4, endMonth: 5, amount: 100 })
  })

  it('returns empty array for empty map', () => {
    expect(monthMapToRanges({})).toEqual([])
  })
})

describe('flattenRangesToMonthMap', () => {
  it('flattens a single range into month map', () => {
    const ranges = [makeRange('a', 3, 6)]
    const map = flattenRangesToMonthMap(ranges)
    expect(Object.keys(map)).toHaveLength(4)
    expect(map[3]).toBe(100)
    expect(map[6]).toBe(100)
    expect(map[2]).toBeUndefined()
    expect(map[7]).toBeUndefined()
  })

  it('flattens multiple ranges', () => {
    const ranges = [
      { id: 'a', amount: '5000', startMonth: 1, endMonth: 3 },
      { id: 'b', amount: '5500', startMonth: 4, endMonth: 6 },
    ]
    const map = flattenRangesToMonthMap(ranges)
    expect(map[1]).toBe(5000)
    expect(map[3]).toBe(5000)
    expect(map[4]).toBe(5500)
    expect(map[6]).toBe(5500)
  })

  it('skips ranges with invalid amounts', () => {
    const ranges = [
      { id: 'a', amount: 'bad', startMonth: 1, endMonth: 3 },
      { id: 'b', amount: '200', startMonth: 4, endMonth: 6 },
    ]
    const map = flattenRangesToMonthMap(ranges)
    expect(map[1]).toBeUndefined()
    expect(map[4]).toBe(200)
  })

  it('handles empty ranges', () => {
    expect(flattenRangesToMonthMap([])).toEqual({})
  })
})

describe('getYearlyVariableTotals', () => {
  it('returns zeros for empty expenses', () => {
    const result = getYearlyVariableTotals(2024, [])
    expect(result).toEqual(Array(12).fill(0))
  })

  it('sums expenses by month for matching year', () => {
    const expenses = [
      { date: '2024-01-15', amount: 100 },
      { date: '2024-01-20', amount: 50 },
      { date: '2024-03-10', amount: 75 },
      { date: '2024-12-01', amount: 200 },
    ]
    const result = getYearlyVariableTotals(2024, expenses)
    expect(result[0]).toBe(150) // Jan
    expect(result[1]).toBe(0) // Feb
    expect(result[2]).toBe(75) // Mar
    expect(result[11]).toBe(200) // Dec
  })

  it('ignores expenses from other years', () => {
    const expenses = [
      { date: '2023-06-15', amount: 100 },
      { date: '2025-06-15', amount: 200 },
    ]
    const result = getYearlyVariableTotals(2024, expenses)
    expect(result.every((v) => v === 0)).toBe(true)
  })

  it('ignores expenses with missing date or amount', () => {
    const expenses = [{ date: '2024-01-15' }, { amount: 100 }, { date: '2024-02-10', amount: 50 }]
    const result = getYearlyVariableTotals(2024, expenses)
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(50)
  })
})

describe('toISODate', () => {
  it('formats single-digit month and day with leading zeros', () => {
    expect(toISODate(2026, 3, 5)).toBe('2026-03-05')
  })

  it('formats double-digit month and day as-is', () => {
    expect(toISODate(2026, 12, 25)).toBe('2026-12-25')
  })
})

describe('parseISODate', () => {
  it('parses valid ISO date string', () => {
    expect(parseISODate('2026-05-15')).toEqual({ year: 2026, month: 5, day: 15 })
  })

  it('returns null for invalid format', () => {
    expect(parseISODate('05-15-2026')).toBeNull()
    expect(parseISODate('2026/05/15')).toBeNull()
    expect(parseISODate('')).toBeNull()
  })
})

describe('shouldMaterializeNow', () => {
  it('returns true when schedule year is in the past', () => {
    expect(shouldMaterializeNow(2024, 6, 2025, 3)).toBe(true)
  })

  it('returns true when schedule month is current or past in same year', () => {
    expect(shouldMaterializeNow(2025, 3, 2025, 3)).toBe(true)
    expect(shouldMaterializeNow(2025, 2, 2025, 3)).toBe(true)
  })

  it('returns false when schedule month is in the future', () => {
    expect(shouldMaterializeNow(2025, 4, 2025, 3)).toBe(false)
  })

  it('returns false when schedule year is in the future', () => {
    expect(shouldMaterializeNow(2026, 1, 2025, 12)).toBe(false)
  })
})
