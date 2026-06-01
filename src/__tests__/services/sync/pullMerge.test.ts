import { beforeEach, describe, expect, it, vi } from 'vitest'

type TableName =
  | 'categories'
  | 'payees'
  | 'fixedExpenses'
  | 'expenseSplits'
  | 'fixedExpenseSnapshots'
  | 'incomeSnapshots'
  | 'savingsSnapshots'
  | 'schedules'
  | 'categoryMergeHistory'
  | 'payeeMergeHistory'
  | 'tagMergeHistory'
  | 'expenses'
  | 'tags'
  | 'expenseTags'

const localState = vi.hoisted(() => ({
  categories: [] as Array<Record<string, unknown>>,
  payees: [] as Array<Record<string, unknown>>,
  fixedExpenses: [] as Array<Record<string, unknown>>,
  expenseSplits: [] as Array<Record<string, unknown>>,
  fixedExpenseSnapshots: [] as Array<Record<string, unknown>>,
  incomeSnapshots: [] as Array<Record<string, unknown>>,
  savingsSnapshots: [] as Array<Record<string, unknown>>,
  schedules: [] as Array<Record<string, unknown>>,
  categoryMergeHistory: [] as Array<Record<string, unknown>>,
  payeeMergeHistory: [] as Array<Record<string, unknown>>,
  tagMergeHistory: [] as Array<Record<string, unknown>>,
  expenses: [] as Array<Record<string, unknown>>,
  tags: [] as Array<Record<string, unknown>>,
  expenseTags: [] as Array<Record<string, unknown>>,
  settings: [] as Array<Record<string, unknown>>,
}))

const bulkWriteCalls = vi.hoisted(() => ({
  bulkAdd: [] as Array<{ table: string; count: number }>,
  bulkPut: [] as Array<{ table: string; count: number }>,
}))

const remoteState = vi.hoisted(() => ({
  categories: [] as Array<Record<string, unknown>>,
  payees: [] as Array<Record<string, unknown>>,
  fixed_expenses: [] as Array<Record<string, unknown>>,
  expense_splits: [] as Array<Record<string, unknown>>,
  fixed_expense_snapshots: [] as Array<Record<string, unknown>>,
  income_snapshots: [] as Array<Record<string, unknown>>,
  savings_snapshots: [] as Array<Record<string, unknown>>,
  schedules: [] as Array<Record<string, unknown>>,
  category_merge_history: [] as Array<Record<string, unknown>>,
  payee_merge_history: [] as Array<Record<string, unknown>>,
  tag_merge_history: [] as Array<Record<string, unknown>>,
  expenses: [] as Array<Record<string, unknown>>,
  tags: [] as Array<Record<string, unknown>>,
  expense_tags: [] as Array<Record<string, unknown>>,
  settings: [] as Array<Record<string, unknown>>,
}))

function resetArrayState(state: Record<string, Array<Record<string, unknown>>>): void {
  for (const key of Object.keys(state)) {
    state[key].length = 0
  }
}

function nextNumericId(rows: Array<Record<string, unknown>>): number {
  return (
    rows.reduce((max, row) => {
      const id = typeof row.id === 'number' ? row.id : 0
      return Math.max(max, id)
    }, 0) + 1
  )
}

function cloneRow<T extends Record<string, unknown>>(row: T): T {
  return { ...row }
}

function makeNumericTable(name: TableName) {
  const getRows = () => localState[name]

  return {
    toArray: async () => getRows().map(cloneRow),
    where: (field: string) => ({
      equals: (value: unknown) => ({
        toArray: async () =>
          getRows()
            .filter((row) => row[field] === value)
            .map(cloneRow),
      }),
    }),
    add: async (row: Record<string, unknown>) => {
      const id = nextNumericId(getRows())
      getRows().push({ ...row, id })
      return id
    },
    update: async (id: number, changes: Record<string, unknown>) => {
      const rows = getRows()
      const index = rows.findIndex((row) => row.id === id)
      if (index === -1) return 0
      rows[index] = { ...rows[index], ...changes, id }
      return 1
    },
    put: async (row: Record<string, unknown>) => {
      if (typeof row.id === 'number') {
        const index = getRows().findIndex((entry) => entry.id === row.id)
        if (index >= 0) {
          getRows()[index] = { ...getRows()[index], ...row }
          return row.id
        }
      }
      const id = nextNumericId(getRows())
      getRows().push({ ...row, id })
      return id
    },
    bulkAdd: async (rows: Array<Record<string, unknown>>) => {
      bulkWriteCalls.bulkAdd.push({ table: name, count: rows.length })
      const ids: number[] = []
      for (const row of rows) {
        const id = nextNumericId(getRows())
        getRows().push({ ...row, id })
        ids.push(id)
      }
      return ids
    },
    bulkPut: async (rows: Array<Record<string, unknown>>) => {
      bulkWriteCalls.bulkPut.push({ table: name, count: rows.length })
      for (const row of rows) {
        if (typeof row.id === 'number') {
          const index = getRows().findIndex((entry) => entry.id === row.id)
          if (index >= 0) {
            getRows()[index] = { ...getRows()[index], ...row }
            continue
          }
        }
        const id = nextNumericId(getRows())
        getRows().push({ ...row, id })
      }
    },
  }
}

