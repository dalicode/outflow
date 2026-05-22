import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FinanceEngineData, FixedExpenseSnapshot, IncomeSnapshot, SavingsSnapshot } from '../types'
import EditHistoricalDataModal, {
  saveHistoricalDataConfigs,
} from '../features/settings/EditHistoricalDataModal'
import { getMonthlyFinancialSummary } from '../utils/financeEngine'

vi.mock('../context/settingsContext', () => ({
  useSettings: () => ({
    formatAmount: (value: number) => `$${value.toFixed(2)}`,
  }),
}))

const { storageMock } = vi.hoisted(() => ({
  storageMock: {
    getFixedExpenses: vi.fn(async () => []),
    getAllIncomeSnapshots: vi.fn(async () => []),
    getAllSavingsSnapshots: vi.fn(async () => []),
    getAllFixedExpenseSnapshots: vi.fn(async () => []),
    bulkUpsertIncomeSnapshots: vi.fn(async () => 0),
    bulkUpsertSavingsSnapshots: vi.fn(async () => 0),
    bulkUpsertSnapshots: vi.fn(async () => 0),
    deleteIncomeSnapshotsForYear: vi.fn(async () => 0),
    deleteSavingsSnapshotsForYear: vi.fn(async () => 0),
    deleteSnapshotsForYear: vi.fn(async () => 0),
    addArchivedFixedExpense: vi.fn(async () => 1),
  },
}))

vi.mock('../services/storageService', () => ({
  StorageService: storageMock,
}))

