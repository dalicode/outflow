import { beforeEach, describe, expect, it, vi } from 'vitest'

type BackupRow = Record<string, unknown>

function createTable(name: string, keyField: 'id' | 'key' = 'id') {
  let rows: BackupRow[] = []
  let nextId = 1

  return {
    name,
    reset: () => {
      rows = []
      nextId = 1
    },
    seed: (nextRows: BackupRow[]) => {
      rows = nextRows.map((row) => ({ ...row }))
      const numericIds = rows
        .map((row) => row.id)
        .filter((id): id is number => typeof id === 'number')
      nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1
    },
    rows: () => rows.map((row) => ({ ...row })),
    toArray: async () => rows.map((row) => ({ ...row })),
    clear: async () => {
      rows = []
    },
    bulkAdd: async (records: BackupRow[]) => {
      for (const record of records) {
        if (keyField === 'id' && typeof record.id !== 'number') {
          rows.push({ ...record, id: nextId++ })
          continue
        }
        rows.push({ ...record })
      }
    },
    bulkPut: async (records: BackupRow[]) => {
      for (const record of records) {
        const key = record[keyField]
        const index = rows.findIndex((row) => row[keyField] === key)

        if (index >= 0) {
          rows[index] = { ...record }
          continue
        }

        if (keyField === 'id' && typeof key !== 'number') {
          rows.push({ ...record, id: nextId++ })
          continue
        }

        rows.push({ ...record })
      }
    },
  }
}

const mockedCrypto = {
  randomUUID: vi.fn(() => '00000000-0000-4000-8000-000000000000'),
}

const tables = vi.hoisted(() => {
  const expenses = createTable('expenses')
  const categories = createTable('categories')
  const payees = createTable('payees')
  const fixedExpenses = createTable('fixedExpenses')
  const expenseSplits = createTable('expenseSplits')
  const tags = createTable('tags')
  const expenseTags = createTable('expenseTags')
  const fixedExpenseSnapshots = createTable('fixedExpenseSnapshots')
  const incomeSnapshots = createTable('incomeSnapshots')
  const savingsSnapshots = createTable('savingsSnapshots')
  const schedules = createTable('schedules')
  const settings = createTable('settings', 'key')
  const syncQueue = createTable('syncQueue')
  const categoryMergeHistory = createTable('categoryMergeHistory')
  const payeeMergeHistory = createTable('payeeMergeHistory')
  const tagMergeHistory = createTable('tagMergeHistory')

  const allTables = [
    expenses,
    categories,
    payees,
    fixedExpenses,
    expenseSplits,
    tags,
    expenseTags,
    fixedExpenseSnapshots,
    incomeSnapshots,
    savingsSnapshots,
    schedules,
    settings,
    syncQueue,
    categoryMergeHistory,
    payeeMergeHistory,
    tagMergeHistory,
  ]

  return {
    allTables,
    expenses,
    categories,
    payees,
    fixedExpenses,
    expenseSplits,
    tags,
    expenseTags,
    fixedExpenseSnapshots,
    incomeSnapshots,
    savingsSnapshots,
    schedules,
    settings,
    syncQueue,
    categoryMergeHistory,
    payeeMergeHistory,
    tagMergeHistory,
  }
})

const { queueImportSyncMarker, decryptBackup, isEncryptedEnvelope } = vi.hoisted(() => ({
  queueImportSyncMarker: vi.fn(async () => undefined),
  decryptBackup: vi.fn(),
  isEncryptedEnvelope: vi.fn(() => false),
}))

vi.stubGlobal('crypto', mockedCrypto)

vi.mock('../services/db/schema', () => ({
  default: {
    tables: tables.allTables,
    expenses: tables.expenses,
    categories: tables.categories,
    payees: tables.payees,
    fixedExpenses: tables.fixedExpenses,
    expenseSplits: tables.expenseSplits,
    tags: tables.tags,
    expenseTags: tables.expenseTags,
    fixedExpenseSnapshots: tables.fixedExpenseSnapshots,
    incomeSnapshots: tables.incomeSnapshots,
    savingsSnapshots: tables.savingsSnapshots,
    schedules: tables.schedules,
    settings: tables.settings,
    syncQueue: tables.syncQueue,
    categoryMergeHistory: tables.categoryMergeHistory,
    payeeMergeHistory: tables.payeeMergeHistory,
    tagMergeHistory: tables.tagMergeHistory,
    table: (name: string) => tables.allTables.find((table) => table.name === name),
    transaction: vi.fn(async (_mode: string, _scope: unknown, callback: () => Promise<void>) => {
      await callback()
    }),
    verno: 20,
  },
}))

