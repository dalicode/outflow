import { describe, expect, it, vi } from 'vitest'
import { migrateV10CategoryPayeeIds } from '../services/db/migrations'
import { migrateV18SyncMetadata, migrateV19StripArchivedAt } from '../services/db/schema'

type Row = Record<string, unknown>

class FakeTable {
  constructor(private rows: Row[]) {}

  async toArray(): Promise<Row[]> {
    return this.rows
  }

  async update(id: number | string, changes: Record<string, unknown>): Promise<number> {
    const row = this.rows.find((r) => r.id === id || r.key === id)
    if (!row) return 0
    for (const [key, value] of Object.entries(changes)) {
      if (typeof value === 'undefined') {
        delete row[key]
        continue
      }
      row[key] = value
    }
    return 1
  }
}

class FakeTx {
  private tables: Record<string, FakeTable>

  constructor(seed: Record<string, Row[]>) {
    this.tables = {
      expenses: new FakeTable(seed.expenses ?? []),
      categories: new FakeTable(seed.categories ?? []),
      payees: new FakeTable(seed.payees ?? []),
      fixedExpenses: new FakeTable(seed.fixedExpenses ?? []),
      fixedExpenseSnapshots: new FakeTable(seed.fixedExpenseSnapshots ?? []),
      incomeSnapshots: new FakeTable(seed.incomeSnapshots ?? []),
      savingsSnapshots: new FakeTable(seed.savingsSnapshots ?? []),
      schedules: new FakeTable(seed.schedules ?? []),
      categoryMergeHistory: new FakeTable(seed.categoryMergeHistory ?? []),
      payeeMergeHistory: new FakeTable(seed.payeeMergeHistory ?? []),
      settings: new FakeTable(seed.settings ?? []),
    }
  }

  table(name: string): FakeTable {
    const table = this.tables[name]
    if (!table) throw new Error(`Unknown table: ${name}`)
    return table
  }
}

describe('migrateV10CategoryPayeeIds', () => {
  it('migrates schedule category when schedules exist and expenses are empty', async () => {
    const tx = new FakeTx({
      expenses: [],
      categories: [{ id: 1, name: 'Food' }],
      payees: [],
      schedules: [{ id: 10, category: 'Food' }],
    })

    await migrateV10CategoryPayeeIds(tx)

    const schedules = await tx.table('schedules').toArray()
    expect(schedules[0].categoryId).toBe(1)
  })

  it('migrates legacy expense category and payee names to ids', async () => {
    const tx = new FakeTx({
      expenses: [{ id: 1, category: 'Food', payee: 'Cafe' }],
      categories: [{ id: 11, name: 'Food' }],
      payees: [{ id: 21, name: 'Cafe' }],
      schedules: [],
    })

    await migrateV10CategoryPayeeIds(tx)

    const expenses = await tx.table('expenses').toArray()
    expect(expenses[0].categoryId).toBe(11)
    expect(expenses[0].payeeId).toBe(21)
  })

  it('does not overwrite existing schedule categoryId', async () => {
    const tx = new FakeTx({
      expenses: [],
      categories: [{ id: 99, name: 'Food' }],
      payees: [],
      schedules: [{ id: 5, category: 'Food', categoryId: 44 }],
    })

    await migrateV10CategoryPayeeIds(tx)

    const schedules = await tx.table('schedules').toArray()
    expect(schedules[0].categoryId).toBe(44)
  })

  it('leaves schedule unchanged when legacy category has no category match', async () => {
    const tx = new FakeTx({
      expenses: [],
      categories: [{ id: 2, name: 'Transport' }],
      payees: [],
      schedules: [{ id: 7, category: 'Food' }],
    })

    await migrateV10CategoryPayeeIds(tx)

    const schedules = await tx.table('schedules').toArray()
    expect(schedules[0].categoryId).toBeUndefined()
  })
})