function makeSettingsTable() {
  return {
    toArray: async () => localState.settings.map(cloneRow),
    get: async (key: string) => localState.settings.find((row) => row.key === key),
    put: async (row: Record<string, unknown>) => {
      const index = localState.settings.findIndex((entry) => entry.key === row.key)
      if (index >= 0) {
        localState.settings[index] = { ...localState.settings[index], ...row }
        return row.key as string
      }
      localState.settings.push({ ...row })
      return row.key as string
    },
    bulkPut: async (rows: Array<Record<string, unknown>>) => {
      bulkWriteCalls.bulkPut.push({ table: 'settings', count: rows.length })
      for (const row of rows) {
        const index = localState.settings.findIndex((entry) => entry.key === row.key)
        if (index >= 0) {
          localState.settings[index] = { ...localState.settings[index], ...row }
          continue
        }
        localState.settings.push({ ...row })
      }
    },
  }
}

const dbMock = vi.hoisted(() => ({
  table: vi.fn((name: string) => {
    if (name === 'settings') return makeSettingsTable()
    return makeNumericTable(name as TableName)
  }),
  categories: makeNumericTable('categories'),
  payees: makeNumericTable('payees'),
  fixedExpenses: makeNumericTable('fixedExpenses'),
  expenseSplits: makeNumericTable('expenseSplits'),
  fixedExpenseSnapshots: makeNumericTable('fixedExpenseSnapshots'),
  incomeSnapshots: makeNumericTable('incomeSnapshots'),
  savingsSnapshots: makeNumericTable('savingsSnapshots'),
  schedules: makeNumericTable('schedules'),
  categoryMergeHistory: makeNumericTable('categoryMergeHistory'),
  payeeMergeHistory: makeNumericTable('payeeMergeHistory'),
  tagMergeHistory: makeNumericTable('tagMergeHistory'),
  expenses: makeNumericTable('expenses'),
  tags: makeNumericTable('tags'),
  expenseTags: makeNumericTable('expenseTags'),
  settings: makeSettingsTable(),
}))

vi.mock('@/services/db/schema', () => ({
  default: dbMock,
}))

function makeQuery(table: keyof typeof remoteState) {
  const rows = remoteState[table]
  return {
    select: () => ({
      eq: () => ({
        order: () => ({
          range: async (from: number, to: number) => ({
            data: rows.slice(from, to + 1).map(cloneRow),
            error: null,
          }),
        }),
      }),
    }),
  }
}

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: (table: keyof typeof remoteState) => makeQuery(table),
  },
}))

import { verifySyncIntegrity } from '@/services/sync/integrity'
import { pullFromSupabase } from '@/services/sync/pullMerge'

