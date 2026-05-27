import { describe, expect, it } from 'vitest'
import { DASHBOARD_VIEWS } from '@/features/dashboard/constants'
import {
  monthKeyToParts,
  parseAnalyticsMonthParam,
  parseMonthParam,
  parseSpanParam,
  parseTrendDrilldownParam,
  parseTrendMonthParam,
  parseViewParam,
  parseYearParam,
  partsToMonthKey,
} from '@/lib/urlParams'

describe('parseMonthParam', () => {
  it('returns default when value is null', () => {
    expect(parseMonthParam(null, '2026-05')).toBe('2026-05')
  })

  it('returns default when value is empty', () => {
    expect(parseMonthParam('', '2026-05')).toBe('2026-05')
  })

  it('returns default when value is invalid format', () => {
    expect(parseMonthParam('bad', '2026-05')).toBe('2026-05')
    expect(parseMonthParam('2026-13', '2026-05')).toBe('2026-05')
    expect(parseMonthParam('2026-00', '2026-05')).toBe('2026-05')
    expect(parseMonthParam('26-05', '2026-05')).toBe('2026-05')
    expect(parseMonthParam('2026/05', '2026-05')).toBe('2026-05')
  })

  it('returns valid month key', () => {
    expect(parseMonthParam('2026-05', '2026-01')).toBe('2026-05')
    expect(parseMonthParam('2024-12', '2026-01')).toBe('2024-12')
    expect(parseMonthParam('2026-01', '2026-05')).toBe('2026-01')
  })
})

describe('parseYearParam', () => {
  it('returns default when value is null', () => {
    expect(parseYearParam(null, 2026)).toBe(2026)
  })

  it('returns default when value is not a number', () => {
    expect(parseYearParam('bad', 2026)).toBe(2026)
  })

  it('returns default when year is out of range', () => {
    expect(parseYearParam('1999', 2026)).toBe(2026)
    expect(parseYearParam('2101', 2026)).toBe(2026)
  })

  it('returns valid year', () => {
    expect(parseYearParam('2026', 2025)).toBe(2026)
    expect(parseYearParam('2000', 2026)).toBe(2000)
    expect(parseYearParam('2100', 2026)).toBe(2100)
  })
})

describe('parseViewParam', () => {
  it('returns categories when value is null', () => {
    expect(parseViewParam(null)).toBe(DASHBOARD_VIEWS.CATEGORIES)
  })

  it('returns categories when value is empty', () => {
    expect(parseViewParam('')).toBe(DASHBOARD_VIEWS.CATEGORIES)
  })

  it('returns categories when value is invalid', () => {
    expect(parseViewParam('bad')).toBe(DASHBOARD_VIEWS.CATEGORIES)
    expect(parseViewParam('list')).toBe(DASHBOARD_VIEWS.CATEGORIES)
  })

  it('returns valid view', () => {
    expect(parseViewParam('categories')).toBe(DASHBOARD_VIEWS.CATEGORIES)
    expect(parseViewParam('expenses')).toBe(DASHBOARD_VIEWS.EXPENSES)
  })
})

describe('parseSpanParam', () => {
  it('returns 1 when value is null', () => {
    expect(parseSpanParam(null)).toBe(1)
  })

  it('returns 1 when value is invalid', () => {
    expect(parseSpanParam('bad')).toBe(1)
    expect(parseSpanParam('4')).toBe(1)
    expect(parseSpanParam('5')).toBe(1)
    expect(parseSpanParam('10')).toBe(1)
  })

  it('returns valid span', () => {
    expect(parseSpanParam('1')).toBe(1)
    expect(parseSpanParam('2')).toBe(2)
    expect(parseSpanParam('3')).toBe(3)
    expect(parseSpanParam('6')).toBe(6)
    expect(parseSpanParam('12')).toBe(12)
  })
})