describe('migrateV18SyncMetadata', () => {
  it('backfills sync metadata and preserves numeric ids/cloudIds', async () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000003')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000004')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000005')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000006')

    const tx = new FakeTx({
      categories: [{ id: 7, name: ' Dining Out  ', cloudId: 'cat-cloud' }],
      payees: [{ id: 9, name: 'Tim Hortons' }],
      expenses: [{ id: 5, date: '2026-05-01', amount: 23, categoryId: 7, payeeId: 9 }],
      fixedExpenses: [{ id: 11, name: 'Rent', amount: 1200 }],
      fixedExpenseSnapshots: [
        { id: 12, fixedExpenseId: 11, year: 2026, month: 5, amountSnapshot: 1200 },
      ],
      incomeSnapshots: [{ id: 13, year: 2026, month: 5, amountSnapshot: 5000 }],
      savingsSnapshots: [{ id: 14, year: 2026, month: 5, rateSnapshot: 20 }],
      schedules: [
        {
          id: 15,
          type: 'income',
          targetId: null,
          effectiveYear: 2026,
          effectiveMonth: 6,
          newValue: 5100,
          isActive: 1,
        },
      ],
      categoryMergeHistory: [
        {
          id: 16,
          sourceCategoryId: 1,
          targetCategoryId: 2,
          affectedExpenseIds: [],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      payeeMergeHistory: [
        {
          id: 17,
          sourcePayeeId: 3,
          targetPayeeId: 4,
          affectedExpenseIds: [],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      settings: [{ key: 'visualTheme', value: 'mint' }],
    })

    await migrateV18SyncMetadata(tx)

    const [category] = await tx.table('categories').toArray()
    const [payee] = await tx.table('payees').toArray()
    const [expense] = await tx.table('expenses').toArray()
    const [setting] = await tx.table('settings').toArray()

    expect(category.id).toBe(7)
    expect(category.cloudId).toBe('cat-cloud')
    expect(category.localId).toBeTruthy()
    expect(category.syncStatus).toBe('pending')
    expect(category.deletedAt).toBeNull()
    expect(category.normalizedName).toBe('dining out')

    expect(payee.id).toBe(9)
    expect(payee.normalizedName).toBe('tim hortons')

    expect(expense.id).toBe(5)
    expect(expense.localId).toBeTruthy()
    expect(expense.categoryNameSnapshot).toBe(' Dining Out  ')
    expect(expense.payeeNameSnapshot).toBe('Tim Hortons')

    expect(setting.key).toBe('visualTheme')
    expect(setting.localId).toBeTruthy()
    expect(setting.syncStatus).toBe('pending')
  })

  it('keeps pre-existing valid metadata and status fields', async () => {
    const tx = new FakeTx({
      categories: [
        {
          id: 1,
          name: 'Groceries',
          localId: 'existing-local-id',
          cloudId: 'existing-cloud-id',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
          deletedAt: null,
          syncStatus: 'synced',
          lastSyncedAt: '2026-01-03T00:00:00.000Z',
          syncError: null,
          deviceId: 'device-a',
        },
      ],
      payees: [],
      expenses: [],
      fixedExpenses: [],
      fixedExpenseSnapshots: [],
      incomeSnapshots: [],
      savingsSnapshots: [],
      schedules: [],
      categoryMergeHistory: [],
      payeeMergeHistory: [],
      settings: [],
    })

    await migrateV18SyncMetadata(tx)

    const [category] = await tx.table('categories').toArray()
    expect(category.localId).toBe('existing-local-id')
    expect(category.cloudId).toBe('existing-cloud-id')
    expect(category.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(category.updatedAt).toBe('2026-01-02T00:00:00.000Z')
    expect(category.syncStatus).toBe('synced')
    expect(category.lastSyncedAt).toBe('2026-01-03T00:00:00.000Z')
    expect(category.deviceId).toBe('device-a')
    expect(category.normalizedName).toBe('groceries')
  })
})

describe('migrateV19StripArchivedAt', () => {
  it('removes archivedAt from categories, payees, and fixed expenses only', async () => {
    const tx = new FakeTx({
      categories: [{ id: 1, name: 'Food', archivedAt: '2026-01-01T00:00:00.000Z' }],
      payees: [{ id: 2, name: 'Cafe', archivedAt: '2026-01-02T00:00:00.000Z' }],
      fixedExpenses: [
        { id: 3, name: 'Rent', amount: 1200, archivedAt: '2026-01-03T00:00:00.000Z' },
      ],
      expenses: [{ id: 4, amount: 20, archivedAt: 'keep-me' }],
    })

    await migrateV19StripArchivedAt(tx)

    const [category] = await tx.table('categories').toArray()
    const [payee] = await tx.table('payees').toArray()
    const [fixedExpense] = await tx.table('fixedExpenses').toArray()
    const [expense] = await tx.table('expenses').toArray()

    expect('archivedAt' in category).toBe(false)
    expect('archivedAt' in payee).toBe(false)
    expect('archivedAt' in fixedExpense).toBe(false)
    expect(expense.archivedAt).toBe('keep-me')
  })
})
