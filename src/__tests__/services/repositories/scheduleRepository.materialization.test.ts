import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Schedule, SyncedSettingRow } from '@/types'

type GenericRow = Record<string, unknown> & { id?: number }

const {
  state,
  resetState,
  setFailFixedPut,
  schedulesTable,
  fixedExpensesTable,
  categoriesTable,
  payeesTable,
  settingsTable,
  expensesTable,
  transactionSpy,
} = vi.hoisted(() => {
  const state = {
    schedules: [] as Schedule[],
    fixedExpenses: [] as GenericRow[],
    categories: [] as GenericRow[],
    payees: [] as GenericRow[],
    expenses: [] as GenericRow[],
    settings: new Map<string, SyncedSettingRow>(),
  }
  let failFixedPut = false
  let nextExpenseId = 1

  const cloneState = () => ({
    schedules: state.schedules.map((row) => ({ ...row })),
    fixedExpenses: state.fixedExpenses.map((row) => ({ ...row })),
    categories: state.categories.map((row) => ({ ...row })),
    payees: state.payees.map((row) => ({ ...row })),
    expenses: state.expenses.map((row) => ({ ...row })),
    settings: new Map(
      Array.from(state.settings.entries()).map(([key, row]) => [key, { ...row } as SyncedSettingRow]),
    ),
    nextExpenseId,
  })

  const restoreState = (snapshot: ReturnType<typeof cloneState>) => {
    state.schedules = snapshot.schedules
    state.fixedExpenses = snapshot.fixedExpenses
    state.categories = snapshot.categories
    state.payees = snapshot.payees
    state.expenses = snapshot.expenses
    state.settings = snapshot.settings
    nextExpenseId = snapshot.nextExpenseId
  }

  return {
    state,
    resetState: () => {
      state.schedules = []
      state.fixedExpenses = []
      state.categories = []
      state.payees = []
      state.expenses = []
      state.settings.clear()
      nextExpenseId = 1
      failFixedPut = false
    },
    setFailFixedPut: (value: boolean) => {
      failFixedPut = value
    },
    schedulesTable: {
      toArray: vi.fn(async () => state.schedules),
      get: vi.fn(async (id: number) => state.schedules.find((row) => row.id === id)),
      put: vi.fn(async (row: Schedule) => {
        if (row.id == null) return 0
        const index = state.schedules.findIndex((entry) => entry.id === row.id)
        if (index >= 0) {
          state.schedules[index] = row
        } else {
          state.schedules.push(row)
        }
        return row.id
      }),
    },
    fixedExpensesTable: {
      toArray: vi.fn(async () => state.fixedExpenses),
      put: vi.fn(async (row: GenericRow) => {
        if (failFixedPut) throw new Error('fixed expense update failed')
        if (typeof row.id !== 'number') return 0
        const index = state.fixedExpenses.findIndex((entry) => entry.id === row.id)
        if (index >= 0) {
          state.fixedExpenses[index] = row
        } else {
          state.fixedExpenses.push(row)
        }
        return row.id
      }),
    },
    categoriesTable: {
      toArray: vi.fn(async () => state.categories),
    },
    payeesTable: {
      toArray: vi.fn(async () => state.payees),
    },
    settingsTable: {
      get: vi.fn(async (key: string) => state.settings.get(key)),
      put: vi.fn(async (row: SyncedSettingRow) => {
        state.settings.set(row.key, row)
        return row.key
      }),
    },
    expensesTable: {
      add: vi.fn(async (row: GenericRow) => {
        const id = nextExpenseId++
        state.expenses.push({ ...row, id })
        return id
      }),
    },
    transactionSpy: vi.fn(async (_mode: string, _tables: unknown[], callback: () => Promise<unknown>) => {
      const snapshot = cloneState()
      try {
        return await callback()
      } catch (error) {
        restoreState(snapshot)
        throw error
      }
    }),
  }
})

vi.mock('@/services/db/schema', () => ({
  default: {
    transaction: transactionSpy,
    schedules: schedulesTable,
    fixedExpenses: fixedExpensesTable,
    categories: categoriesTable,
    payees: payeesTable,
    settings: settingsTable,
    expenses: expensesTable,
  },
}))

