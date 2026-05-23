import { beforeEach, describe, expect, it, vi } from 'vitest'

const addCalls: Array<{ table: string; row: Record<string, unknown> }> = []
const updateCalls: Array<{ table: string; id: number; row: Record<string, unknown> }> = []
const settingsPutMock = vi.hoisted(() => vi.fn())
const syncQueueToArrayMock = vi.hoisted(() => vi.fn())
const settingsToArrayMock = vi.hoisted(() => vi.fn())
const migrateLocalToSupabaseMock = vi.hoisted(() => vi.fn(async () => undefined))
const runFullSyncUploadMock = vi.hoisted(() => vi.fn(async () => undefined))

function makeTableMock() {
  return {
    toArray: () => Promise.resolve([]),
    add: (row: Record<string, unknown>) => {
      addCalls.push({ table: '', row })
      return Promise.resolve(1)
    },
    update: (id: number, row: Record<string, unknown>) => {
      updateCalls.push({ table: '', id, row: row as Record<string, unknown> })
      return Promise.resolve(1)
    },
    bulkAdd: (rows: Array<Record<string, unknown>>) => {
      for (const row of rows) {
        addCalls.push({ table: '', row })
      }
      return Promise.resolve(rows.map((_row, index) => index + 1))
    },
    bulkPut: (rows: Array<Record<string, unknown>>) => {
      for (const row of rows) {
        if (typeof row.id === 'number') {
          updateCalls.push({ table: '', id: row.id, row })
        } else {
          addCalls.push({ table: '', row })
        }
      }
      return Promise.resolve()
    },
  }
}

vi.mock('../services/db/schema', () => ({
  default: {
    table: vi.fn(() => makeTableMock()),
    categories: { toArray: vi.fn(() => Promise.resolve([])) },
    payees: { toArray: vi.fn(() => Promise.resolve([])) },
    fixedExpenses: { toArray: vi.fn(() => Promise.resolve([])) },
    expenses: { toArray: vi.fn(() => Promise.resolve([])) },
    settings: { toArray: settingsToArrayMock, bulkPut: settingsPutMock },
    syncQueue: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: syncQueueToArrayMock,
        })),
      })),
    },
  },
}))

vi.mock('../services/storageService', () => ({
  StorageService: {
    getSyncQueue: vi.fn(() => Promise.resolve([])),
    removeSyncQueueItem: vi.fn(),
    getCategories: vi.fn(() => Promise.resolve([])),
    getPayees: vi.fn(() => Promise.resolve([])),
    getFixedExpenses: vi.fn(() => Promise.resolve([])),
  },
}))

const supabaseSelect = vi.hoisted(() => vi.fn())

vi.mock('../services/supabase', () => ({
  supabase: {
    from: supabaseSelect,
  },
}))

vi.mock('../services/sync/fullUpload', () => ({
  migrateLocalToSupabase: migrateLocalToSupabaseMock,
  runFullSyncUpload: runFullSyncUploadMock,
}))

import { StorageService } from '../services/storageService'
import { flushSyncQueue, pullFromSupabase } from '../services/syncService'

function makeQuery(data: unknown[]) {
  const page = (from = 0, to = data.length - 1) =>
    Promise.resolve({ data: data.slice(from, to + 1), error: null })

  return {
    select: () => ({
      eq: () => ({
        order: () => ({
          range: (from: number, to: number) => page(from, to),
        }),
      }),
    }),
  }
}