vi.mock('../services/importService', () => ({
  queueImportSyncMarker,
}))

vi.mock('../utils/backupCrypto', () => ({
  decryptBackup,
  isEncryptedEnvelope,
}))

vi.mock('../services/syncRuntime', () => ({
  FULL_SYNC_QUEUE_REASON: 'backup-import',
}))

import {
  exportAllData,
  importAllData,
  importBackup,
} from '../services/repositories/backupRepository'

describe('backupRepository', () => {
  beforeEach(() => {
    for (const table of tables.allTables) {
      table.reset()
    }
    vi.clearAllMocks()
    mockedCrypto.randomUUID.mockReturnValue('00000000-0000-4000-8000-000000000000')
    isEncryptedEnvelope.mockReturnValue(false)
  })

  it('exports tombstones and sync metadata in backup payloads', async () => {
    tables.expenses.seed([
      {
        id: 3,
        localId: 'expense-3',
        date: '2026-05-01',
        amount: 22,
        deletedAt: '2026-05-02T00:00:00.000Z',
        syncStatus: 'pending',
      },
    ])
    tables.categories.seed([
      {
        id: 7,
        localId: 'category-7',
        name: 'Dining',
        normalizedName: 'dining',
        deletedAt: null,
        syncStatus: 'synced',
      },
    ])
    tables.expenseSplits.seed([
      {
        id: 55,
        localId: 'split-55',
        date: '2026-05-01',
        amount: 22,
        deletedAt: null,
        syncStatus: 'pending',
      },
    ])
    tables.tags.seed([
      {
        id: 8,
        localId: 'tag-8',
        name: 'Work',
        normalizedName: 'work',
        deletedAt: null,
        syncStatus: 'pending',
      },
    ])
    tables.expenseTags.seed([
      {
        id: 9,
        localId: 'expense-tag-9',
        expenseId: 3,
        tagId: 8,
        deletedAt: null,
        syncStatus: 'pending',
      },
    ])
    tables.tagMergeHistory.seed([
      {
        id: 71,
        localId: 'tag-merge-71',
        sourceTagId: 8,
        targetTagId: 9,
        affectedExpenseTagIds: [9],
        duplicateExpenseTagIds: [],
        deletedAt: null,
        syncStatus: 'pending',
      },
    ])

    const payload = await exportAllData()

    expect(payload.expenses).toEqual([
      expect.objectContaining({
        id: 3,
        localId: 'expense-3',
        deletedAt: '2026-05-02T00:00:00.000Z',
        syncStatus: 'pending',
      }),
    ])
    expect(payload.categories).toEqual([
      expect.objectContaining({
        id: 7,
        localId: 'category-7',
        normalizedName: 'dining',
        syncStatus: 'synced',
      }),
    ])
    expect(payload.expenseSplits).toEqual([
      expect.objectContaining({
        id: 55,
        localId: 'split-55',
        syncStatus: 'pending',
      }),
    ])
    expect(payload.tags).toEqual([
      expect.objectContaining({
        id: 8,
        localId: 'tag-8',
        normalizedName: 'work',
      }),
    ])
    expect(payload.expenseTags).toEqual([
      expect.objectContaining({
        id: 9,
        localId: 'expense-tag-9',
        expenseId: 3,
        tagId: 8,
      }),
    ])
    expect(payload.tagMergeHistory).toEqual([
      expect.objectContaining({
        id: 71,
        localId: 'tag-merge-71',
        sourceTagId: 8,
        targetTagId: 9,
      }),
    ])
  })

  it('normalizes legacy backup rows, preserves tombstones, and queues one repair sync', async () => {
    mockedCrypto.randomUUID
      .mockReturnValueOnce('category-local-id')
      .mockReturnValueOnce('category-device-id')
      .mockReturnValueOnce('payee-local-id')
      .mockReturnValueOnce('payee-device-id')
      .mockReturnValueOnce('expense-local-id')
      .mockReturnValueOnce('expense-device-id')
      .mockReturnValueOnce('setting-local-id')
      .mockReturnValueOnce('setting-device-id')

    await importAllData(
      {
        meta: { format: 'outflow-backup' },
        data: {
          categories: [{ id: 10, name: ' Dining Out  ' }],
          payees: [{ id: 20, name: 'Tim Hortons' }],
          tags: [{ id: 40, name: ' Work Travel ' }],
          expenses: [
            {
              id: 30,
              date: '2026-05-01',
              amount: 17,
              splitId: 91,
              categoryId: 10,
              payeeId: 20,
              deletedAt: '2026-05-03T00:00:00.000Z',
            },
          ],
          expenseTags: [{ id: 41, expenseId: 30, tagId: 40 }],
          tagMergeHistory: [
            {
              id: 51,
              sourceTagId: 40,
              targetTagId: 41,
              affectedExpenseTagIds: [41],
              duplicateExpenseTagIds: [],
            },
          ],
          expenseSplits: [{ id: 91, date: '2026-05-01', amount: 17 }],
          settings: [{ key: 'visualTheme', value: 'mint' }],
          syncQueue: [
            {
              id: 99,
              table: 'expenses',
              operation: 'update',
              payload: { id: 30 },
              timestamp: 123,
            },
          ],
        },
      },
      { replace: true, queueFullSync: true },
    )

    expect(tables.categories.rows()).toEqual([
      expect.objectContaining({
        id: 10,
        name: ' Dining Out  ',
        normalizedName: 'dining out',
        syncStatus: 'pending',
        localId: expect.any(String),
      }),
    ])
    expect(tables.expenses.rows()).toEqual([
      expect.objectContaining({
        id: 30,
        splitId: 91,
        categoryNameSnapshot: ' Dining Out  ',
        payeeNameSnapshot: 'Tim Hortons',
        deletedAt: '2026-05-03T00:00:00.000Z',
        syncStatus: 'pending',
        localId: expect.any(String),
      }),
    ])
    expect(tables.expenseSplits.rows()).toEqual([
      expect.objectContaining({
        id: 91,
        amount: 17,
        syncStatus: 'pending',
        localId: expect.any(String),
      }),
    ])
    expect(tables.tags.rows()).toEqual([
      expect.objectContaining({
        id: 40,
        name: ' Work Travel ',
        normalizedName: 'work travel',
        syncStatus: 'pending',
        localId: expect.any(String),
      }),
    ])
    expect(tables.expenseTags.rows()).toEqual([
      expect.objectContaining({
        id: 41,
        expenseId: 30,
        tagId: 40,
        syncStatus: 'pending',
        localId: expect.any(String),
      }),
    ])
    expect(tables.tagMergeHistory.rows()).toEqual([
      expect.objectContaining({
        id: 51,
        sourceTagId: 40,
        targetTagId: 41,
        affectedExpenseTagIds: [41],
        duplicateExpenseTagIds: [],
        syncStatus: 'pending',
        localId: expect.any(String),
      }),
    ])
    expect(tables.settings.rows()).toEqual([
      expect.objectContaining({
        key: 'visualTheme',
        value: 'mint',
        syncStatus: 'pending',
        localId: expect.any(String),
      }),
    ])
    expect(tables.syncQueue.rows()).toHaveLength(0)
    expect(queueImportSyncMarker).toHaveBeenCalledTimes(1)
    expect(queueImportSyncMarker).toHaveBeenCalledWith(
      { reason: 'backup-import', replace: true },
      { preserveDeletesOnly: true },
    )
  })

  it('imports encrypted backups and preserves existing sync metadata when present', async () => {
    isEncryptedEnvelope.mockReturnValue(true)
    decryptBackup.mockResolvedValue({
      data: {
        expenses: [
          {
            id: 41,
            localId: 'expense-41',
            date: '2026-05-08',
            amount: 91,
            syncStatus: 'failed',
            syncError: 'Network timeout',
            lastSyncedAt: '2026-05-07T00:00:00.000Z',
            deletedAt: null,
          },
        ],
      },
    })

    await importBackup({ version: 1, format: 'gzip+aes' }, 'pw', { queueFullSync: false })

    expect(decryptBackup).toHaveBeenCalledWith({ version: 1, format: 'gzip+aes' }, 'pw')
    expect(tables.expenses.rows()).toEqual([
      expect.objectContaining({
        id: 41,
        localId: 'expense-41',
        syncStatus: 'failed',
        syncError: 'Network timeout',
        lastSyncedAt: '2026-05-07T00:00:00.000Z',
      }),
    ])
  })
})