import {
  hasActiveUnmaterializedDueSchedule,
  materializePendingSnapshots,
} from '@/services/repositories/scheduleRepository'

describe('materializePendingSnapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'))
    resetState()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes category/payee name snapshots for first materialized expense schedules', async () => {
    state.schedules.push({
      id: 1,
      type: 'expense',
      targetId: null,
      effectiveYear: 2026,
      effectiveMonth: 5,
      newValue: 42.5,
      isActive: 1,
      day: 14,
      categoryId: 7,
      payeeId: 8,
      notes: 'Planned lunch',
      localId: 'sched-1',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'synced',
      lastSyncedAt: '2026-05-01T00:00:00.000Z',
      syncError: null,
      deviceId: 'device-1',
    })
    state.categories.push({ id: 7, name: 'Dining', deletedAt: null })
    state.payees.push({ id: 8, name: 'Cafe', deletedAt: null })

    const notices = await materializePendingSnapshots()

    expect(notices).toHaveLength(1)
    expect(state.expenses).toHaveLength(1)
    expect(state.expenses[0]).toEqual(
      expect.objectContaining({
        categoryId: 7,
        payeeId: 8,
        categoryNameSnapshot: 'Dining',
        payeeNameSnapshot: 'Cafe',
      }),
    )
    expect(state.schedules[0].isActive).toBe(0)
    expect(state.schedules[0].materializedAt).toBe('2026-05')
  })

  it('does not materialize future-day expense schedules in the current month', async () => {
    state.schedules.push({
      id: 2,
      type: 'expense',
      targetId: null,
      effectiveYear: 2026,
      effectiveMonth: 5,
      newValue: 75,
      isActive: 1,
      day: 20,
      categoryId: 7,
      notes: 'Future planned expense',
      localId: 'sched-2',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'synced',
      lastSyncedAt: '2026-05-01T00:00:00.000Z',
      syncError: null,
      deviceId: 'device-1',
    })

    const notices = await materializePendingSnapshots()

    expect(notices).toEqual([])
    expect(state.expenses).toHaveLength(0)
    expect(state.schedules[0].isActive).toBe(1)
    expect(state.schedules[0].materializedAt).toBeUndefined()
  })

  it('detects only active unmaterialized schedules due on the current day', async () => {
    state.schedules.push(
      {
        id: 3,
        type: 'expense',
        targetId: null,
        effectiveYear: 2026,
        effectiveMonth: 5,
        newValue: 75,
        isActive: 1,
        day: 20,
        localId: 'future-expense',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedAt: '2026-05-01T00:00:00.000Z',
        syncError: null,
        deviceId: 'device-1',
      },
      {
        id: 4,
        type: 'income',
        targetId: null,
        effectiveYear: 2026,
        effectiveMonth: 5,
        newValue: 6500,
        materializedAt: '2026-05',
        isActive: 1,
        localId: 'materialized-income',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedAt: '2026-05-01T00:00:00.000Z',
        syncError: null,
        deviceId: 'device-1',
      },
    )

    expect(await hasActiveUnmaterializedDueSchedule()).toBe(false)

    state.schedules.push({
      id: 5,
      type: 'income',
      targetId: null,
      effectiveYear: 2026,
      effectiveMonth: 5,
      newValue: 7000,
      isActive: 1,
      localId: 'due-income',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'synced',
      lastSyncedAt: '2026-05-01T00:00:00.000Z',
      syncError: null,
      deviceId: 'device-1',
    })

    expect(await hasActiveUnmaterializedDueSchedule()).toBe(true)
  })

  it('rolls back partial schedule/settings/fixed updates when the transaction fails', async () => {
    state.settings.set('monthlyIncome', { key: 'monthlyIncome', value: 5000, deletedAt: null })
    state.schedules.push(
      {
        id: 11,
        type: 'income',
        targetId: null,
        effectiveYear: 2026,
        effectiveMonth: 5,
        newValue: 6200,
        isActive: 1,
        localId: 'income-11',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedAt: '2026-05-01T00:00:00.000Z',
        syncError: null,
        deviceId: 'device-1',
      },
      {
        id: 12,
        type: 'fixedExpense',
        targetId: 3,
        effectiveYear: 2026,
        effectiveMonth: 5,
        newValue: 1500,
        isActive: 1,
        localId: 'fixed-12',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        deletedAt: null,
        syncStatus: 'synced',
        lastSyncedAt: '2026-05-01T00:00:00.000Z',
        syncError: null,
        deviceId: 'device-1',
      },
    )
    state.fixedExpenses.push({
      id: 3,
      name: 'Rent',
      amount: 1300,
      deletedAt: null,
      localId: 'fixed-def-3',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      syncStatus: 'synced',
      lastSyncedAt: '2026-05-01T00:00:00.000Z',
      syncError: null,
      deviceId: 'device-1',
    })
    setFailFixedPut(true)

    await expect(materializePendingSnapshots()).rejects.toThrow('fixed expense update failed')

    expect(state.settings.get('monthlyIncome')?.value).toBe(5000)
    expect(state.settings.get('monthlyIncomeUpdatedAt')).toBeUndefined()
    expect(state.settings.get('scheduleMaterializationLog')).toBeUndefined()
    expect(state.schedules.find((row) => row.id === 11)?.previousValue).toBeUndefined()
    expect(state.schedules.find((row) => row.id === 11)?.materializedAt).toBeUndefined()
    expect(state.schedules.find((row) => row.id === 12)?.previousValue).toBeUndefined()
    expect(state.schedules.find((row) => row.id === 12)?.materializedAt).toBeUndefined()
    expect(state.fixedExpenses.find((row) => row.id === 3)?.amount).toBe(1300)
  })

  it('re-applies due income values on retry without overwriting previousValue/materializedAt or re-emitting notices', async () => {
    state.settings.set('monthlyIncome', { key: 'monthlyIncome', value: 5000, deletedAt: null })
    state.settings.set('scheduleMaterializationLog', {
      key: 'scheduleMaterializationLog',
      value: [{ id: 'existing-notice' }],
      deletedAt: null,
    })
    state.schedules.push({
      id: 20,
      type: 'income',
      targetId: null,
      effectiveYear: 2026,
      effectiveMonth: 4,
      newValue: 6400,
      previousValue: 4700,
      materializedAt: '2026-04',
      isActive: 1,
      localId: 'income-20',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'synced',
      lastSyncedAt: '2026-04-01T00:00:00.000Z',
      syncError: null,
      deviceId: 'device-1',
    })

    const notices = await materializePendingSnapshots()

    expect(notices).toEqual([])
    expect(state.settings.get('monthlyIncome')?.value).toBe(6400)
    expect(state.settings.get('monthlyIncomeUpdatedAt')?.value).toBe('2026-04')
    expect(state.schedules[0].previousValue).toBe(4700)
    expect(state.schedules[0].materializedAt).toBe('2026-04')
    expect(state.settings.get('scheduleMaterializationLog')?.value).toEqual([{ id: 'existing-notice' }])
  })

  it('does not duplicate planned expenses on retry when materializedAt is already present and archives the schedule', async () => {
    state.expenses.push({
      id: 99,
      date: '2026-05-14',
      amount: 42.5,
      categoryId: 7,
      payeeId: 8,
      notes: 'Planned lunch',
      deletedAt: null,
    })
    state.schedules.push({
      id: 30,
      type: 'expense',
      targetId: null,
      effectiveYear: 2026,
      effectiveMonth: 5,
      newValue: 42.5,
      day: 14,
      categoryId: 7,
      payeeId: 8,
      notes: 'Planned lunch',
      materializedAt: '2026-05',
      isActive: 1,
      localId: 'expense-30',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'synced',
      lastSyncedAt: '2026-05-01T00:00:00.000Z',
      syncError: null,
      deviceId: 'device-1',
    })

    const notices = await materializePendingSnapshots()

    expect(notices).toEqual([])
    expect(state.expenses).toHaveLength(1)
    expect(state.schedules[0].isActive).toBe(0)
    expect(state.schedules[0].materializedAt).toBe('2026-05')
  })
})