describe('saveHistoricalDataConfigs', () => {
  const makeStorage = () => {
    const incomeByKey = new Map<string, IncomeSnapshot>()
    const savingsByKey = new Map<string, SavingsSnapshot>()
    const fixedByKey = new Map<string, FixedExpenseSnapshot>()
    let fixedIdCounter = 100
    return {
      incomeByKey,
      savingsByKey,
      fixedByKey,
      storage: {
        bulkUpsertIncomeSnapshots: vi.fn(async (rows: IncomeSnapshot[]) => {
          for (const row of rows) incomeByKey.set(`${row.year}-${row.month}`, row)
          return rows.length
        }),
        bulkUpsertSavingsSnapshots: vi.fn(async (rows: SavingsSnapshot[]) => {
          for (const row of rows) savingsByKey.set(`${row.year}-${row.month}`, row)
          return rows.length
        }),
        bulkUpsertSnapshots: vi.fn(async (rows: FixedExpenseSnapshot[]) => {
          for (const row of rows) {
            fixedByKey.set(`${row.fixedExpenseId}-${row.year}-${row.month}`, row)
          }
          return rows.length
        }),
        deleteIncomeSnapshotsForYear: vi.fn(async (year: number) => {
          for (const key of [...incomeByKey.keys()]) {
            if (key.startsWith(`${year}-`)) incomeByKey.delete(key)
          }
          return 0
        }),
        deleteSavingsSnapshotsForYear: vi.fn(async (year: number) => {
          for (const key of [...savingsByKey.keys()]) {
            if (key.startsWith(`${year}-`)) savingsByKey.delete(key)
          }
          return 0
        }),
        deleteSnapshotsForYear: vi.fn(async (year: number) => {
          for (const key of [...fixedByKey.keys()]) {
            if (key.includes(`-${year}-`)) fixedByKey.delete(key)
          }
          return 0
        }),
        addArchivedFixedExpense: vi.fn(async () => {
          fixedIdCounter += 1
          return fixedIdCounter
        }),
      },
    }
  }

  it('prevents duplicate income snapshots and keeps engine income value updated', async () => {
    const env = makeStorage()
    const yearConfigs = {
      2025: {
        incomeRanges: [{ id: 'inc', amount: '5000', startMonth: 1, endMonth: 1 }],
        savingsRanges: [{ id: 'sav', amount: '20', startMonth: 1, endMonth: 1 }],
        fixedItems: [],
      },
    }

    await saveHistoricalDataConfigs({
      storage: env.storage,
      dirtyYears: new Set([2025]),
      yearConfigs,
      saveMode: 'merge',
    })
    yearConfigs[2025].incomeRanges[0].amount = '6000'
    await saveHistoricalDataConfigs({
      storage: env.storage,
      dirtyYears: new Set([2025]),
      yearConfigs,
      saveMode: 'merge',
    })

    expect(env.incomeByKey.size).toBe(1)
    const data: FinanceEngineData = {
      expenses: [],
      snapshots: [],
      fixedExpenses: [],
      incomeSnapshots: [...env.incomeByKey.values()],
      savingsSnapshots: [...env.savingsByKey.values()],
      globalIncome: 0,
      globalSavingsRate: 0,
      schedules: [],
    }
    const summary = getMonthlyFinancialSummary(2025, 0, data)
    expect(summary.income).toBe(6000)
  })

  it('prevents duplicate savings snapshots and keeps autoSavings updated', async () => {
    const env = makeStorage()
    const yearConfigs = {
      2025: {
        incomeRanges: [{ id: 'inc', amount: '4000', startMonth: 1, endMonth: 1 }],
        savingsRanges: [{ id: 'sav', amount: '10', startMonth: 1, endMonth: 1 }],
        fixedItems: [],
      },
    }

    await saveHistoricalDataConfigs({
      storage: env.storage,
      dirtyYears: new Set([2025]),
      yearConfigs,
      saveMode: 'merge',
    })
    yearConfigs[2025].savingsRanges[0].amount = '25'
    await saveHistoricalDataConfigs({
      storage: env.storage,
      dirtyYears: new Set([2025]),
      yearConfigs,
      saveMode: 'merge',
    })

    expect(env.savingsByKey.size).toBe(1)
    const data: FinanceEngineData = {
      expenses: [],
      snapshots: [],
      fixedExpenses: [],
      incomeSnapshots: [...env.incomeByKey.values()],
      savingsSnapshots: [...env.savingsByKey.values()],
      globalIncome: 0,
      globalSavingsRate: 0,
      schedules: [],
    }
    const summary = getMonthlyFinancialSummary(2025, 0, data)
    expect(summary.autoSavings).toBe(1000)
  })

  it('recalculates autoSavings when income changes with same savings rate', async () => {
    const env = makeStorage()
    const yearConfigs = {
      2025: {
        incomeRanges: [{ id: 'inc', amount: '5000', startMonth: 1, endMonth: 1 }],
        savingsRanges: [{ id: 'sav', amount: '20', startMonth: 1, endMonth: 1 }],
        fixedItems: [],
      },
    }
    await saveHistoricalDataConfigs({
      storage: env.storage,
      dirtyYears: new Set([2025]),
      yearConfigs,
      saveMode: 'merge',
    })
    yearConfigs[2025].incomeRanges[0].amount = '7000'
    await saveHistoricalDataConfigs({
      storage: env.storage,
      dirtyYears: new Set([2025]),
      yearConfigs,
      saveMode: 'merge',
    })

    const data: FinanceEngineData = {
      expenses: [],
      snapshots: [],
      fixedExpenses: [],
      incomeSnapshots: [...env.incomeByKey.values()],
      savingsSnapshots: [...env.savingsByKey.values()],
      globalIncome: 0,
      globalSavingsRate: 0,
      schedules: [],
    }
    const summary = getMonthlyFinancialSummary(2025, 0, data)
    expect(summary.autoSavings).toBe(1400)
  })

  it('does not create or update fixed snapshots in merge mode when fixed data is invalid', async () => {
    const env = makeStorage()
    await saveHistoricalDataConfigs({
      storage: env.storage,
      dirtyYears: new Set([2025]),
      yearConfigs: {
        2025: {
          incomeRanges: [],
          savingsRanges: [],
          fixedItems: [{ id: 'fx', name: ' ', amount: '0', startMonth: 1, endMonth: 1 }],
        },
      },
      saveMode: 'merge',
    })
    expect(env.storage.addArchivedFixedExpense).not.toHaveBeenCalled()
    expect(env.storage.bulkUpsertSnapshots).not.toHaveBeenCalled()
  })

  it('updates fixed snapshots with existingFixedExpenseId in merge mode', async () => {
    const env = makeStorage()
    await saveHistoricalDataConfigs({
      storage: env.storage,
      dirtyYears: new Set([2025]),
      yearConfigs: {
        2025: {
          incomeRanges: [],
          savingsRanges: [],
          fixedItems: [
            { id: 'fx', name: 'Rent', amount: '1200', startMonth: 1, endMonth: 2, existingFixedExpenseId: 7 },
          ],
        },
      },
      saveMode: 'merge',
    })
    expect(env.storage.addArchivedFixedExpense).not.toHaveBeenCalled()
    expect([...env.fixedByKey.values()].every((row) => row.fixedExpenseId === 7)).toBe(true)
  })

  it('creates archived fixed definition for new merge fixed items', async () => {
    const env = makeStorage()
    await saveHistoricalDataConfigs({
      storage: env.storage,
      dirtyYears: new Set([2025]),
      yearConfigs: {
        2025: {
          incomeRanges: [],
          savingsRanges: [],
          fixedItems: [{ id: 'fx', name: 'Insurance', amount: '200', startMonth: 1, endMonth: 1 }],
        },
      },
      saveMode: 'merge',
    })
    expect(env.storage.addArchivedFixedExpense).toHaveBeenCalledTimes(1)
    expect([...env.fixedByKey.values()][0]?.fixedExpenseId).toBe(101)
  })

  it('clears fixed snapshots in replace mode even with no valid fixed rows', async () => {
    const env = makeStorage()
    await saveHistoricalDataConfigs({
      storage: env.storage,
      dirtyYears: new Set([2025]),
      yearConfigs: {
        2025: {
          incomeRanges: [],
          savingsRanges: [],
          fixedItems: [{ id: 'fx', name: '', amount: '', startMonth: 1, endMonth: 1 }],
        },
      },
      saveMode: 'replace',
    })
    expect(env.storage.deleteSnapshotsForYear).toHaveBeenCalledWith(2025)
    expect(env.storage.bulkUpsertSnapshots).not.toHaveBeenCalled()
  })
})

describe('EditHistoricalDataModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('awaits async onComplete before calling onClose', async () => {
    localStorage.setItem(
      'outflow:editHistoricalDraft:2025',
      JSON.stringify({
        yearConfigs: {
          2025: {
            incomeRanges: [{ id: 'i1', amount: '5000', startMonth: 1, endMonth: 1 }],
            savingsRanges: [],
            fixedItems: [],
          },
        },
        dirtyYears: [2025],
        saveMode: 'merge',
      }),
    )

    let resolveComplete: (() => void) | null = null
    const onComplete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveComplete = resolve
        }),
    )
    const onClose = vi.fn()

    render(
      <EditHistoricalDataModal
        isOpen
        onClose={onClose}
        years={[2025]}
        expenses={[]}
        onComplete={onComplete}
      />,
    )

    const saveButton = await screen.findByRole('button', { name: 'Confirm Save' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1)
    })
    expect(onClose).not.toHaveBeenCalled()

    resolveComplete?.()
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})