describe('pullFromSupabase', () => {
  beforeEach(() => {
    addCalls.length = 0
    updateCalls.length = 0
    settingsPutMock.mockReset()
    settingsToArrayMock.mockReset()
    syncQueueToArrayMock.mockReset()
    syncQueueToArrayMock.mockResolvedValue([])
    settingsToArrayMock.mockResolvedValue([])

    supabaseSelect.mockReset()
    supabaseSelect.mockImplementation((table: string) => {
      if (table === 'expenses') {
        return makeQuery([
          {
            id: '101',
            date: '2026-05-05',
            category_id: '12',
            payee_id: '42',
            description: 'Lunch',
            amount: 18.5,
            updated_at: '2026-05-05T00:00:00.000Z',
          },
        ])
      }
      if (table === 'categories') {
        return makeQuery([
          { id: '12', name: 'Food', is_archived: false, updated_at: '2026-01-01T00:00:00.000Z' },
        ])
      }
      if (table === 'payees') {
        return makeQuery([
          { id: '42', name: 'Cafe', is_archived: false, updated_at: '2026-01-01T00:00:00.000Z' },
        ])
      }
      if (table === 'fixed_expenses') {
        return makeQuery([
          { id: '7', name: 'Rent', amount: 1500, updated_at: '2026-01-01T00:00:00.000Z' },
        ])
      }
      if (table === 'fixed_expense_snapshots') {
        return makeQuery([
          {
            id: '88',
            fixed_expense_id: '7',
            name_snapshot: 'Rent',
            amount_snapshot: 1500,
            month: 5,
            year: 2026,
            created_at: '2026-05-01T00:00:00.000Z',
            updated_at: '2026-05-01T00:00:00.000Z',
          },
        ])
      }
      if (table === 'settings') {
        return makeQuery([
          { key: 'monthlyIncome', value: '5000' },
          { key: 'scheduleMaterializationLog', value: '[]' },
        ])
      }
      if (table === 'income_snapshots') {
        return makeQuery([
          {
            id: '200',
            year: 2026,
            month: 5,
            amount_snapshot: 5000,
            created_at: '2026-05-01T00:00:00.000Z',
            updated_at: '2026-05-01T00:00:00.000Z',
          },
        ])
      }
      if (table === 'savings_snapshots') {
        return makeQuery([
          {
            id: '201',
            year: 2026,
            month: 5,
            rate_snapshot: 0.2,
            created_at: '2026-05-01T00:00:00.000Z',
            updated_at: '2026-05-01T00:00:00.000Z',
          },
        ])
      }
      if (table === 'schedules') {
        return makeQuery([
          {
            id: '300',
            type: 'income',
            target_id: null,
            effective_year: 2026,
            effective_month: 6,
            new_value: 5500,
            previous_value: 5000,
            materialized_at: '2026-06-01T00:00:00.000Z',
            is_active: false,
            note: null,
            category_id: null,
            payee_id: null,
            updated_at: '2026-05-10T00:00:00.000Z',
          },
        ])
      }
      if (table === 'category_merge_history') {
        return makeQuery([
          {
            id: '400',
            source_category_id: '12',
            target_category_id: '13',
            affected_expense_ids: ['101', '102'],
            created_at: '2026-05-02T00:00:00.000Z',
            reverted_at: null,
            updated_at: '2026-05-02T00:00:00.000Z',
          },
        ])
      }
      if (table === 'payee_merge_history') {
        return makeQuery([
          {
            id: '401',
            source_payee_id: '42',
            target_payee_id: '43',
            affected_expense_ids: ['101'],
            created_at: '2026-05-03T00:00:00.000Z',
            reverted_at: null,
            updated_at: '2026-05-03T00:00:00.000Z',
          },
        ])
      }
      return makeQuery([])
    })
  })

  it('inserts all cloud records as new local rows (no existing data)', async () => {
    await pullFromSupabase('user-1')

    expect(settingsPutMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'monthlyIncome',
          value: 5000,
          updatedAt: expect.any(String),
          syncStatus: 'synced',
        }),
      ]),
    )
  })

  it('pulls more than 1000 cloud expenses across multiple pages', async () => {
    const expenseRows = Array.from({ length: 1001 }, (_, index) => ({
      id: String(1000 + index),
      date: '2026-05-05',
      category_id: '12',
      payee_id: '42',
      description: `Expense ${index + 1}`,
      amount: index + 1,
      updated_at: '2026-05-05T00:00:00.000Z',
    }))

    supabaseSelect.mockImplementation((table: string) => {
      if (table === 'expenses') return makeQuery(expenseRows)
      if (table === 'categories') {
        return makeQuery([
          { id: '12', name: 'Food', is_archived: false, updated_at: '2026-01-01T00:00:00.000Z' },
        ])
      }
      if (table === 'payees') {
        return makeQuery([
          { id: '42', name: 'Cafe', is_archived: false, updated_at: '2026-01-01T00:00:00.000Z' },
        ])
      }
      return makeQuery([])
    })

    await pullFromSupabase('user-1')

    const expenseAdds = addCalls.filter(({ row }) => row.description != null)
    expect(expenseAdds).toHaveLength(1001)
  })

  it('does not overwrite a newer local uiSettings change during pull', async () => {
    settingsToArrayMock.mockResolvedValue([
      {
        key: 'uiSettings',
        value: {
          visualTheme: 'sharpProfessionalDark',
        },
        updatedAt: '2026-05-10T00:00:00.000Z',
        syncStatus: 'pending',
      },
    ])

    supabaseSelect.mockImplementation((table: string) => {
      if (table === 'settings') {
        return makeQuery([
          {
            key: 'uiSettings',
            value: JSON.stringify({
              visualTheme: 'default',
            }),
            updated_at: '2026-05-01T00:00:00.000Z',
          },
        ])
      }
      return makeQuery([])
    })

    await pullFromSupabase('user-1')

    const writtenRows = settingsPutMock.mock.calls.flatMap(([rows]) =>
      Array.isArray(rows) ? rows : [],
    )
    expect(writtenRows.some((row) => row.key === 'uiSettings')).toBe(false)
  })

  it('keeps newer local settings when cloud settings are older', async () => {
    settingsToArrayMock.mockResolvedValue([
      {
        key: 'uiSettings',
        value: { visualTheme: 'sharpProfessionalDark' },
        updatedAt: '2026-05-10T00:00:00.000Z',
      },
    ])

    supabaseSelect.mockImplementation((table: string) => {
      if (table === 'settings') {
        return makeQuery([
          {
            key: 'uiSettings',
            value: JSON.stringify({ visualTheme: 'default' }),
            updated_at: '2026-05-01T00:00:00.000Z',
          },
        ])
      }
      return makeQuery([])
    })

    await pullFromSupabase('user-1')

    const writtenRows = settingsPutMock.mock.calls.flatMap(([rows]) =>
      Array.isArray(rows) ? rows : [],
    )
    expect(writtenRows.some((row) => row.key === 'uiSettings')).toBe(false)
  })

  it('applies newer cloud settings when local settings are older', async () => {
    settingsToArrayMock.mockResolvedValue([
      {
        key: 'uiSettings',
        value: { visualTheme: 'default' },
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ])

    supabaseSelect.mockImplementation((table: string) => {
      if (table === 'settings') {
        return makeQuery([
          {
            key: 'uiSettings',
            value: JSON.stringify({ visualTheme: 'sharpProfessionalDark' }),
            updated_at: '2026-05-10T00:00:00.000Z',
          },
        ])
      }
      return makeQuery([])
    })

    await pullFromSupabase('user-1')

    const writtenRows = settingsPutMock.mock.calls.flatMap(([rows]) =>
      Array.isArray(rows) ? rows : [],
    )
    expect(writtenRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'uiSettings',
          value: { visualTheme: 'sharpProfessionalDark' },
          updatedAt: '2026-05-10T00:00:00.000Z',
          syncStatus: 'synced',
        }),
      ]),
    )
  })
})

