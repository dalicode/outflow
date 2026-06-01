import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FixedExpenseSnapshot, IncomeSnapshot, SavingsSnapshot, Schedule } from '@/types'

type Row = {
  id?: number
  [key: string]: unknown
}

function makeTable<T extends { id?: number }>(initial: T[] = []) {
  const seed = initial.map((row) => ({ ...row }))
  let rows = seed.map((row) => ({ ...row }))
  let nextId = rows.reduce((max, row) => Math.max(max, typeof row.id === 'number' ? row.id : 0), 0) + 1

  const reset = (): void => {
    rows = seed.map((row) => ({ ...row }))
    nextId = rows.reduce((max, row) => Math.max(max, typeof row.id === 'number' ? row.id : 0), 0) + 1
  }

  const matches = (row: T, field: string, value: unknown): boolean => {
    const record = row as Row
    if (field.startsWith('[')) {
      const fields = field.slice(1, -1).split('+')
      if (!Array.isArray(value) || value.length !== fields.length) return false
      return fields.every((name, index) => record[name] === value[index])
    }
    return record[field] === value
  }

  return {
    data: (): T[] => rows,
    reset,
    toArray: vi.fn(async () => rows.map((row) => ({ ...row }))),
    get: vi.fn(async (id: number) => rows.find((row) => row.id === id)),
    where: vi.fn((field: string) => ({
      equals: vi.fn((value: unknown) => ({
        toArray: vi.fn(async () => rows.filter((row) => matches(row, field, value)).map((row) => ({ ...row }))),
      })),
    })),
    add: vi.fn(async (row: T) => {
      const id = nextId++
      rows.push({ ...row, id })
      return id
    }),
    put: vi.fn(async (row: T) => {
      if (typeof row.id === 'number') {
        const index = rows.findIndex((entry) => entry.id === row.id)
        if (index >= 0) {
          rows[index] = { ...rows[index], ...row }
          return row.id
        }
      }
      const id = nextId++
      rows.push({ ...row, id })
      return id
    }),
  }
}

