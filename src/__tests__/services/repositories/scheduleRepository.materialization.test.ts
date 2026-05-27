import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Schedule } from '@/types'

const {
  state,
  resetState,
  schedulesTable,
  fixedExpensesTable,
  categoriesTable,
  payeesTable,
  settingsTable,
  expensesTable,
} = vi.hoisted(() => {
  const state = {
    schedules: [] as Schedule[],
    fixedExpenses: [] as Array<Record<string, unknown>>,
    categories: [] as Array<Record<string, unknown>>,
    payees: [] as Array<Record<string, unknown>>,
    expenses: [] as Array<Record<string, unknown>>,
    settings: new Map<string, Record<string, unknown>>(),
  }
  let nextExpenseId = 1

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
      put: vi.fn(async () => 1),
    },
    categoriesTable: {
      toArray: vi.fn(async () => state.categories),
    },
    payeesTable: {
      toArray: vi.fn(async () => state.payees),
    },
    settingsTable: {
      get: vi.fn(async (key: string) => state.settings.get(key)),
      put: vi.fn(async (row: Record<string, unknown>) => {
        state.settings.set(row.key as string, row)
        return row.key as string
      }),
    },
    expensesTable: {
      add: vi.fn(async (row: Record<string, unknown>) => {
        const id = nextExpenseId++
        state.expenses.push({ ...row, id })
        return id
      }),
    },
  }
})

vi.mock('@/services/db/schema', () => ({
  default: {
    schedules: schedulesTable,
    fixedExpenses: fixedExpensesTable,
    categories: categoriesTable,
    payees: payeesTable,
    settings: settingsTable,
    expenses: expensesTable,
  },
}))

import { materializePendingSnapshots } from '@/services/repositories/scheduleRepository'

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

  it('writes category/payee name snapshots for materialized expense schedules', async () => {
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
  })
})