describe('flushSyncQueue', () => {
  beforeEach(() => {
    vi.mocked(StorageService.getSyncQueue).mockResolvedValue([])
    vi.mocked(StorageService.removeSyncQueueItem).mockReset()
    migrateLocalToSupabaseMock.mockReset()
    runFullSyncUploadMock.mockReset()
    supabaseSelect.mockReset()
  })

  it('runs metadata-based upload even when no queue items exist', async () => {
    vi.mocked(StorageService.getSyncQueue).mockResolvedValue([])
    migrateLocalToSupabaseMock.mockResolvedValue(false)

    await flushSyncQueue('user-1')

    expect(migrateLocalToSupabaseMock).toHaveBeenCalledWith('user-1', {
      shouldContinue: undefined,
    })
    expect(runFullSyncUploadMock).not.toHaveBeenCalled()
  })

  it('runs full upload for coarse full-sync queue markers and removes those markers', async () => {
    vi.mocked(StorageService.getSyncQueue).mockResolvedValue([
      {
        id: 11,
        table: '__full_sync__',
        operation: 'upsert',
        timestamp: 1,
        payload: { reason: 'backup-import', replace: true },
      },
      {
        id: 12,
        table: '__full_sync__',
        operation: 'upsert',
        timestamp: 2,
        payload: { reason: 'csv-import' },
      },
    ])

    await flushSyncQueue('user-1')

    expect(runFullSyncUploadMock).toHaveBeenCalledWith('user-1', true, undefined, {
      shouldContinue: undefined,
    })
    expect(StorageService.removeSyncQueueItem).toHaveBeenCalledWith(11)
    expect(StorageService.removeSyncQueueItem).toHaveBeenCalledWith(12)
    expect(migrateLocalToSupabaseMock).toHaveBeenCalledWith('user-1', {
      shouldContinue: undefined,
    })
  })

  it('pulls latest cloud rows when upload detects a newer cloud version', async () => {
    vi.mocked(StorageService.getSyncQueue).mockResolvedValue([])
    migrateLocalToSupabaseMock.mockResolvedValue(true)
    supabaseSelect.mockImplementation(() => makeQuery([]))

    await flushSyncQueue('user-1')

    expect(migrateLocalToSupabaseMock).toHaveBeenCalledWith('user-1', {
      shouldContinue: undefined,
    })
    expect(supabaseSelect).toHaveBeenCalledWith('expenses')
  })

  it('does not remove queue items when a sync run becomes stale after upload', async () => {
    let shouldContinue = true
    vi.mocked(StorageService.getSyncQueue).mockResolvedValue([
      {
        id: 1,
        table: '__full_sync__',
        operation: 'upsert',
        timestamp: 1,
        payload: { reason: 'backup-import' },
      },
    ])
    runFullSyncUploadMock.mockImplementation(async () => {
      shouldContinue = false
    })

    await expect(
      flushSyncQueue('user-1', {
        shouldContinue: () => shouldContinue,
      }),
    ).rejects.toThrow('Sync run superseded')

    expect(runFullSyncUploadMock).toHaveBeenCalledTimes(1)
    expect(StorageService.removeSyncQueueItem).not.toHaveBeenCalled()
  })
})