const {
  transactionMock,
  settingsStore,
  settingsTable,
  fixedExpensesTable,
  incomeSnapshotsTable,
  savingsSnapshotsTable,
  fixedExpenseSnapshotsTable,
  schedulesTable,
  resetState,
} = vi.hoisted(() => {
  const settingsStore = new Map<string, Record<string, unknown>>()
  const fixedExpensesTable = makeTable([
    {
      id: 11,
      name: 'Rent',
      amount: 1250,
      isArchived: false,
      deletedAt: null,
      localId: 'fixed-11',
      syncStatus: 'synced',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
  ])
  const incomeSnapshotsTable = makeTable<IncomeSnapshot>([
    {
      id: 1,
      year: 2026,
      month: 4,
      amountSnapshot: 4200,
      deletedAt: null,
      localId: 'income-a',
      syncStatus: 'synced',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 2,
      year: 2026,
      month: 4,
      amountSnapshot: 4300,
      deletedAt: null,
      localId: 'income-b',
      syncStatus: 'synced',
      updatedAt: '2026-04-02T00:00:00.000Z',
    },
  ])
  const savingsSnapshotsTable = makeTable<SavingsSnapshot>([
    {
      id: 3,
      year: 2026,
      month: 4,
      rateSnapshot: 0.18,
      deletedAt: null,
      localId: 'savings-a',
      syncStatus: 'synced',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 4,
      year: 2026,
      month: 4,
      rateSnapshot: 0.19,
      deletedAt: null,
      localId: 'savings-b',
      syncStatus: 'synced',
      updatedAt: '2026-04-03T00:00:00.000Z',
    },
  ])
  const fixedExpenseSnapshotsTable = makeTable<FixedExpenseSnapshot>([
    {
      id: 5,
      fixedExpenseId: 11,
      year: 2026,
      month: 4,
      nameSnapshot: 'Rent',
      amountSnapshot: 1200,
      deletedAt: null,
      localId: 'fixed-snap-a',
      syncStatus: 'synced',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 6,
      fixedExpenseId: 11,
      year: 2026,
      month: 4,
      nameSnapshot: 'Rent',
      amountSnapshot: 1225,
      deletedAt: null,
      localId: 'fixed-snap-b',
      syncStatus: 'synced',
      updatedAt: '2026-04-04T00:00:00.000Z',
    },
  ])
  const schedulesTable = makeTable<Schedule>([])

  return {
    transactionMock: vi.fn(async (_mode: string, _tables: unknown[], callback: () => Promise<void>) =>
      callback(),
    ),
    settingsStore,
    settingsTable: {
      get: vi.fn(async (key: string) => settingsStore.get(key)),
      put: vi.fn(async (row: Record<string, unknown>) => {
        settingsStore.set(row.key as string, row)
        return row.key as string
      }),
    },
    fixedExpensesTable,
    incomeSnapshotsTable,
    savingsSnapshotsTable,
    fixedExpenseSnapshotsTable,
    schedulesTable,
    resetState: () => {
      settingsStore.clear()
      fixedExpensesTable.reset()
      incomeSnapshotsTable.reset()
      savingsSnapshotsTable.reset()
      fixedExpenseSnapshotsTable.reset()
      schedulesTable.reset()
    },
  }
})

vi.mock('@/services/db/schema', () => ({
  default: {
    transaction: transactionMock,
    fixedExpenses: fixedExpensesTable,
    incomeSnapshots: incomeSnapshotsTable,
    savingsSnapshots: savingsSnapshotsTable,
    fixedExpenseSnapshots: fixedExpenseSnapshotsTable,
    schedules: schedulesTable,
    settings: settingsTable,
  },
}))

import { rolloverSnapshots } from '@/services/repositories/scheduleRepository'

describe('rolloverSnapshots dedupe repair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'))
    resetState()
    settingsStore.set('lastAppOpenMonthKey', { key: 'lastAppOpenMonthKey', value: '2026-04' })
    settingsStore.set('monthlyIncome', { key: 'monthlyIncome', value: 5000 })
    settingsStore.set('savingsRate', { key: 'savingsRate', value: 0.2 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('preserves existing active snapshot values while collapsing duplicate month rows', async () => {
    await rolloverSnapshots()

    const incomeRows = incomeSnapshotsTable.data().filter((row) => row.year === 2026 && row.month === 4)
    const savingsRows = savingsSnapshotsTable.data().filter((row) => row.year === 2026 && row.month === 4)
    const fixedRows = fixedExpenseSnapshotsTable
      .data()
      .filter((row) => row.fixedExpenseId === 11 && row.year === 2026 && row.month === 4)

    expect(incomeRows.filter((row) => row.deletedAt == null)).toHaveLength(1)
    expect(incomeRows.filter((row) => row.deletedAt != null)).toHaveLength(1)
    expect(incomeRows.find((row) => row.deletedAt == null)?.amountSnapshot).toBe(4300)

    expect(savingsRows.filter((row) => row.deletedAt == null)).toHaveLength(1)
    expect(savingsRows.filter((row) => row.deletedAt != null)).toHaveLength(1)
    expect(savingsRows.find((row) => row.deletedAt == null)?.rateSnapshot).toBe(0.19)

    expect(fixedRows.filter((row) => row.deletedAt == null)).toHaveLength(1)
    expect(fixedRows.filter((row) => row.deletedAt != null)).toHaveLength(1)
    expect(fixedRows.find((row) => row.deletedAt == null)?.amountSnapshot).toBe(1225)

    const countsAfterFirstRun = {
      income: incomeRows.length,
      savings: savingsRows.length,
      fixed: fixedRows.length,
    }

    settingsStore.set('lastAppOpenMonthKey', { key: 'lastAppOpenMonthKey', value: '2026-04' })
    await rolloverSnapshots()

    expect(
      incomeSnapshotsTable.data().filter((row) => row.year === 2026 && row.month === 4),
    ).toHaveLength(countsAfterFirstRun.income)
    expect(
      savingsSnapshotsTable.data().filter((row) => row.year === 2026 && row.month === 4),
    ).toHaveLength(countsAfterFirstRun.savings)
    expect(
      fixedExpenseSnapshotsTable
        .data()
        .filter((row) => row.fixedExpenseId === 11 && row.year === 2026 && row.month === 4),
    ).toHaveLength(countsAfterFirstRun.fixed)
  })

  it('creates missing gap snapshots from resolved schedule/global values without overwriting existing month values', async () => {
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
    settingsStore.set('lastAppOpenMonthKey', { key: 'lastAppOpenMonthKey', value: '2026-04' })
    schedulesTable.data().push(
      {
        id: 701,
        type: 'income',
        targetId: null,
        effectiveYear: 2026,
        effectiveMonth: 5,
        newValue: 6000,
        previousValue: 5000,
        isActive: 1,
        localId: 'sched-income-701',
        syncStatus: 'synced',
        deletedAt: null,
      },
      {
        id: 702,
        type: 'fixedExpense',
        targetId: 11,
        effectiveYear: 2026,
        effectiveMonth: 5,
        newValue: 1400,
        previousValue: 1225,
        isActive: 1,
        localId: 'sched-fixed-702',
        syncStatus: 'synced',
        deletedAt: null,
      },
    )

    await rolloverSnapshots()

    const aprilIncome = incomeSnapshotsTable
      .data()
      .find((row) => row.year === 2026 && row.month === 4 && row.deletedAt == null)
    const mayIncome = incomeSnapshotsTable
      .data()
      .find((row) => row.year === 2026 && row.month === 5 && row.deletedAt == null)
    const maySavings = savingsSnapshotsTable
      .data()
      .find((row) => row.year === 2026 && row.month === 5 && row.deletedAt == null)
    const mayFixed = fixedExpenseSnapshotsTable
      .data()
      .find(
        (row) => row.fixedExpenseId === 11 && row.year === 2026 && row.month === 5 && row.deletedAt == null,
      )

    expect(aprilIncome?.amountSnapshot).toBe(4300)
    expect(mayIncome?.amountSnapshot).toBe(6000)
    expect(maySavings?.rateSnapshot).toBe(0.2)
    expect(mayFixed?.amountSnapshot).toBe(1400)
  })

  it('reuses the previous historical fixed expense id when rollover continues the same bill', async () => {
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
    settingsStore.set('lastAppOpenMonthKey', { key: 'lastAppOpenMonthKey', value: '2026-05' })
    fixedExpensesTable.data().splice(0, fixedExpensesTable.data().length, {
      id: 11,
      name: 'Mortgage',
      amount: 1200,
      isArchived: false,
      deletedAt: null,
      localId: 'live-mortgage',
      syncStatus: 'synced',
      updatedAt: '2026-04-01T00:00:00.000Z',
    })
    fixedExpenseSnapshotsTable.data().splice(0, fixedExpenseSnapshotsTable.data().length, {
      id: 30,
      fixedExpenseId: 100,
      year: 2026,
      month: 4,
      nameSnapshot: 'Mortgage',
      amountSnapshot: 1200,
      deletedAt: null,
      localId: 'historical-mortgage',
      syncStatus: 'synced',
      updatedAt: '2026-04-01T00:00:00.000Z',
    })

    await rolloverSnapshots()

    const mayMortgage = fixedExpenseSnapshotsTable
      .data()
      .find((row) => row.year === 2026 && row.month === 5 && row.nameSnapshot === 'Mortgage')
    expect(mayMortgage?.fixedExpenseId).toBe(100)
  })

  it('keeps the live fixed expense id when the previous month amount differs', async () => {
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
    settingsStore.set('lastAppOpenMonthKey', { key: 'lastAppOpenMonthKey', value: '2026-05' })
    fixedExpensesTable.data().splice(0, fixedExpensesTable.data().length, {
      id: 11,
      name: 'Mortgage',
      amount: 1200,
      isArchived: false,
      deletedAt: null,
      localId: 'live-mortgage',
      syncStatus: 'synced',
      updatedAt: '2026-04-01T00:00:00.000Z',
    })
    fixedExpenseSnapshotsTable.data().splice(0, fixedExpenseSnapshotsTable.data().length, {
      id: 30,
      fixedExpenseId: 100,
      year: 2026,
      month: 4,
      nameSnapshot: 'Mortgage',
      amountSnapshot: 1250,
      deletedAt: null,
      localId: 'historical-mortgage',
      syncStatus: 'synced',
      updatedAt: '2026-04-01T00:00:00.000Z',
    })

    await rolloverSnapshots()

    const mayMortgage = fixedExpenseSnapshotsTable
      .data()
      .find((row) => row.year === 2026 && row.month === 5 && row.nameSnapshot === 'Mortgage')
    expect(mayMortgage?.fixedExpenseId).toBe(11)
  })
})
