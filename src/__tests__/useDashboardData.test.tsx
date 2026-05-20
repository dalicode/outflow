import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDashboardData } from '../features/dashboard/hooks/useDashboardData'
import { StorageService } from '../services/storageService'
import type { Expense } from '../types'

vi.mock('../services/storageService', () => ({
  StorageService: {
    getFixedExpenses: vi.fn(),
    getSnapshotsForYear: vi.fn(),
    getSetting: vi.fn(),
    getActiveSchedules: vi.fn(),
    getIncomeSnapshotsForYear: vi.fn(),
    getSavingsSnapshotsForYear: vi.fn(),
  },
}))

function makeExpense(date: string, amount: number): Expense {
  return { date, amount }
}

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.mocked(StorageService.getFixedExpenses).mockResolvedValue([
      { id: 1, name: 'Rent', amount: 1500 },
    ])
    vi.mocked(StorageService.getSnapshotsForYear).mockResolvedValue([])
    vi.mocked(StorageService.getSetting).mockImplementation(
      async (key: string, fallback: unknown) => {
        if (key === 'monthlyIncome') return 5000
        if (key === 'savingsRate') return 20
        if (key === 'incomeAmount') return ''
        if (key === 'incomeFrequency') return 'monthly'
        return fallback
      },
    )
    vi.mocked(StorageService.getActiveSchedules).mockResolvedValue([])
    vi.mocked(StorageService.getIncomeSnapshotsForYear).mockResolvedValue([
      { year: 2026, month: 5, amountSnapshot: 8000 },
    ])
    vi.mocked(StorageService.getSavingsSnapshotsForYear).mockResolvedValue([
      { year: 2026, month: 5, rateSnapshot: 30 },
    ])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses active fixed definitions for the current month header summary', async () => {
    const current = new Date()
    const currentYear = current.getFullYear()
    const currentMonth = current.getMonth()

    vi.mocked(StorageService.getFixedExpenses).mockResolvedValue([
      { id: 1, name: 'Rent', amount: 1500 },
    ])
    vi.mocked(StorageService.getIncomeSnapshotsForYear).mockResolvedValue([
      { year: currentYear, month: currentMonth + 1, amountSnapshot: 8000 },
    ])
    vi.mocked(StorageService.getSavingsSnapshotsForYear).mockResolvedValue([
      { year: currentYear, month: currentMonth + 1, rateSnapshot: 30 },
    ])

    const { result } = renderHook(() =>
      useDashboardData(
        [makeExpense(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-03`, 42)],
        currentYear,
        currentMonth,
        1,
        0,
      ),
    )

    await waitFor(() => {
      expect(result.current.financialSummary).not.toBeNull()
    })

    expect(result.current.financialSummary?.income).toBe(8000)
    expect(result.current.financialSummary?.savingsRate).toBe(30)
    expect(result.current.financialSummary?.autoSavings).toBe(2400)
    expect(result.current.financialSummary?.fixedExpensesTotal).toBe(1500)
  })

  it('reloads dashboard summaries when dataRefreshKey changes after income/savings edits', async () => {
    const current = new Date()
    const currentYear = current.getFullYear()
    const currentMonth = current.getMonth()
    const currentMonthDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-03`

    let incomeSnapshotAmount = 6000
    let savingsSnapshotRate = 10

    vi.mocked(StorageService.getIncomeSnapshotsForYear).mockImplementation(async (year: number) => {
      if (year !== currentYear) return []
      return [{ year: currentYear, month: currentMonth + 1, amountSnapshot: incomeSnapshotAmount }]
    })

    vi.mocked(StorageService.getSavingsSnapshotsForYear).mockImplementation(
      async (year: number) => {
        if (year !== currentYear) return []
        return [{ year: currentYear, month: currentMonth + 1, rateSnapshot: savingsSnapshotRate }]
      },
    )

    const { result, rerender } = renderHook(
      ({ refreshKey }) =>
        useDashboardData(
          [makeExpense(currentMonthDate, 42)],
          currentYear,
          currentMonth,
          1,
          refreshKey,
        ),
      { initialProps: { refreshKey: 0 } },
    )

    await waitFor(() => {
      expect(result.current.financialSummary).not.toBeNull()
    })

    expect(result.current.financialSummary?.income).toBe(6000)
    expect(result.current.financialSummary?.savingsRate).toBe(10)
    expect(result.current.monthSummaries[0]?.income).toBe(6000)
    expect(result.current.monthSummaries[0]?.savingsRate).toBe(10)

    incomeSnapshotAmount = 7500
    savingsSnapshotRate = 25
    rerender({ refreshKey: 1 })

    await waitFor(() => {
      expect(result.current.financialSummary?.income).toBe(7500)
    })

    expect(result.current.financialSummary?.savingsRate).toBe(25)
    expect(result.current.monthSummaries[0]?.income).toBe(7500)
    expect(result.current.monthSummaries[0]?.savingsRate).toBe(25)
  })
})
