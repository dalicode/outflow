import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Schedule, SyncedSettingRow } from '@/types'

type SnapshotRow = Record<string, unknown> & { id?: number }

function createSnapshotTable(initial: SnapshotRow[] = []) {
  const seed = initial.map((row) => ({ ...row }))
  let rows = seed.map((row) => ({ ...row }))
  let nextId =
    rows.reduce((max, row) => Math.max(max, typeof row.id === 'number' ? row.id : 0), 0) + 1

  const reset = () => {
    rows = seed.map((row) => ({ ...row }))
    nextId = rows.reduce((max, row) => Math.max(max, typeof row.id === 'number' ? row.id : 0), 0) + 1
  }

  const clone = () => ({ rows: rows.map((row) => ({ ...row })), nextId })
  const restore = (snapshot: ReturnType<typeof clone>) => {
    rows = snapshot.rows.map((row) => ({ ...row }))
    nextId = snapshot.nextId
  }

  const matches = (row: SnapshotRow, field: string, value: unknown): boolean => {
    if (field.startsWith('[')) {
      const names = field.slice(1, -1).split('+')
      if (!Array.isArray(value) || value.length !== names.length) return false
      return names.every((name, index) => row[name] === value[index])
    }
    return row[field] === value
  }

  return {
    data: () => rows,
    reset,
    clone,
    restore,
    toArray: vi.fn(async () => rows.map((row) => ({ ...row }))),
    where: vi.fn((field: string) => ({
      equals: vi.fn((value: unknown) => ({
        toArray: vi.fn(async () => rows.filter((row) => matches(row, field, value)).map((row) => ({ ...row }))),
      })),
    })),
    add: vi.fn(async (row: SnapshotRow) => {
      const id = nextId++
      rows.push({ ...row, id })
      return id
    }),
    put: vi.fn(async (row: SnapshotRow) => {
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
  transactionSpy,
  state,
  resetState,
  setSettingsPutFailureKey,
  fixedExpensesTable,
  incomeSnapshotsTable,
  savingsSnapshotsTable,
  fixedExpenseSnapshotsTable,
  schedulesTable,
  settingsTable,
} = vi.hoisted(() => {
  const state = {
    schedules: [
      {
        id: 101,
        type: 'income',
        targetId: null,
        effectiveYear: 2026,
        effectiveMonth: 4,
        newValue: 7000,
        previousValue: 6500,
        isActive: 1,
        localId: 'schedule-101',
        syncStatus: 'synced',
        deletedAt: null,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        lastSyncedAt: '2026-04-01T00:00:00.000Z',
        syncError: null,
        deviceId: 'device-1',
      } satisfies Schedule,
    ] as Schedule[],
    settings: new Map<string, SyncedSettingRow>([
      ['lastAppOpenMonthKey', { key: 'lastAppOpenMonthKey', value: '2026-04', deletedAt: null }],
      ['monthlyIncome', { key: 'monthlyIncome', value: 6500, deletedAt: null }],
      ['savingsRate', { key: 'savingsRate', value: 20, deletedAt: null }],
    ]),
  }
  const fixedExpensesTable = createSnapshotTable([])
  const incomeSnapshotsTable = createSnapshotTable([])
  const savingsSnapshotsTable = createSnapshotTable([])
  const fixedExpenseSnapshotsTable = createSnapshotTable([])
  let settingsPutFailureKey: string | null = null

  const cloneState = () => ({
    schedules: state.schedules.map((row) => ({ ...row })),
    settings: new Map(
      Array.from(state.settings.entries()).map(([key, row]) => [key, { ...row } as SyncedSettingRow]),
    ),
    fixedExpenses: fixedExpensesTable.clone(),
    incomeSnapshots: incomeSnapshotsTable.clone(),
    savingsSnapshots: savingsSnapshotsTable.clone(),
    fixedExpenseSnapshots: fixedExpenseSnapshotsTable.clone(),
  })

  const restoreState = (snapshot: ReturnType<typeof cloneState>) => {
    state.schedules = snapshot.schedules
    state.settings = snapshot.settings
    fixedExpensesTable.restore(snapshot.fixedExpenses)
    incomeSnapshotsTable.restore(snapshot.incomeSnapshots)
    savingsSnapshotsTable.restore(snapshot.savingsSnapshots)
    fixedExpenseSnapshotsTable.restore(snapshot.fixedExpenseSnapshots)
  }

  const schedulesTable = {
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
  }

  const settingsTable = {
    get: vi.fn(async (key: string) => state.settings.get(key)),
    put: vi.fn(async (row: SyncedSettingRow) => {
      if (settingsPutFailureKey != null && row.key === settingsPutFailureKey) {
        throw new Error(`settings put failed: ${row.key}`)
      }
      state.settings.set(row.key, row)
      return row.key
    }),
  }

  return {
    transactionSpy: vi.fn(async (_mode: string, _tables: unknown[], callback: () => Promise<unknown>) => {
      const snapshot = cloneState()
      try {
        return await callback()
      } catch (error) {
        restoreState(snapshot)
        throw error
      }
    }),
    state,
    resetState: () => {
      state.schedules = [
        {
          id: 101,
          type: 'income',
          targetId: null,
          effectiveYear: 2026,
          effectiveMonth: 4,
          newValue: 7000,
          previousValue: 6500,
          isActive: 1,
          localId: 'schedule-101',
          syncStatus: 'synced',
          deletedAt: null,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
          lastSyncedAt: '2026-04-01T00:00:00.000Z',
          syncError: null,
          deviceId: 'device-1',
        },
      ]
      state.settings = new Map<string, SyncedSettingRow>([
        ['lastAppOpenMonthKey', { key: 'lastAppOpenMonthKey', value: '2026-04', deletedAt: null }],
        ['monthlyIncome', { key: 'monthlyIncome', value: 6500, deletedAt: null }],
        ['savingsRate', { key: 'savingsRate', value: 20, deletedAt: null }],
      ])
      settingsPutFailureKey = null
      fixedExpensesTable.reset()
      incomeSnapshotsTable.reset()
      savingsSnapshotsTable.reset()
      fixedExpenseSnapshotsTable.reset()
    },
    setSettingsPutFailureKey: (key: string | null) => {
      settingsPutFailureKey = key
    },
    fixedExpensesTable,
    incomeSnapshotsTable,
    savingsSnapshotsTable,
    fixedExpenseSnapshotsTable,
    schedulesTable,
    settingsTable,
  }
})

vi.mock('@/services/db/schema', () => ({
  default: {
    transaction: transactionSpy,
    fixedExpenses: fixedExpensesTable,
    incomeSnapshots: incomeSnapshotsTable,
    savingsSnapshots: savingsSnapshotsTable,
    fixedExpenseSnapshots: fixedExpenseSnapshotsTable,
    schedules: schedulesTable,
    settings: settingsTable,
  },
}))

import { rolloverSnapshots } from '@/services/repositories/scheduleRepository'

describe('rolloverSnapshots transaction boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'))
    resetState()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('archives due schedules and updates last open month key when rollover succeeds', async () => {
    await rolloverSnapshots()

    expect(transactionSpy).toHaveBeenCalledTimes(1)
    const tables = transactionSpy.mock.calls[0]?.[1] as unknown[]
    expect(Array.isArray(tables)).toBe(true)
    expect(tables).toContain(schedulesTable)

    expect(state.schedules.find((row) => row.id === 101)?.isActive).toBe(0)
    expect(state.settings.get('lastAppOpenMonthKey')?.value).toBe('2026-05')
  })

  it('keeps schedules active and last open month unchanged when rollover transaction fails', async () => {
    setSettingsPutFailureKey('lastAppOpenMonthKey')

    await expect(rolloverSnapshots()).rejects.toThrow('settings put failed: lastAppOpenMonthKey')

    expect(state.schedules.find((row) => row.id === 101)?.isActive).toBe(1)
    expect(state.settings.get('lastAppOpenMonthKey')?.value).toBe('2026-04')
  })
})