describe('pullFromSupabase Phase 5 merge behavior', () => {
  beforeEach(() => {
    resetArrayState(localState)
    resetArrayState(remoteState)
    bulkWriteCalls.bulkAdd.length = 0
    bulkWriteCalls.bulkPut.length = 0
  })

  it('lets a newer remote tombstone win over an older local active expense', async () => {
    localState.categories.push({
      id: 1,
      localId: 'cat-1',
      cloudId: 'cloud-cat-1',
      name: 'Food',
      normalizedName: 'food',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })
    localState.payees.push({
      id: 1,
      localId: 'payee-1',
      cloudId: 'cloud-payee-1',
      name: 'Cafe',
      normalizedName: 'cafe',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })
    localState.expenses.push({
      id: 1,
      localId: 'expense-1',
      cloudId: 'cloud-expense-1',
      date: '2026-05-02',
      amount: 18.5,
      categoryId: 1,
      payeeId: 1,
      notes: 'Local lunch',
      updatedAt: '2026-05-02T00:00:00.000Z',
      deletedAt: null,
    })

    remoteState.expenses.push({
      id: 'cloud-expense-1',
      local_id: 'expense-1',
      date: '2026-05-02',
      amount: 18.5,
      category_id: 'cloud-cat-1',
      payee_id: 'cloud-payee-1',
      notes: 'Local lunch',
      deleted_at: '2026-05-10T00:00:00.000Z',
      updated_at: '2026-05-10T00:00:00.000Z',
    })

    await pullFromSupabase('user-1')

    expect(localState.expenses).toHaveLength(1)
    expect(localState.expenses[0].deletedAt).toBe('2026-05-10T00:00:00.000Z')
    expect(localState.expenses[0].syncStatus).toBe('synced')
  })

  it('keeps a newer local tombstone when the remote row is older and active', async () => {
    localState.categories.push({
      id: 1,
      localId: 'cat-1',
      cloudId: 'cloud-cat-1',
      name: 'Food',
      normalizedName: 'food',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })
    localState.payees.push({
      id: 1,
      localId: 'payee-1',
      cloudId: 'cloud-payee-1',
      name: 'Cafe',
      normalizedName: 'cafe',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })
    localState.expenses.push({
      id: 1,
      localId: 'expense-1',
      cloudId: 'cloud-expense-1',
      date: '2026-05-02',
      amount: 18.5,
      categoryId: 1,
      payeeId: 1,
      notes: 'Locally deleted',
      updatedAt: '2026-05-12T00:00:00.000Z',
      deletedAt: '2026-05-12T00:00:00.000Z',
    })

    remoteState.expenses.push({
      id: 'cloud-expense-1',
      local_id: 'expense-1',
      date: '2026-05-02',
      amount: 99,
      category_id: 'cloud-cat-1',
      payee_id: 'cloud-payee-1',
      notes: 'Older cloud copy',
      updated_at: '2026-05-03T00:00:00.000Z',
      deleted_at: null,
    })

    await pullFromSupabase('user-1')

    expect(localState.expenses[0].deletedAt).toBe('2026-05-12T00:00:00.000Z')
    expect(localState.expenses[0].amount).toBe(18.5)
    expect(localState.expenses[0].notes).toBe('Locally deleted')
  })

  it('applies a newer remote restore over an older local tombstone', async () => {
    localState.categories.push({
      id: 1,
      localId: 'cat-1',
      cloudId: 'cloud-cat-1',
      name: 'Food',
      normalizedName: 'food',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })
    localState.payees.push({
      id: 1,
      localId: 'payee-1',
      cloudId: 'cloud-payee-1',
      name: 'Cafe',
      normalizedName: 'cafe',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })
    localState.expenses.push({
      id: 1,
      localId: 'expense-1',
      cloudId: 'cloud-expense-1',
      date: '2026-05-02',
      amount: 18.5,
      categoryId: 1,
      payeeId: 1,
      notes: 'Old local tombstone',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: '2026-05-01T00:00:00.000Z',
    })

    remoteState.expenses.push({
      id: 'cloud-expense-1',
      local_id: 'expense-1',
      date: '2026-05-02',
      amount: 24.75,
      category_id: 'cloud-cat-1',
      payee_id: 'cloud-payee-1',
      notes: 'Restored remotely',
      updated_at: '2026-05-11T00:00:00.000Z',
      deleted_at: null,
    })

    await pullFromSupabase('user-1')

    expect(localState.expenses[0].deletedAt).toBeNull()
    expect(localState.expenses[0].amount).toBe(24.75)
    expect(localState.expenses[0].notes).toBe('Restored remotely')
  })

  it('adopts seeded identity rows by normalized name without creating duplicates on restore', async () => {
    localState.categories.push({
      id: 1,
      localId: 'seed-category',
      cloudId: null,
      name: 'Food',
      normalizedName: 'food',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    })
    localState.payees.push({
      id: 1,
      localId: 'seed-payee',
      cloudId: null,
      name: 'Cafe',
      normalizedName: 'cafe',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    })

    remoteState.categories.push({
      id: 'cloud-cat-1',
      local_id: 'remote-category-1',
      name: 'Food',
      normalized_name: 'food',
      is_archived: false,
      updated_at: '2026-05-10T00:00:00.000Z',
    })
    remoteState.payees.push({
      id: 'cloud-payee-1',
      local_id: 'remote-payee-1',
      name: 'Cafe',
      normalized_name: 'cafe',
      is_archived: false,
      updated_at: '2026-05-10T00:00:00.000Z',
    })
    remoteState.expenses.push({
      id: 'cloud-expense-1',
      local_id: 'remote-expense-1',
      date: '2026-05-12',
      amount: 21,
      category_id: 'cloud-cat-1',
      payee_id: 'cloud-payee-1',
      notes: 'Restored with adopted defaults',
      updated_at: '2026-05-12T00:00:00.000Z',
      deleted_at: null,
    })

    await pullFromSupabase('user-1')

    expect(localState.categories).toHaveLength(1)
    expect(localState.categories[0].id).toBe(1)
    expect(localState.categories[0].cloudId).toBe('cloud-cat-1')
    expect(localState.categories[0].localId).toBe('remote-category-1')

    expect(localState.payees).toHaveLength(1)
    expect(localState.payees[0].id).toBe(1)
    expect(localState.payees[0].cloudId).toBe('cloud-payee-1')
    expect(localState.payees[0].localId).toBe('remote-payee-1')

    expect(localState.expenses).toHaveLength(1)
    expect(localState.expenses[0].categoryId).toBe(1)
    expect(localState.expenses[0].payeeId).toBe(1)
  })

  it('adopts cloud identity metadata on older normalized-name matches while keeping newer local fields', async () => {
    localState.categories.push({
      id: 1,
      cloudId: null,
      name: 'Food',
      normalizedName: 'food',
      isArchived: false,
      updatedAt: '2026-05-20T00:00:00.000Z',
      deletedAt: null,
    })
    localState.payees.push({
      id: 1,
      cloudId: null,
      name: 'Cafe',
      normalizedName: 'cafe',
      isArchived: false,
      updatedAt: '2026-05-20T00:00:00.000Z',
      deletedAt: null,
    })

    remoteState.categories.push({
      id: 'cloud-cat-1',
      local_id: 'remote-cat-1',
      name: 'Food',
      normalized_name: 'food',
      is_archived: true,
      updated_at: '2026-05-10T00:00:00.000Z',
      deleted_at: null,
    })
    remoteState.payees.push({
      id: 'cloud-payee-1',
      local_id: 'remote-payee-1',
      name: 'Cafe',
      normalized_name: 'cafe',
      is_archived: true,
      updated_at: '2026-05-10T00:00:00.000Z',
      deleted_at: null,
    })

    await pullFromSupabase('user-1')

    expect(localState.categories).toHaveLength(1)
    expect(localState.categories[0].isArchived).toBe(false)
    expect(localState.categories[0].cloudId).toBe('cloud-cat-1')
    expect(localState.categories[0].localId).toBe('remote-cat-1')

    expect(localState.payees).toHaveLength(1)
    expect(localState.payees[0].isArchived).toBe(false)
    expect(localState.payees[0].cloudId).toBe('cloud-payee-1')
    expect(localState.payees[0].localId).toBe('remote-payee-1')
  })

  it('restores many expenses on a fresh device without dropping relationship resolution', async () => {
    remoteState.categories.push({
      id: 'cloud-cat-1',
      local_id: 'remote-category-1',
      name: 'Food',
      normalized_name: 'food',
      is_archived: false,
      updated_at: '2026-05-10T00:00:00.000Z',
    })
    remoteState.payees.push({
      id: 'cloud-payee-1',
      local_id: 'remote-payee-1',
      name: 'Cafe',
      normalized_name: 'cafe',
      is_archived: false,
      updated_at: '2026-05-10T00:00:00.000Z',
    })

    for (let index = 0; index < 600; index += 1) {
      remoteState.expenses.push({
        id: `cloud-expense-${index}`,
        local_id: `remote-expense-${index}`,
        date: '2026-05-12',
        amount: index + 1,
        category_id: 'cloud-cat-1',
        payee_id: 'cloud-payee-1',
        notes: `expense-${index}`,
        updated_at: '2026-05-12T00:00:00.000Z',
        deleted_at: null,
      })
    }

    await pullFromSupabase('user-1')

    expect(localState.categories).toHaveLength(1)
    expect(localState.payees).toHaveLength(1)
    expect(localState.expenses).toHaveLength(600)
    expect(localState.expenses.every((row) => row.categoryId === 1)).toBe(true)
    expect(localState.expenses.every((row) => row.payeeId === 1)).toBe(true)
    expect(
      bulkWriteCalls.bulkAdd.filter((call) => call.table === 'expenses').map((call) => call.count),
    ).toEqual([500, 100])
  })

  it('resolves expense split relationships through cloud split ids', async () => {
    localState.categories.push({
      id: 1,
      localId: 'cat-1',
      cloudId: 'cloud-cat-1',
      name: 'Food',
      normalizedName: 'food',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })
    localState.payees.push({
      id: 1,
      localId: 'payee-1',
      cloudId: 'cloud-payee-1',
      name: 'Cafe',
      normalizedName: 'cafe',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })
    remoteState.expense_splits.push({
      id: 'cloud-split-1',
      local_id: 'split-1',
      date: '2026-05-12',
      amount: 30,
      payee_id: 'cloud-payee-1',
      updated_at: '2026-05-12T00:00:00.000Z',
      deleted_at: null,
    })
    remoteState.expenses.push({
      id: 'cloud-expense-1',
      local_id: 'expense-1',
      date: '2026-05-12',
      amount: 30,
      category_id: 'cloud-cat-1',
      payee_id: 'cloud-payee-1',
      split_id: 'cloud-split-1',
      notes: 'Split child',
      updated_at: '2026-05-12T00:00:00.000Z',
      deleted_at: null,
    })

    await pullFromSupabase('user-1')

    expect(localState.expenseSplits).toHaveLength(1)
    expect(localState.expenses).toHaveLength(1)
    expect(localState.expenses[0].splitId).toBe(localState.expenseSplits[0].id)
  })

  it('reconciles child date but preserves child payee divergence on pull', async () => {
    localState.categories.push({
      id: 1,
      localId: 'cat-1',
      cloudId: 'cloud-cat-1',
      name: 'Food',
      normalizedName: 'food',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })
    localState.payees.push(
      {
        id: 1,
        localId: 'payee-1',
        cloudId: 'cloud-payee-1',
        name: 'Cafe',
        normalizedName: 'cafe',
        updatedAt: '2026-05-01T00:00:00.000Z',
        deletedAt: null,
      },
      {
        id: 2,
        localId: 'payee-2',
        cloudId: 'cloud-payee-2',
        name: 'Grocer',
        normalizedName: 'grocer',
        updatedAt: '2026-05-01T00:00:00.000Z',
        deletedAt: null,
      },
    )
    localState.expenseSplits.push({
      id: 10,
      localId: 'split-1',
      cloudId: 'cloud-split-1',
      date: '2026-05-01',
      amount: 30,
      payeeId: 1,
      payeeNameSnapshot: 'Cafe',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'synced',
    })
    localState.expenses.push({
      id: 20,
      localId: 'expense-1',
      cloudId: 'cloud-expense-1',
      date: '2026-05-01',
      amount: 30,
      categoryId: 1,
      payeeId: 1,
      payeeNameSnapshot: 'Cafe',
      splitId: 10,
      notes: 'Split child',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'synced',
    })

    remoteState.expense_splits.push({
      id: 'cloud-split-1',
      local_id: 'split-1',
      date: '2026-05-12',
      amount: 30,
      payee_id: 'cloud-payee-2',
      payee_name_snapshot: 'Grocer',
      updated_at: '2026-05-12T00:00:00.000Z',
      deleted_at: null,
    })
    remoteState.expenses.push({
      id: 'cloud-expense-1',
      local_id: 'expense-1',
      date: '2026-05-01',
      amount: 30,
      category_id: 'cloud-cat-1',
      payee_id: 'cloud-payee-1',
      payee_name_snapshot: 'Cafe',
      split_id: 'cloud-split-1',
      notes: 'Split child',
      updated_at: '2026-05-11T00:00:00.000Z',
      deleted_at: null,
    })

    await pullFromSupabase('user-1')

    expect(localState.expenses).toHaveLength(1)
    expect(localState.expenses[0].date).toBe('2026-05-12')
    expect(localState.expenses[0].payeeId).toBe(1)
    expect(localState.expenses[0].payeeNameSnapshot).toBe('Cafe')
    expect(localState.expenses[0].syncStatus).toBe('pending')
    expect(localState.expenses[0].notes).toBe('Split child')
  })

  it('marks equal-version pending local rows synced when the cloud row already exists', async () => {
    localState.tags.push({
      id: 1,
      localId: 'tag-local-1',
      cloudId: 'cloud-tag-1',
      name: 'Travel',
      normalizedName: 'travel',
      updatedAt: '2026-05-12T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'pending',
      lastSyncedAt: null,
      syncError: null,
    })
    remoteState.tags.push({
      id: 'cloud-tag-1',
      local_id: 'tag-local-1',
      name: 'Travel',
      normalized_name: 'travel',
      updated_at: '2026-05-12T00:00:00.000Z',
      deleted_at: null,
    })

    await pullFromSupabase('user-1')

    expect(localState.tags[0].syncStatus).toBe('synced')
    expect(localState.tags[0].syncError).toBeNull()
    expect(localState.tags[0].lastSyncedAt).toBe('2026-05-12T00:00:00.000Z')
  })

  it('marks pending local rows synced when the pulled cloud row has a newer timestamp', async () => {
    localState.expenses.push({
      id: 1,
      localId: 'expense-local-1',
      cloudId: 'cloud-expense-1',
      date: '2026-05-12',
      amount: 42,
      categoryId: null,
      payeeId: null,
      notes: 'Pending locally',
      updatedAt: '2026-05-12T00:00:00.000Z',
      deletedAt: null,
      syncStatus: 'pending',
      lastSyncedAt: null,
      syncError: null,
    })
    remoteState.expenses.push({
      id: 'cloud-expense-1',
      local_id: 'expense-local-1',
      date: '2026-05-12',
      amount: 42,
      category_id: null,
      payee_id: null,
      notes: 'Pending locally',
      updated_at: '2026-05-12T00:00:01.000Z',
      deleted_at: null,
    })

    await pullFromSupabase('user-1')

    expect(localState.expenses[0].syncStatus).toBe('synced')
    expect(localState.expenses[0].syncError).toBeNull()
    expect(localState.expenses[0].updatedAt).toBe('2026-05-12T00:00:01.000Z')
    expect(localState.expenses[0].lastSyncedAt).toBe('2026-05-12T00:00:01.000Z')
  })

  it('keeps pending local rows pending when the pulled cloud row is older', async () => {
    localState.expenseTags.push({
      id: 1,
      localId: 'expense-tag-local-1',
      cloudId: 'cloud-expense-tag-1',
      expenseId: 10,
      tagId: 20,
      updatedAt: '2026-05-12T00:00:02.000Z',
      deletedAt: null,
      syncStatus: 'pending',
      lastSyncedAt: null,
      syncError: null,
    })
    remoteState.expense_tags.push({
      id: 'cloud-expense-tag-1',
      local_id: 'expense-tag-local-1',
      expense_id: 10,
      tag_id: 20,
      updated_at: '2026-05-12T00:00:01.000Z',
      deleted_at: null,
    })

    await pullFromSupabase('user-1')

    expect(localState.expenseTags[0].syncStatus).toBe('pending')
    expect(localState.expenseTags[0].lastSyncedAt).toBeNull()
    expect(localState.expenseTags[0].updatedAt).toBe('2026-05-12T00:00:02.000Z')
  })

  it('collapses duplicate snapshot rows by natural month key even when local ids differ', async () => {
    localState.fixedExpenses.push({
      id: 11,
      localId: 'fixed-local-11',
      cloudId: 'cloud-fixed-11',
      name: 'Rent',
      amount: 1200,
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })
    localState.incomeSnapshots.push(
      {
        id: 1,
        localId: 'income-local-a',
        year: 2026,
        month: 4,
        amountSnapshot: 4800,
        updatedAt: '2026-05-01T00:00:00.000Z',
        deletedAt: null,
      },
      {
        id: 2,
        localId: 'income-local-b',
        year: 2026,
        month: 4,
        amountSnapshot: 4900,
        updatedAt: '2026-05-02T00:00:00.000Z',
        deletedAt: null,
      },
    )
    localState.savingsSnapshots.push(
      {
        id: 3,
        localId: 'savings-local-a',
        year: 2026,
        month: 4,
        rateSnapshot: 0.17,
        updatedAt: '2026-05-01T00:00:00.000Z',
        deletedAt: null,
      },
      {
        id: 4,
        localId: 'savings-local-b',
        year: 2026,
        month: 4,
        rateSnapshot: 0.18,
        updatedAt: '2026-05-03T00:00:00.000Z',
        deletedAt: null,
      },
    )
    localState.fixedExpenseSnapshots.push(
      {
        id: 5,
        localId: 'fixed-snapshot-a',
        fixedExpenseId: 11,
        year: 2026,
        month: 4,
        nameSnapshot: 'Rent',
        amountSnapshot: 1150,
        updatedAt: '2026-05-01T00:00:00.000Z',
        deletedAt: null,
      },
      {
        id: 6,
        localId: 'fixed-snapshot-b',
        fixedExpenseId: 11,
        year: 2026,
        month: 4,
        nameSnapshot: 'Rent',
        amountSnapshot: 1180,
        updatedAt: '2026-05-03T00:00:00.000Z',
        deletedAt: null,
      },
    )

    remoteState.fixed_expenses.push({
      id: 'cloud-fixed-11',
      local_id: 'remote-fixed-11',
      name: 'Rent',
      amount: 1200,
      updated_at: '2026-05-10T00:00:00.000Z',
    })
    remoteState.income_snapshots.push(
      {
        id: 'cloud-income-1',
        local_id: 'remote-income-1',
        year: 2026,
        month: 4,
        amount_snapshot: 5000,
        updated_at: '2026-05-10T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: 'cloud-income-2',
        local_id: 'remote-income-2',
        year: 2026,
        month: 4,
        amount_snapshot: 5100,
        updated_at: '2026-05-12T00:00:00.000Z',
        deleted_at: null,
      },
    )
    remoteState.savings_snapshots.push(
      {
        id: 'cloud-savings-1',
        local_id: 'remote-savings-1',
        year: 2026,
        month: 4,
        rate_snapshot: 0.2,
        updated_at: '2026-05-10T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: 'cloud-savings-2',
        local_id: 'remote-savings-2',
        year: 2026,
        month: 4,
        rate_snapshot: 0.21,
        updated_at: '2026-05-12T00:00:00.000Z',
        deleted_at: null,
      },
    )
    remoteState.fixed_expense_snapshots.push(
      {
        id: 'cloud-fixed-snapshot-1',
        local_id: 'remote-fixed-snapshot-1',
        fixed_expense_id: 'cloud-fixed-11',
        year: 2026,
        month: 4,
        name_snapshot: 'Rent',
        amount_snapshot: 1200,
        updated_at: '2026-05-10T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: 'cloud-fixed-snapshot-2',
        local_id: 'remote-fixed-snapshot-2',
        fixed_expense_id: 'cloud-fixed-11',
        year: 2026,
        month: 4,
        name_snapshot: 'Rent',
        amount_snapshot: 1300,
        updated_at: '2026-05-12T00:00:00.000Z',
        deleted_at: null,
      },
    )

    await pullFromSupabase('user-1')

    const activeIncomeSnapshots = localState.incomeSnapshots.filter((row) => row.deletedAt == null)
    const activeSavingsSnapshots = localState.savingsSnapshots.filter((row) => row.deletedAt == null)
    const activeFixedSnapshots = localState.fixedExpenseSnapshots.filter(
      (row) => row.deletedAt == null,
    )

    expect(activeIncomeSnapshots).toHaveLength(1)
    expect(activeIncomeSnapshots[0].amountSnapshot).toBe(5100)
    expect(localState.incomeSnapshots.filter((row) => row.year === 2026 && row.month === 4)).toHaveLength(2)

    expect(activeSavingsSnapshots).toHaveLength(1)
    expect(activeSavingsSnapshots[0].rateSnapshot).toBe(0.21)
    expect(localState.savingsSnapshots.filter((row) => row.year === 2026 && row.month === 4)).toHaveLength(2)

    expect(activeFixedSnapshots).toHaveLength(1)
    expect(activeFixedSnapshots[0].amountSnapshot).toBe(1300)
    expect(
      localState.fixedExpenseSnapshots.filter(
        (row) => row.fixedExpenseId === 11 && row.year === 2026 && row.month === 4,
      ),
    ).toHaveLength(2)
  })

  it('does not rewrite preferred snapshot rows when incoming data is unchanged', async () => {
    localState.fixedExpenses.push({
      id: 11,
      localId: 'fixed-local-11',
      cloudId: 'cloud-fixed-11',
      name: 'Rent',
      amount: 1200,
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })
    localState.fixedExpenseSnapshots.push({
      id: 5,
      localId: 'fixed-snapshot-5',
      cloudId: 'cloud-fixed-snapshot-5',
      fixedExpenseId: 11,
      year: 2026,
      month: 4,
      nameSnapshot: 'Rent',
      amountSnapshot: 1200,
      createdAt: '2026-05-12T00:00:00.000Z',
      updatedAt: '2026-05-12T00:00:00.000Z',
      deletedAt: null,
    })

    remoteState.fixed_expenses.push({
      id: 'cloud-fixed-11',
      local_id: 'fixed-local-11',
      name: 'Rent',
      amount: 1200,
      updated_at: '2026-05-01T00:00:00.000Z',
      deleted_at: null,
    })
    remoteState.fixed_expense_snapshots.push({
      id: 'cloud-fixed-snapshot-5',
      local_id: 'fixed-snapshot-5',
      fixed_expense_id: 'cloud-fixed-11',
      year: 2026,
      month: 4,
      name_snapshot: 'Rent',
      amount_snapshot: 1200,
      created_at: '2026-05-12T00:00:00.000Z',
      updated_at: '2026-05-12T00:00:00.000Z',
      deleted_at: null,
    })

    await pullFromSupabase('user-1')

    const fixedSnapshotPutCalls = bulkWriteCalls.bulkPut.filter(
      (call) => call.table === 'fixedExpenseSnapshots',
    )
    expect(fixedSnapshotPutCalls).toHaveLength(0)
  })

  it('repairs fixed snapshot identity splits introduced by another device during pull', async () => {
    localState.fixedExpenses.push({
      id: 11,
      localId: 'fixed-local-11',
      cloudId: 'cloud-fixed-11',
      name: 'Mortgage',
      amount: 1200,
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })
    localState.fixedExpenseSnapshots.push({
      id: 1,
      localId: 'mortgage-apr',
      fixedExpenseId: 100,
      year: 2026,
      month: 4,
      nameSnapshot: 'Mortgage',
      amountSnapshot: 1200,
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: null,
    })

    remoteState.fixed_expense_snapshots.push({
      id: 'cloud-fixed-snapshot-may',
      local_id: 'remote-mortgage-may',
      fixed_expense_id: 'cloud-fixed-11',
      year: 2026,
      month: 5,
      name_snapshot: 'Mortgage',
      amount_snapshot: 1200.0000000001,
      updated_at: '2026-05-12T00:00:00.000Z',
      deleted_at: null,
    })

    await pullFromSupabase('user-1')

    const activeMortgageRows = localState.fixedExpenseSnapshots.filter(
      (row) => row.nameSnapshot === 'Mortgage' && row.deletedAt == null,
    )

    expect(activeMortgageRows).toHaveLength(2)
    expect(activeMortgageRows.every((row) => row.fixedExpenseId === 100)).toBe(true)
    expect(activeMortgageRows.find((row) => row.month === 5)?.syncStatus).toBe('pending')
  })
})

