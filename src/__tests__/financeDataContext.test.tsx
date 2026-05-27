import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FinanceDataProvider,
  useFinanceActions,
  useFinanceData,
  useFinanceStatus,
} from '../context/financeDataContext'

const mockUseLiveQuery = vi.fn()
const mockSyncLocalChanges = vi.fn().mockResolvedValue(undefined)

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (...args: unknown[]) => mockUseLiveQuery(...args),
}))

vi.mock('../context/authContext', () => ({
  useAuth: () => ({
    syncLocalChanges: mockSyncLocalChanges,
  }),
}))

vi.mock('../services/repositories/expenseRepository', () => ({
  getAll: vi.fn(),
}))

vi.mock('../services/repositories/categoryRepository', () => ({
  getCategories: vi.fn(),
}))

vi.mock('../services/repositories/expenseSplitRepository', () => ({
  getExpenseSplits: vi.fn(),
}))

vi.mock('../services/repositories/payeeRepository', () => ({
  getPayees: vi.fn(),
}))

vi.mock('../services/repositories/fixedExpenseRepository', () => ({
  getFixedExpenses: vi.fn(),
  getFixedExpenseSnapshots: vi.fn(),
  addFixedExpense: vi.fn(),
  updateFixedExpense: vi.fn(),
  removeFixedExpense: vi.fn(),
}))

vi.mock('../services/repositories/snapshotRepository', () => ({
  getIncomeSnapshots: vi.fn(),
  getSavingsSnapshots: vi.fn(),
  setIncomeSnapshot: vi.fn(),
  setSavingsSnapshot: vi.fn(),
}))

vi.mock('../services/repositories/scheduleRepository', () => ({
  getSchedules: vi.fn(),
}))

vi.mock('../services/repositories/settingsRepository', () => ({
  getSettingsRows: vi.fn(),
  setSetting: vi.fn(),
}))

vi.mock('../services/repositories/historicalSnapshotRepository', () => ({
  saveHistoricalSnapshotConfigs: vi.fn(),
}))

import { saveHistoricalSnapshotConfigs } from '../services/repositories/historicalSnapshotRepository'
import { setSetting } from '../services/repositories/settingsRepository'

const wrapper = ({ children }: { children: ReactNode }) => (
  <FinanceDataProvider>{children}</FinanceDataProvider>
)

function mockLiveResults(results: unknown[]) {
  let index = 0
  mockUseLiveQuery.mockImplementation(() => {
    const result = results[index % results.length]
    index += 1
    return result
  })
}

describe('FinanceDataProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSyncLocalChanges.mockResolvedValue(undefined)
  })

  it('exposes safe defaults while live queries are loading', () => {
    mockLiveResults(Array(10).fill(undefined))

    const { result } = renderHook(
      () => ({
        data: useFinanceData(),
        status: useFinanceStatus(),
      }),
      { wrapper },
    )

    expect(result.current.status.isLoading).toBe(true)
    expect(result.current.data.engineData.expenses).toEqual([])
    expect(result.current.data.activeFixedExpenses).toEqual([])
    expect(result.current.data.incomeAmount).toBe('')
    expect(result.current.data.incomeFrequency).toBe('monthly')
  })

  it('builds finance engine data from live query rows', () => {
    mockLiveResults([
      [{ id: 1, date: '2026-05-01', amount: 10 }],
      [{ id: 1, name: 'Food' }],
      [{ id: 1, date: '2026-05-01', amount: 10 }],
      [{ id: 1, name: 'Store' }],
      [
        { id: 1, name: 'Rent', amount: 1200 },
        { id: 2, name: 'Old Gym', amount: 50, isArchived: true },
      ],
      [{ fixedExpenseId: 1, year: 2025, month: 1, amountSnapshot: 1000, nameSnapshot: 'Rent' }],
      [{ year: 2026, month: 5, amountSnapshot: 5000 }],
      [{ year: 2026, month: 5, rateSnapshot: 20 }],
      [
        {
          id: 1,
          type: 'income',
          effectiveYear: 2026,
          effectiveMonth: 6,
          newValue: 5500,
          isActive: 1,
        },
        {
          id: 2,
          type: 'savings',
          effectiveYear: 2026,
          effectiveMonth: 1,
          newValue: 25,
          isActive: 0,
        },
      ],
      [
        { key: 'monthlyIncome', value: 5000 },
        { key: 'savingsRate', value: 20 },
        { key: 'incomeAmount', value: '5000' },
        { key: 'incomeFrequency', value: 'monthly' },
      ],
    ])

    const { result } = renderHook(() => useFinanceData(), { wrapper })

    expect(result.current.engineData.globalIncome).toBe(5000)
    expect(result.current.engineData.globalSavingsRate).toBe(20)
    expect(result.current.expenseSplits).toEqual([{ id: 1, date: '2026-05-01', amount: 10 }])
    expect(result.current.activeFixedExpenses).toEqual([{ id: 1, name: 'Rent', amount: 1200 }])
    expect(result.current.activeSchedules).toEqual([
      {
        id: 1,
        type: 'income',
        effectiveYear: 2026,
        effectiveMonth: 6,
        newValue: 5500,
        isActive: 1,
      },
    ])
  })

  it('writes current income through repository actions', async () => {
    mockLiveResults([[], [], [], [], [], [], [], [], [], []])
    vi.mocked(setSetting).mockResolvedValue(undefined)

    const { result } = renderHook(() => useFinanceActions(), { wrapper })

    await act(async () => {
      await result.current.saveCurrentIncome({
        income: 5000,
        frequency: 'monthly',
        monthlyIncome: 5000,
      })
    })

    await waitFor(() => {
      expect(setSetting).toHaveBeenCalledWith('incomeAmount', '5000')
    })
    expect(setSetting).toHaveBeenCalledWith('incomeFrequency', 'monthly')
    expect(setSetting).toHaveBeenCalledWith('monthlyIncome', 5000)
    expect(setSetting).toHaveBeenCalledWith(
      'monthlyIncomeUpdatedAt',
      expect.stringMatching(/^\d{4}-\d{2}$/),
    )
    expect(mockSyncLocalChanges).toHaveBeenCalledTimes(1)
  })

  it('saves historical snapshot configs through repository and refreshes live queries', async () => {
    mockLiveResults([[], [], [], [], [], [], [], [], [], []])
    vi.mocked(saveHistoricalSnapshotConfigs).mockResolvedValue(undefined)

    const { result } = renderHook(() => useFinanceActions(), { wrapper })
    const params = {
      dirtyYears: new Set([2025]),
      yearConfigs: {
        2025: {
          incomeRanges: [],
          savingsRanges: [],
          fixedItems: [],
        },
      },
    }

    await act(async () => {
      await result.current.saveHistoricalSnapshotConfigs(params)
    })

    expect(saveHistoricalSnapshotConfigs).toHaveBeenCalledWith(params)
    expect(mockUseLiveQuery.mock.calls[10]?.[1]).toEqual([1])
    expect(mockSyncLocalChanges).toHaveBeenCalledTimes(1)
  })
})
