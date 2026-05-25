import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FULL_SYNC_DELETE_ORDER } from '../services/sync/constants'
import type {
  Category,
  CategoryMergeHistory,
  Expense,
  ExpenseTag,
  ExpenseSplit,
  FixedExpense,
  FixedExpenseSnapshot,
  IncomeSnapshot,
  Payee,
  PayeeMergeHistory,
  SavingsSnapshot,
  Schedule,
  SyncedSettingRow,
  Tag,
} from '../types'

const deduplicateByNameMock = vi.hoisted(() => vi.fn(async () => undefined))
type UpsertRowsInBatchesMock = (
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  options?: unknown,
) => Promise<Record<string, unknown>[]>
const upsertRowsInBatchesMock = vi.hoisted(() => vi.fn<UpsertRowsInBatchesMock>(async () => []))

const getAllExpensesMock = vi.hoisted(() => vi.fn(async (): Promise<Expense[]> => []))
const getAllCategoriesMock = vi.hoisted(() => vi.fn(async (): Promise<Category[]> => []))
const getAllPayeesMock = vi.hoisted(() => vi.fn(async (): Promise<Payee[]> => []))
const getAllTagsMock = vi.hoisted(() => vi.fn(async (): Promise<Tag[]> => []))
const getAllFixedExpensesMock = vi.hoisted(() => vi.fn(async (): Promise<FixedExpense[]> => []))
const getAllSettingsRowsMock = vi.hoisted(() => vi.fn(async (): Promise<SyncedSettingRow[]> => []))
const getAllExpenseSplitsMock = vi.hoisted(() => vi.fn(async (): Promise<ExpenseSplit[]> => []))
const getAllFixedExpenseSnapshotsMock = vi.hoisted(() =>
  vi.fn(async (): Promise<FixedExpenseSnapshot[]> => []),
)
const getAllIncomeSnapshotsMock = vi.hoisted(() => vi.fn(async (): Promise<IncomeSnapshot[]> => []))
const getAllSavingsSnapshotsMock = vi.hoisted(() =>
  vi.fn(async (): Promise<SavingsSnapshot[]> => []),
)
const getAllSchedulesMock = vi.hoisted(() => vi.fn(async (): Promise<Schedule[]> => []))
const categoryMergeHistoryToArrayMock = vi.hoisted(() =>
  vi.fn(async (): Promise<CategoryMergeHistory[]> => []),
)
const payeeMergeHistoryToArrayMock = vi.hoisted(() =>
  vi.fn(async (): Promise<PayeeMergeHistory[]> => []),
)
const expenseTagsToArrayMock = vi.hoisted(() => vi.fn(async (): Promise<ExpenseTag[]> => []))
const supabaseDeleteEqMock = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{ error: { message: string; code?: string; details?: string } | null }> => ({
      error: null,
    }),
  ),
)
const supabaseDeleteMock = vi.hoisted(() => vi.fn(() => ({ eq: supabaseDeleteEqMock })))
const supabaseSelectInMock = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{ data: Record<string, unknown>[]; error: null }> => ({
      data: [],
      error: null,
    }),
  ),
)
const supabaseSelectEqMock = vi.hoisted(() =>
  vi.fn(() => ({
    in: supabaseSelectInMock,
  })),
)
const supabaseSelectMock = vi.hoisted(() =>
  vi.fn(() => ({
    eq: supabaseSelectEqMock,
  })),
)
const supabaseFromMock = vi.hoisted(() =>
  vi.fn(() => ({
    delete: supabaseDeleteMock,
    select: supabaseSelectMock,
  })),
)

const tableUpdates = vi.hoisted(
  () => [] as Array<{ table: string; key: number | string; changes: Record<string, unknown> }>,
)
const tableRows = vi.hoisted(() => new Map<string, Map<number | string, Record<string, unknown>>>())
const dbTableMock = vi.hoisted(() =>
  vi.fn((tableName: string) => ({
    get: vi.fn(async (key: number | string) => tableRows.get(tableName)?.get(key)),
    update: vi.fn(async (key: number | string, changes: Record<string, unknown>) => {
      tableUpdates.push({ table: tableName, key, changes })
      const rows = tableRows.get(tableName) ?? new Map<number | string, Record<string, unknown>>()
      const existing = rows.get(key) ?? {}
      rows.set(key, { ...existing, ...changes })
      tableRows.set(tableName, rows)
      return 1
    }),
  })),
)

