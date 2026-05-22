import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FinanceEngineData } from '../types'
import { useDashboardData } from '../features/dashboard/hooks/useDashboardData'

const mockUseFinanceData = vi.fn()
const mockUseFinanceActions = vi.fn()

vi.mock('../context/financeDataContext', () => ({
  useFinanceData: () => mockUseFinanceData(),
  useFinanceActions: () => mockUseFinanceActions(),
}))

function makeEngineData(): FinanceEngineData {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  return {
    expenses: [],
    snapshots: [
      {
        fixedExpenseId: 1,
        nameSnapshot: 'Rent',
        amountSnapshot: 1000,
        year: currentYear - 1,
        month: 12,
      },
    ],
    fixedExpenses: [
      { id: 1, name: 'Rent', amount: 1500 },
      { id: 2, name: 'Archived', amount: 999, isArchived: true },
    ],
    globalIncome: 5000,
    globalSavingsRate: 20,
    schedules: [],
    incomeSnapshots: [{ year: currentYear, month: currentMonth + 1, amountSnapshot: 8000 }],
    savingsSnapshots: [{ year: currentYear, month: currentMonth + 1, rateSnapshot: 30 }],
  }
}

describe('useDashboardData', () => {
  beforeEach(() => {
    mockUseFinanceActions.mockReturnValue({ forceFinanceDataRefresh: vi.fn() })
    mockUseFinanceData.mockReturnValue({
      engineData: makeEngineData(),
      incomeAmount: '',
      incomeFrequency: 'monthly',
    })
  })

  it('uses active fixed definitions for the current month header summary', () => {
    const now = new Date()
    const result = renderHook(() =>
      useDashboardData(
        [
          {
            date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-03`,
            amount: 42,
          },
        ],
        now.getFullYear(),
        now.getMonth(),
        1,
      ),
    )

    expect(result.result.current.financialSummary?.income).toBe(8000)
    expect(result.result.current.financialSummary?.savingsRate).toBe(30)
    expect(result.result.current.financialSummary?.autoSavings).toBe(2400)
    expect(result.result.current.financialSummary?.fixedExpensesTotal).toBe(1500)
  })

  it('uses historical snapshots for past months', () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    mockUseFinanceData.mockReturnValue({
      engineData: {
        ...makeEngineData(),
        snapshots: [
          {
            fixedExpenseId: 1,
            nameSnapshot: 'Rent',
            amountSnapshot: 950,
            year: currentYear - 1,
            month: 12,
          },
        ],
        incomeSnapshots: [{ year: currentYear - 1, month: 12, amountSnapshot: 7000 }],
        savingsSnapshots: [{ year: currentYear - 1, month: 12, rateSnapshot: 10 }],
      },
      incomeAmount: '',
      incomeFrequency: 'monthly',
    })

    const result = renderHook(() =>
      useDashboardData([{ date: `${currentYear - 1}-12-03`, amount: 42 }], currentYear - 1, 11, 1),
    )

    expect(result.result.current.monthSummaries[0]?.fixedExpensesTotal).toBe(950)
    expect(result.result.current.monthSummaries[0]?.income).toBe(7000)
    expect(result.result.current.monthSummaries[0]?.savingsRate).toBe(10)
  })
})
