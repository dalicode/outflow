import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getBudgetPaceStatus,
  getBudgetPaceSummary,
  getCurrentDayForSummary,
  getDailySpendingRows,
  getDaysInMonth,
} from '../features/summary/utils/budgetPaceUtils'
import type { Expense } from '../types'

function setNow(year: number, month: number, day: number): void {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(year, month - 1, day, 12, 0, 0))
}

afterEach(() => {
  vi.useRealTimers()
})

describe('budgetPaceUtils', () => {
  it('calculates current month pace and excludes future expenses', () => {
    setNow(2026, 5, 18)

    const expenses: Expense[] = [
      { date: '2026-05-01', amount: 1000 },
      { date: '2026-05-18', amount: 350 },
      { date: '2026-05-19', amount: 200 },
    ]

    const summary = getBudgetPaceSummary({
      expenses,
      selectedYear: 2026,
      selectedMonth: 4,
      monthlyBudget: 2000,
    })

    expect(summary.daysInMonth).toBe(31)
    expect(summary.currentDayForSummary).toBe(18)
    expect(summary.daysElapsed).toBe(18)
    expect(summary.daysRemaining).toBe(13)
    expect(summary.spentSoFar).toBe(1350)
    expect(summary.budgetRemaining).toBe(650)
    expect(summary.safeDailySpend).toBe(50)
    expect(summary.currentAverageDailySpend).toBeCloseTo(75, 2)
    expect(summary.monthElapsedPercent).toBeCloseTo(18 / 31, 6)
    expect(summary.budgetUsedPercent).toBeCloseTo(0.675, 6)
    expect(summary.idealSpendToDate).toBeCloseTo(1161.29, 2)
    expect(summary.paceDifference).toBeCloseTo(188.71, 2)
    expect(summary.status).toBe('Slightly ahead of pace')
    expect(summary.dailyRows[17]).toMatchObject({
      day: 18,
      date: '2026-05-18',
      dailySpent: 350,
      cumulativeSpent: 1350,
      isToday: true,
      isFutureDay: false,
    })
    expect(summary.dailyRows[18]).toMatchObject({
      day: 19,
      date: '2026-05-19',
      dailySpent: null,
      cumulativeSpent: null,
      isFutureDay: true,
    })
  })

  it('treats past months as complete', () => {
    setNow(2026, 5, 18)

    const summary = getBudgetPaceSummary({
      expenses: [
        { date: '2026-04-01', amount: 300 },
        { date: '2026-04-30', amount: 500 },
      ],
      selectedYear: 2026,
      selectedMonth: 3,
      monthlyBudget: 600,
    })

    expect(summary.daysInMonth).toBe(30)
    expect(summary.currentDayForSummary).toBe(30)
    expect(summary.daysElapsed).toBe(30)
    expect(summary.daysRemaining).toBe(0)
    expect(summary.spentSoFar).toBe(800)
    expect(summary.status).toBe('Month complete')
    expect(summary.budgetRemaining).toBe(-200)
  })

  it('returns a graceful no-budget state', () => {
    setNow(2026, 5, 18)

    const summary = getBudgetPaceSummary({
      expenses: [{ date: '2026-05-01', amount: 75 }],
      selectedYear: 2026,
      selectedMonth: 4,
      monthlyBudget: null,
    })

    expect(summary.status).toBe('No budget set')
    expect(summary.budgetRemaining).toBeNull()
    expect(summary.safeDailySpend).toBeNull()
    expect(summary.budgetUsedPercent).toBeNull()
  })

  it('builds ISO daily rows and keeps future days empty', () => {
    const rows = getDailySpendingRows(
      [
        { date: '2026-05-01', amount: 20 },
        { date: '2026-05-02', amount: 30 },
        { date: '2026-05-03', amount: 40 },
      ],
      2026,
      4,
      2,
      31,
    )

    expect(rows[0]).toMatchObject({
      day: 1,
      date: '2026-05-01',
      dailySpent: 20,
      cumulativeSpent: 20,
      isFutureDay: false,
    })
    expect(rows[1]).toMatchObject({
      day: 2,
      date: '2026-05-02',
      dailySpent: 30,
      cumulativeSpent: 50,
      isFutureDay: false,
    })
    expect(rows[2]).toMatchObject({
      day: 3,
      date: '2026-05-03',
      dailySpent: null,
      cumulativeSpent: null,
      isFutureDay: true,
    })
  })

  it('gets current day and month length from the selected month context', () => {
    setNow(2026, 5, 18)

    expect(getDaysInMonth(2026, 4)).toBe(31)
    expect(getCurrentDayForSummary(2026, 4)).toBe(18)
    expect(getCurrentDayForSummary(2026, 3)).toBe(30)
    expect(
      getBudgetPaceStatus({
        monthlyBudget: 1000,
        spentSoFar: 100,
        daysElapsed: 10,
        budgetUsedPercent: 0.1,
        monthElapsedPercent: 0.2,
        isMonthComplete: false,
      }),
    ).toBe('Under budget pace')

    expect(
      getBudgetPaceStatus({
        monthlyBudget: 1000,
        spentSoFar: 0,
        daysElapsed: 0,
        budgetUsedPercent: 0,
        monthElapsedPercent: 0,
        isMonthComplete: false,
      }),
    ).toBe('No spending yet')
  })
})