describe('verifySyncIntegrity', () => {
  beforeEach(() => {
    resetArrayState(localState)
    resetArrayState(remoteState)
  })

  it('warns about broken visible relationships and duplicate active normalized names', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    localState.categories.push(
      {
        id: 1,
        localId: 'cat-1',
        cloudId: 'cloud-cat-1',
        name: 'Food',
        normalizedName: 'food',
        updatedAt: '2026-05-01T00:00:00.000Z',
        deletedAt: null,
      },
      {
        id: 2,
        localId: 'cat-2',
        cloudId: 'cloud-cat-2',
        name: ' FOOD ',
        normalizedName: 'food',
        updatedAt: '2026-05-02T00:00:00.000Z',
        deletedAt: null,
      },
    )
    localState.payees.push({
      id: 1,
      localId: 'payee-1',
      cloudId: 'cloud-payee-1',
      name: 'Cafe',
      normalizedName: 'cafe',
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: '2026-05-03T00:00:00.000Z',
    })
    localState.expenses.push(
      {
        id: 1,
        localId: 'expense-1',
        cloudId: 'cloud-expense-1',
        date: '2026-05-04',
        amount: 10,
        categoryId: 99,
        payeeId: 1,
        updatedAt: '2026-05-04T00:00:00.000Z',
        deletedAt: null,
      },
      {
        id: 2,
        localId: 'expense-2',
        cloudId: 'cloud-expense-2',
        date: '2026-05-05',
        amount: 20,
        categoryId: 99,
        payeeId: 1,
        updatedAt: '2026-05-05T00:00:00.000Z',
        deletedAt: '2026-05-05T00:00:00.000Z',
      },
    )

    localState.expenseSplits.push({
      id: 100,
      localId: 'split-100',
      cloudId: 'cloud-split-100',
      date: '2026-05-04',
      amount: 10,
      updatedAt: '2026-05-01T00:00:00.000Z',
      deletedAt: '2026-05-02T00:00:00.000Z',
    })
    localState.expenses[0].splitId = 100

    await verifySyncIntegrity()

    const joinedWarnings = warnSpy.mock.calls.flat().join(' ')
    expect(joinedWarnings).toContain('references missing categoryId')
    expect(joinedWarnings).toContain('references missing payeeId')
    expect(joinedWarnings).toContain('references tombstoned splitId')
    expect(joinedWarnings).toContain('duplicate active category normalizedName')

    warnSpy.mockRestore()
  })

  it('merges remote tags and expense tag joins onto local expense ids', async () => {
    localState.expenses.push({
      id: 1,
      localId: 'expense-1',
      cloudId: 'cloud-expense-1',
      date: '2026-05-04',
      amount: 10,
      updatedAt: '2026-05-04T00:00:00.000Z',
      deletedAt: null,
    })

    remoteState.tags.push({
      id: 'cloud-tag-1',
      local_id: 'tag-1',
      name: 'Work',
      normalized_name: 'work',
      is_archived: false,
      updated_at: '2026-05-10T00:00:00.000Z',
      deleted_at: null,
    })
    remoteState.expense_tags.push({
      id: 'cloud-expense-tag-1',
      local_id: 'expense-tag-1',
      expense_id: 'cloud-expense-1',
      tag_id: 'cloud-tag-1',
      updated_at: '2026-05-10T00:00:00.000Z',
      deleted_at: null,
    })

    await pullFromSupabase('user-1')

    expect(localState.tags).toEqual([
      expect.objectContaining({
        name: 'Work',
        normalizedName: 'work',
        cloudId: 'cloud-tag-1',
      }),
    ])
    expect(localState.expenseTags).toEqual([
      expect.objectContaining({
        expenseId: 1,
        tagId: 1,
        cloudId: 'cloud-expense-tag-1',
      }),
    ])
  })
})