vi.mock('../services/storageService', () => ({
  StorageService: {
    getAllExpenses: getAllExpensesMock,
    getAllCategories: getAllCategoriesMock,
    getAllPayees: getAllPayeesMock,
    getAllTags: getAllTagsMock,
    getAllFixedExpenses: getAllFixedExpensesMock,
    getAllSettingsRows: getAllSettingsRowsMock,
    getAllExpenseSplits: getAllExpenseSplitsMock,
    getAllFixedExpenseSnapshots: getAllFixedExpenseSnapshotsMock,
    getAllIncomeSnapshots: getAllIncomeSnapshotsMock,
    getAllSavingsSnapshots: getAllSavingsSnapshotsMock,
    getAllSchedules: getAllSchedulesMock,
    db: {
      categoryMergeHistory: { toArray: categoryMergeHistoryToArrayMock },
      payeeMergeHistory: { toArray: payeeMergeHistoryToArrayMock },
      expenseTags: { toArray: expenseTagsToArrayMock },
    },
  },
}))

vi.mock('../services/db/schema', () => ({
  default: {
    table: dbTableMock,
  },
}))

vi.mock('../services/supabase', () => ({
  supabase: {
    from: supabaseFromMock,
  },
}))

vi.mock('../services/sync/integrity', () => ({
  deduplicateByName: deduplicateByNameMock,
}))

vi.mock('../services/sync/supabaseUtils', () => ({
  assertNoSupabaseError: vi.fn(),
  assertSyncRunActive: vi.fn(),
  getIsoTimestampMs: (value: unknown) => {
    if (typeof value !== 'string' || value.length === 0) return 0
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  },
  upsertRowsInBatches: upsertRowsInBatchesMock,
}))

vi.mock('../services/syncRuntime', () => ({
  isSyncPaused: vi.fn(() => false),
}))

import {
  clearUserCloudData,
  migrateLocalToSupabase,
  runFullSyncUpload,
} from '../services/sync/fullUpload'