describe('parseAnalyticsMonthParam', () => {
  it('returns null when value is null', () => {
    expect(parseAnalyticsMonthParam(null, 11)).toBe(null)
  })

  it('returns null when value is not a number', () => {
    expect(parseAnalyticsMonthParam('bad', 11)).toBe(null)
  })

  it('returns null when month is out of range', () => {
    expect(parseAnalyticsMonthParam('-1', 11)).toBe(null)
    expect(parseAnalyticsMonthParam('12', 11)).toBe(null)
  })

  it('returns null when month exceeds maxMonth', () => {
    expect(parseAnalyticsMonthParam('6', 4)).toBe(null)
  })

  it('returns valid month', () => {
    expect(parseAnalyticsMonthParam('0', 11)).toBe(0)
    expect(parseAnalyticsMonthParam('4', 11)).toBe(4)
    expect(parseAnalyticsMonthParam('11', 11)).toBe(11)
  })
})

describe('monthKeyToParts', () => {
  it('converts month key to parts', () => {
    expect(monthKeyToParts('2026-05')).toEqual({ year: 2026, month: 4 })
    expect(monthKeyToParts('2026-01')).toEqual({ year: 2026, month: 0 })
    expect(monthKeyToParts('2026-12')).toEqual({ year: 2026, month: 11 })
    expect(monthKeyToParts('2024-03')).toEqual({ year: 2024, month: 2 })
  })
})

describe('partsToMonthKey', () => {
  it('converts parts to month key', () => {
    expect(partsToMonthKey(2026, 4)).toBe('2026-05')
    expect(partsToMonthKey(2026, 0)).toBe('2026-01')
    expect(partsToMonthKey(2026, 11)).toBe('2026-12')
    expect(partsToMonthKey(2024, 2)).toBe('2024-03')
  })

  it('roundtrips with monthKeyToParts', () => {
    const key = '2026-05'
    const parts = monthKeyToParts(key)
    expect(partsToMonthKey(parts.year, parts.month)).toBe(key)
  })
})

describe('parseTrendMonthParam', () => {
  it('parses valid YYYY-MM format', () => {
    expect(parseTrendMonthParam('2026-05')).toEqual({ year: 2026, monthIndex: 4 })
    expect(parseTrendMonthParam('2026-01')).toEqual({ year: 2026, monthIndex: 0 })
    expect(parseTrendMonthParam('2026-12')).toEqual({ year: 2026, monthIndex: 11 })
  })

  it('returns null for invalid formats', () => {
    expect(parseTrendMonthParam(null)).toBeNull()
    expect(parseTrendMonthParam('')).toBeNull()
    expect(parseTrendMonthParam('2026-13')).toBeNull()
    expect(parseTrendMonthParam('2026-00')).toBeNull()
    expect(parseTrendMonthParam('26-05')).toBeNull()
    expect(parseTrendMonthParam('2026/05')).toBeNull()
    expect(parseTrendMonthParam('May 2026')).toBeNull()
  })

  it('returns null for years outside 2000-2100', () => {
    expect(parseTrendMonthParam('1999-05')).toBeNull()
    expect(parseTrendMonthParam('2101-05')).toBeNull()
  })

  it('converts 1-indexed month to 0-indexed monthIndex', () => {
    expect(parseTrendMonthParam('2026-01')?.monthIndex).toBe(0)
    expect(parseTrendMonthParam('2026-12')?.monthIndex).toBe(11)
  })
})

describe('parseTrendDrilldownParam', () => {
  it("returns true only for '1'", () => {
    expect(parseTrendDrilldownParam('1')).toBe(true)
  })

  it('returns false for anything else', () => {
    expect(parseTrendDrilldownParam(null)).toBe(false)
    expect(parseTrendDrilldownParam('')).toBe(false)
    expect(parseTrendDrilldownParam('true')).toBe(false)
    expect(parseTrendDrilldownParam('yes')).toBe(false)
    expect(parseTrendDrilldownParam('0')).toBe(false)
  })
})