describe('migrateLocalToSupabase phase 4 upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tableUpdates.length = 0
    tableRows.clear()
    upsertRowsInBatchesMock.mockImplementation(async () => [])
    supabaseSelectInMock.mockResolvedValue({ data: [], error: null })
  })

  it('uploads tags before expense tag joins and maps relationship cloud ids', async () => {
    getAllExpensesMock.mockResolvedValue([
      {
        id: 100,
        localId: 'exp-100',
        cloudId: 'cloud-exp-100',
        syncStatus: 'synced',
        date: '2026-05-20',
        amount: 44.5,
      },
    ])
    getAllTagsMock.mockResolvedValue([
      {
        id: 5,
        localId: 'tag-5',
        name: 'Work',
        normalizedName: 'work',
        syncStatus: 'pending',
      },
    ])
    expenseTagsToArrayMock.mockResolvedValue([
      {
        id: 15,
        localId: 'expense-tag-15',
        expenseId: 100,
        tagId: 5,
        syncStatus: 'pending',
      },
    ])
    upsertRowsInBatchesMock.mockImplementation(async (table: string, rows: Record<string, unknown>[]) => {
      if (table === 'tags') {
        return rows.map((row) => ({
          ...row,
          id: 'cloud-tag-5',
          local_id: row.local_id,
          updated_at: '2026-05-21T00:00:00.000Z',
        }))
      }
      if (table === 'expense_tags') {
        return rows
      }
      return []
    })

    await migrateLocalToSupabase('user-1')

    const tagCallIndex = upsertRowsInBatchesMock.mock.calls.findIndex(([table]) => table === 'tags')
    const expenseTagCallIndex = upsertRowsInBatchesMock.mock.calls.findIndex(
      ([table]) => table === 'expense_tags',
    )
    expect(tagCallIndex).toBeGreaterThanOrEqual(0)
    expect(expenseTagCallIndex).toBeGreaterThan(tagCallIndex)

    const expenseTagPayload = upsertRowsInBatchesMock.mock.calls[expenseTagCallIndex]?.[1]?.[0]
    expect(expenseTagPayload).toEqual(
      expect.objectContaining({
        expense_id: 'cloud-exp-100',
        tag_id: 'cloud-tag-5',
      }),
    )
  })

  it('uploads only pending/failed rows and keeps synced rows out of upload', async () => {
    getAllCategoriesMock.mockResolvedValue([
      { id: 1, localId: 'cat-1', cloudId: null, name: 'Food', syncStatus: 'synced' },
      { id: 2, localId: 'cat-2', cloudId: null, name: 'Travel', syncStatus: 'pending' },
      { id: 3, localId: 'cat-3', cloudId: null, name: 'Fuel', syncStatus: 'failed' },
    ])

    await migrateLocalToSupabase('user-1')

    const categoryUpserts = upsertRowsInBatchesMock.mock.calls.filter(
      ([table]) => table === 'categories',
    )
    expect(categoryUpserts).toHaveLength(1)
    expect(categoryUpserts[0][1]).toHaveLength(2)
    expect(categoryUpserts[0][2]).toBe('user_id,name')
  })

  it('uses settings conflict key user_id,key and filters local-only settings', async () => {
    getAllSettingsRowsMock.mockResolvedValue([
      {
        key: 'monthlyIncome',
        value: 5000,
        localId: 'set-1',
        createdAt: '2026-05-23T10:00:00.000Z',
        updatedAt: '2026-05-23T10:00:00.000Z',
        syncStatus: 'pending',
      },
      {
        key: 'localPrivacyModeEnabled',
        value: true,
        localId: 'set-local',
        syncStatus: 'pending',
      },
    ])

    await migrateLocalToSupabase('user-1')

    const settingsUpserts = upsertRowsInBatchesMock.mock.calls.filter(
      ([table]) => table === 'settings',
    )
    expect(settingsUpserts).toHaveLength(1)
    expect(settingsUpserts[0][2]).toBe('user_id,key')
    expect(settingsUpserts[0][1]).toHaveLength(1)
    expect(settingsUpserts[0][1][0].key).toBe('monthlyIncome')
    expect(settingsUpserts[0][1][0]).toEqual(
      expect.objectContaining({
        local_id: 'set-1',
        created_at: '2026-05-23T10:00:00.000Z',
        updated_at: '2026-05-23T10:00:00.000Z',
      }),
    )
  })

  it('uploads tombstones through upsert payloads with deleted_at and relationship cloud ids', async () => {
    getAllCategoriesMock.mockResolvedValue([
      { id: 10, localId: 'cat-10', cloudId: 'cloud-cat-10', name: 'Food', syncStatus: 'synced' },
    ])
    getAllPayeesMock.mockResolvedValue([
      { id: 20, localId: 'pay-20', cloudId: 'cloud-pay-20', name: 'Cafe', syncStatus: 'synced' },
    ])
    getAllExpensesMock.mockResolvedValue([
      {
        id: 100,
        localId: 'exp-100',
        cloudId: null,
        syncStatus: 'pending',
        deletedAt: '2026-05-20T12:00:00.000Z',
        date: '2026-05-20',
        amount: 44.5,
        categoryId: 10,
        payeeId: 20,
        categoryNameSnapshot: 'Food',
        payeeNameSnapshot: 'Cafe',
      },
    ])

    await migrateLocalToSupabase('user-1')

    const expensesUpsert = upsertRowsInBatchesMock.mock.calls.find(
      ([table]) => table === 'expenses',
    )
    expect(expensesUpsert).toBeDefined()
    const payload = expensesUpsert?.[1]?.[0]
    if (!payload) throw new Error('Expected expenses upload payload')
    expect(payload.deleted_at).toBe('2026-05-20T12:00:00.000Z')
    expect(payload.category_id).toBe('cloud-cat-10')
    expect(payload.payee_id).toBe('cloud-pay-20')
    expect(payload.category_name_snapshot).toBe('Food')
    expect(payload.payee_name_snapshot).toBe('Cafe')
  })

  it('bridges legacy cloud identity with id-conflict upsert before local_id conflict upload', async () => {
    getAllCategoriesMock.mockResolvedValue([
      {
        id: 2,
        localId: 'cat-2',
        cloudId: 'legacy-cloud-cat-2',
        name: 'Travel',
        syncStatus: 'pending',
      },
    ])

    await migrateLocalToSupabase('user-1')

    const categoryCalls = upsertRowsInBatchesMock.mock.calls.filter(
      ([table]) => table === 'categories',
    )
    expect(categoryCalls).toHaveLength(2)
    expect(categoryCalls[0][2]).toBe('id')
    expect(categoryCalls[1][2]).toBe('user_id,name')
  })

  it('keeps transiently failed rows pending without reverting successful ones', async () => {
    getAllCategoriesMock.mockResolvedValue([
      { id: 2, localId: 'cat-2', cloudId: null, name: 'Travel', syncStatus: 'pending' },
    ])
    getAllExpensesMock.mockResolvedValue([
      {
        id: 100,
        localId: 'exp-100',
        cloudId: null,
        syncStatus: 'pending',
        date: '2026-05-20',
        amount: 44.5,
      },
    ])

    upsertRowsInBatchesMock.mockImplementation(
      async (table: string, _rows: Record<string, unknown>[], _onConflict: string) => {
        if (table === 'categories') {
          return [
            {
              id: 'cloud-cat-2',
              local_id: 'cat-2',
              created_at: '2026-05-01T00:00:00.000Z',
              updated_at: '2026-05-10T00:00:00.000Z',
            },
          ]
        }
        if (table === 'expenses') {
          throw new Error('network timeout')
        }
        return []
      },
    )

    await expect(migrateLocalToSupabase('user-1')).rejects.toThrow(
      'Sync upload failed for expenses: network timeout',
    )

    const categoryUpdate = tableUpdates.find(
      (call) => call.table === 'categories' && call.key === 2,
    )
    expect(categoryUpdate?.changes.syncStatus).toBe('synced')
    expect(categoryUpdate?.changes.cloudId).toBe('cloud-cat-2')
    expect(categoryUpdate?.changes.updatedAt).toBe('2026-05-10T00:00:00.000Z')
    expect(categoryUpdate?.changes.syncError).toBeNull()

    const expenseUpdate = tableUpdates.find((call) => call.table === 'expenses' && call.key === 100)
    expect(expenseUpdate?.changes.syncStatus).toBe('pending')
    expect(expenseUpdate?.changes.syncError).toBeNull()
    expect(expenseUpdate?.changes.updatedAt).toBeDefined()
  })

  it('does not mark an older delete upload synced after a newer local restore', async () => {
    const uploadedExpense: Expense = {
      id: 100,
      localId: 'exp-100',
      cloudId: 'cloud-exp-100',
      syncStatus: 'pending',
      date: '2026-05-20',
      amount: 44.5,
      updatedAt: '2026-05-20T12:00:00.000Z',
      deletedAt: '2026-05-20T12:00:00.000Z',
    }

    getAllExpensesMock.mockResolvedValue([uploadedExpense])
    tableRows.set(
      'expenses',
      new Map([
        [
          100,
          {
            ...uploadedExpense,
            updatedAt: '2026-05-20T12:00:01.000Z',
            deletedAt: null,
            syncStatus: 'pending',
          },
        ],
      ]),
    )

    upsertRowsInBatchesMock.mockImplementation(async (table: string) => {
      if (table === 'expenses') {
        return [
          {
            id: 'cloud-exp-100',
            local_id: 'exp-100',
            created_at: '2026-05-20T12:00:00.000Z',
            updated_at: '2026-05-20T12:00:00.000Z',
          },
        ]
      }
      return []
    })

    await migrateLocalToSupabase('user-1')

    const expenseUpdate = tableUpdates.find((call) => call.table === 'expenses' && call.key === 100)
    expect(expenseUpdate).toBeUndefined()
  })

  it('matches category upsert returns by normalized name when remote local_id differs', async () => {
    getAllCategoriesMock.mockResolvedValue([
      {
        id: 2,
        localId: 'device-a-cat-2',
        cloudId: null,
        name: 'Travel Dining',
        normalizedName: 'travel dining',
        syncStatus: 'pending',
      },
    ])

    upsertRowsInBatchesMock.mockImplementation(async (table: string) => {
      if (table === 'categories') {
        return [
          {
            id: 'cloud-cat-2',
            local_id: 'device-b-cat-9',
            name: 'Travel Dining',
            normalized_name: 'travel dining',
            created_at: '2026-05-01T00:00:00.000Z',
            updated_at: '2026-05-10T00:00:00.000Z',
          },
        ]
      }
      return []
    })

    await migrateLocalToSupabase('user-1')

    const categoryUpdate = tableUpdates.find(
      (call) => call.table === 'categories' && call.key === 2,
    )
    expect(categoryUpdate?.changes.syncStatus).toBe('synced')
    expect(categoryUpdate?.changes.cloudId).toBe('cloud-cat-2')
    expect(categoryUpdate?.changes.updatedAt).toBe('2026-05-10T00:00:00.000Z')
  })

  it('threads shouldContinue guard into batch upserts', async () => {
    getAllCategoriesMock.mockResolvedValue([
      { id: 2, localId: 'cat-2', cloudId: null, name: 'Travel', syncStatus: 'pending' },
    ])
    const shouldContinue = vi.fn(() => true)

    await migrateLocalToSupabase('user-1', { shouldContinue })

    const categoryUpsert = upsertRowsInBatchesMock.mock.calls.find(
      ([table]) => table === 'categories',
    )
    expect(categoryUpsert?.[3]).toEqual({ shouldContinue })
  })

  it('skips uploading stale local rows when the cloud copy is newer', async () => {
    getAllExpensesMock.mockResolvedValue([
      {
        id: 100,
        localId: 'exp-100',
        cloudId: 'cloud-exp-100',
        syncStatus: 'pending',
        date: '2026-05-20',
        amount: 10,
        updatedAt: '2026-05-10T00:00:00.000Z',
      },
    ])

    supabaseSelectInMock.mockResolvedValue({
      data: [
        {
          id: 'cloud-exp-100',
          local_id: 'exp-100',
          updated_at: '2026-05-11T00:00:00.000Z',
        },
      ],
      error: null,
    })

    const staleCloudRowsDetected = await migrateLocalToSupabase('user-1')

    expect(staleCloudRowsDetected).toBe(true)
    const expenseUpserts = upsertRowsInBatchesMock.mock.calls.filter(
      ([table]) => table === 'expenses',
    )
    expect(expenseUpserts).toHaveLength(0)
  })

  it('retries transient deadlocks when clearing user cloud data', async () => {
    supabaseDeleteEqMock
      .mockResolvedValueOnce({
        error: {
          message: 'deadlock detected',
          code: '40P01',
          details: 'retryable lock cycle',
        },
      })
      .mockResolvedValue({ error: null })

    await clearUserCloudData('user-1')

    expect(supabaseDeleteEqMock).toHaveBeenCalled()
    expect(supabaseDeleteEqMock.mock.calls.length).toBe(FULL_SYNC_DELETE_ORDER.length + 1)
  })

  it('full replace uploads synced rows for replaced tables', async () => {
    getAllCategoriesMock.mockResolvedValue([
      { id: 1, localId: 'cat-1', cloudId: 'cloud-cat-1', name: 'Food', syncStatus: 'synced' },
    ])
    getAllExpensesMock.mockResolvedValue([
      {
        id: 100,
        localId: 'exp-100',
        cloudId: 'cloud-exp-100',
        syncStatus: 'synced',
        date: '2026-05-20',
        amount: 10,
      },
    ])

    await runFullSyncUpload('user-1', true, ['categories'])

    const categoryUpserts = upsertRowsInBatchesMock.mock.calls.filter(
      ([table]) => table === 'categories',
    )
    expect(categoryUpserts.length).toBeGreaterThan(0)
    expect(categoryUpserts.some((call) => call[1]?.length > 0)).toBe(true)

    const expenseUpserts = upsertRowsInBatchesMock.mock.calls.filter(
      ([table]) => table === 'expenses',
    )
    expect(expenseUpserts).toHaveLength(0)
  })
})
