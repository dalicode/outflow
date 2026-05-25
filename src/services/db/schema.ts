import Dexie, { type Table } from 'dexie'
import type {
  Expense,
  ExpenseTag,
  ExpenseSplit,
  Category,
  CategoryMergeHistory,
  FixedExpense,
  FixedExpenseSnapshot,
  IncomeSnapshot,
  Payee,
  PayeeMergeHistory,
  SavingsSnapshot,
  Schedule,
  SyncedSettingRow,
  Tag,
  SyncQueueItem,
} from '../../types'
import { buildDefaultCategories, buildDefaultPayees } from '../defaults'
import { migrateV10CategoryPayeeIds } from './migrations'
import { createSyncMetadata, normalizeNameForSync } from '../../utils/syncMetadata'

type Setting = SyncedSettingRow

type MigrationTx = {
  table: (name: string) => {
    toArray: () => Promise<Array<Record<string, unknown>>>
    update: (id: number | string, changes: Record<string, unknown>) => Promise<number>
  }
}

export async function migrateV18SyncMetadata(tx: MigrationTx): Promise<void> {
  const now = new Date().toISOString()

  const categories = (await tx.table('categories').toArray()) as unknown as Category[]
  const payees = (await tx.table('payees').toArray()) as unknown as Payee[]
  const categoryById = new Map<number, Category>()
  const payeeById = new Map<number, Payee>()

  for (const row of categories) {
    if (typeof row.id === 'number') {
      categoryById.set(row.id, row)
    }
  }
  for (const row of payees) {
    if (typeof row.id === 'number') {
      payeeById.set(row.id, row)
    }
  }

  const syncTables = [
    'expenses',
    'categories',
    'payees',
    'fixedExpenses',
    'fixedExpenseSnapshots',
    'incomeSnapshots',
    'savingsSnapshots',
    'schedules',
    'categoryMergeHistory',
    'payeeMergeHistory',
  ] as const

  for (const tableName of syncTables) {
    const rows = (await tx.table(tableName).toArray()) as Array<Record<string, unknown>>
    for (const row of rows) {
      const metadata = createSyncMetadata(now)
      const updates: Record<string, unknown> = {
        localId:
          typeof row.localId === 'string' && row.localId.length > 0
            ? row.localId
            : metadata.localId,
        cloudId: typeof row.cloudId === 'string' && row.cloudId.length > 0 ? row.cloudId : null,
        createdAt:
          typeof row.createdAt === 'string' && row.createdAt.length > 0 ? row.createdAt : now,
        updatedAt:
          typeof row.updatedAt === 'string' && row.updatedAt.length > 0 ? row.updatedAt : now,
        deletedAt:
          typeof row.deletedAt === 'string' && row.deletedAt.length > 0 ? row.deletedAt : null,
        syncStatus:
          row.syncStatus === 'pending' || row.syncStatus === 'synced' || row.syncStatus === 'failed'
            ? row.syncStatus
            : 'pending',
        lastSyncedAt:
          typeof row.lastSyncedAt === 'string' && row.lastSyncedAt.length > 0
            ? row.lastSyncedAt
            : null,
        syncError:
          typeof row.syncError === 'string' && row.syncError.length > 0 ? row.syncError : null,
        deviceId:
          typeof row.deviceId === 'string' && row.deviceId.length > 0
            ? row.deviceId
            : metadata.deviceId,
      }

      if (tableName === 'categories' && typeof row.name === 'string') {
        updates.normalizedName = normalizeNameForSync(row.name)
      }

      if (tableName === 'payees' && typeof row.name === 'string') {
        updates.normalizedName = normalizeNameForSync(row.name)
      }

      if (tableName === 'expenses') {
        const expense = row as unknown as Expense
        if (
          (!expense.categoryNameSnapshot || expense.categoryNameSnapshot.length === 0) &&
          typeof expense.categoryId === 'number'
        ) {
          updates.categoryNameSnapshot = categoryById.get(expense.categoryId)?.name ?? null
        }
        if (
          (!expense.payeeNameSnapshot || expense.payeeNameSnapshot.length === 0) &&
          typeof expense.payeeId === 'number'
        ) {
          updates.payeeNameSnapshot = payeeById.get(expense.payeeId)?.name ?? null
        }
      }

      await tx.table(tableName).update(row.id as number, updates)
    }
  }

  const settings = await tx.table('settings').toArray()
  for (const row of settings) {
    const metadata = createSyncMetadata(now)
    await tx.table('settings').update(row.key as string, {
      localId:
        typeof row.localId === 'string' && row.localId.length > 0 ? row.localId : metadata.localId,
      cloudId: typeof row.cloudId === 'string' && row.cloudId.length > 0 ? row.cloudId : null,
      createdAt:
        typeof row.createdAt === 'string' && row.createdAt.length > 0 ? row.createdAt : now,
      updatedAt:
        typeof row.updatedAt === 'string' && row.updatedAt.length > 0 ? row.updatedAt : now,
      deletedAt:
        typeof row.deletedAt === 'string' && row.deletedAt.length > 0 ? row.deletedAt : null,
      syncStatus:
        row.syncStatus === 'pending' || row.syncStatus === 'synced' || row.syncStatus === 'failed'
          ? row.syncStatus
          : 'pending',
      lastSyncedAt:
        typeof row.lastSyncedAt === 'string' && row.lastSyncedAt.length > 0
          ? row.lastSyncedAt
          : null,
      syncError:
        typeof row.syncError === 'string' && row.syncError.length > 0 ? row.syncError : null,
      deviceId:
        typeof row.deviceId === 'string' && row.deviceId.length > 0
          ? row.deviceId
          : metadata.deviceId,
    })
  }
}

export async function migrateV19StripArchivedAt(tx: MigrationTx): Promise<void> {
  const tables = ['categories', 'payees', 'fixedExpenses'] as const

  for (const tableName of tables) {
    const rows = await tx.table(tableName).toArray()
    for (const row of rows) {
      if (!Object.hasOwn(row, 'archivedAt')) continue
      await tx.table(tableName).update(row.id as number, {
        archivedAt: undefined,
      })
    }
  }
}

class OutflowDB extends Dexie {
  expenses!: Table<Expense, number>
  categories!: Table<Category, number>
  payees!: Table<Payee, number>
  fixedExpenses!: Table<FixedExpense, number>
  fixedExpenseSnapshots!: Table<FixedExpenseSnapshot, number>
  incomeSnapshots!: Table<IncomeSnapshot, number>
  savingsSnapshots!: Table<SavingsSnapshot, number>
  schedules!: Table<Schedule, number>
  settings!: Table<Setting, string>
  syncQueue!: Table<SyncQueueItem, number>
  categoryMergeHistory!: Table<CategoryMergeHistory, number>
  payeeMergeHistory!: Table<PayeeMergeHistory, number>
  expenseSplits!: Table<ExpenseSplit, number>
  tags!: Table<Tag, number>
  expenseTags!: Table<ExpenseTag, number>

  constructor() {
    super('Outflow')

    this.version(1).stores({ expenses: '++id, date, category' })
    this.version(2).stores({
      expenses: '++id, date, category',
      settings: 'key',
      fixedExpenses: '++id',
    })
    this.version(3).stores({
      expenses: '++id, date, category, categoryId',
      settings: 'key',
      fixedExpenses: '++id',
      categories: '++id, name',
    })
    this.version(4).stores({
      expenses: '++id, date, category, categoryId',
      settings: 'key',
      fixedExpenses: '++id',
      categories: '++id, name',
      syncQueue: '++id, table, timestamp',
    })
    this.version(5).stores({
      expenses: '++id, date, category, categoryId',
      settings: 'key',
      fixedExpenses: '++id',
      categories: '++id, name',
      syncQueue: '++id, table, timestamp',
      fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
    })
    this.version(6).stores({
      expenses: '++id, date, category, categoryId',
      settings: 'key',
      fixedExpenses: '++id',
      categories: '++id, name',
      syncQueue: '++id, table, timestamp',
      fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
      schedules: '++id, type, effectiveYear, effectiveMonth, isActive, targetId',
    })
    this.version(7).stores({
      expenses: '++id, date, category, categoryId',
      settings: 'key',
      fixedExpenses: '++id',
      categories: '++id, name',
      syncQueue: '++id, table, timestamp',
      fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
      schedules: '++id, type, effectiveYear, effectiveMonth, isActive, targetId',
      incomeSnapshots: '++id, [year+month], year, month',
      savingsSnapshots: '++id, [year+month], year, month',
    })
    this.version(8)
      .stores({
        expenses: '++id, date, category, categoryId',
        settings: 'key',
        fixedExpenses: '++id',
        categories: '++id, name',
        syncQueue: '++id, table, timestamp',
        fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
        schedules: '++id, type, effectiveYear, effectiveMonth, isActive, targetId',
        incomeSnapshots: '++id, [year+month], year, month',
        savingsSnapshots: '++id, [year+month], year, month',
      })
      .upgrade(async (tx) => {
        const rows = await tx.table('fixedExpenses').toArray()
        const now = new Date().toISOString()
        for (const row of rows) {
          await tx.table('fixedExpenses').update(row.id, {
            updatedAt: row.updatedAt || now,
          })
        }
      })

    this.version(9).stores({
      expenses: '++id, date, category, categoryId, payeeId',
      settings: 'key',
      fixedExpenses: '++id',
      categories: '++id, name',
      payees: '++id, name',
      syncQueue: '++id, table, timestamp',
      fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
      schedules: '++id, type, effectiveYear, effectiveMonth, isActive, targetId',
      incomeSnapshots: '++id, [year+month], year, month',
      savingsSnapshots: '++id, [year+month], year, month',
    })

    this.version(10)
      .stores({
        expenses: '++id, date, categoryId, payeeId',
        settings: 'key',
        fixedExpenses: '++id',
        categories: '++id, name',
        payees: '++id, name',
        syncQueue: '++id, table, timestamp',
        fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
        schedules: '++id, type, effectiveYear, effectiveMonth, isActive, targetId',
        incomeSnapshots: '++id, [year+month], year, month',
        savingsSnapshots: '++id, [year+month], year, month',
      })
      .upgrade(async (tx) => {
        await migrateV10CategoryPayeeIds(tx)
      })

    this.version(11).stores({
      expenses: '++id, date, categoryId, payeeId',
      settings: 'key',
      fixedExpenses: '++id',
      categories: '++id, name',
      payees: '++id, name',
      syncQueue: '++id, table, timestamp',
      fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
      schedules: '++id, type, effectiveYear, effectiveMonth, isActive, targetId, payeeId',
      incomeSnapshots: '++id, [year+month], year, month',
      savingsSnapshots: '++id, [year+month], year, month',
    })

    this.version(12).stores({
      expenses: '++id, date, categoryId, payeeId',
      settings: 'key',
      fixedExpenses: '++id',
      categories: '++id, name',
      payees: '++id, name',
      syncQueue: '++id, table, timestamp',
      fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
      schedules: '++id, type, effectiveYear, effectiveMonth, isActive, targetId, payeeId',
      incomeSnapshots: '++id, [year+month], year, month',
      savingsSnapshots: '++id, [year+month], year, month',
    })

    this.version(13).stores({
      expenses: '++id, date, categoryId, payeeId',
      settings: 'key',
      fixedExpenses: '++id',
      categories: '++id, name',
      payees: '++id, name',
      syncQueue: '++id, table, timestamp',
      fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
      schedules: '++id, type, effectiveYear, effectiveMonth, isActive, targetId, payeeId',
      incomeSnapshots: '++id, [year+month], year, month',
      savingsSnapshots: '++id, [year+month], year, month',
      categoryMergeHistory: '++id, sourceCategoryId, targetCategoryId',
      payeeMergeHistory: '++id, sourcePayeeId, targetPayeeId',
    })

    this.version(14).stores({
      expenses: '++id, date, categoryId, payeeId',
      settings: 'key',
      fixedExpenses: '++id',
      categories: '++id, name',
      payees: '++id, name',
      syncQueue: '++id, table, timestamp',
      fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
      schedules: '++id, type, effectiveYear, effectiveMonth, isActive, targetId, payeeId',
      incomeSnapshots: '++id, [year+month], year, month',
      savingsSnapshots: '++id, [year+month], year, month',
      categoryMergeHistory: '++id, sourceCategoryId, targetCategoryId',
      payeeMergeHistory: '++id, sourcePayeeId, targetPayeeId',
    })

    this.version(15)
      .stores({
        expenses: '++id, date, categoryId, payeeId',
        settings: 'key',
        fixedExpenses: '++id',
        categories: '++id, name',
        payees: '++id, name',
        syncQueue: '++id, table, timestamp',
        fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
        schedules: '++id, type, effectiveYear, effectiveMonth, isActive, targetId, payeeId',
        incomeSnapshots: '++id, [year+month], year, month',
        savingsSnapshots: '++id, [year+month], year, month',
        categoryMergeHistory: '++id, sourceCategoryId, targetCategoryId',
        payeeMergeHistory: '++id, sourcePayeeId, targetPayeeId',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString()
        const tables = [
          'expenses',
          'categories',
          'payees',
          'fixedExpenses',
          'fixedExpenseSnapshots',
          'incomeSnapshots',
          'savingsSnapshots',
          'schedules',
          'categoryMergeHistory',
          'payeeMergeHistory',
        ] as const
        for (const tableName of tables) {
          const rows = (await tx.table(tableName).toArray()) as Array<Record<string, unknown>>
          for (const row of rows) {
            const updates: Record<string, unknown> = {}
            if (!row.updatedAt) {
              updates.updatedAt = (row.createdAt as string) || now
            }
            if (Object.keys(updates).length > 0) {
              await tx.table(tableName).update(row.id as number, updates)
            }
          }
        }
      })

    this.version(16).stores({
      expenses: '++id, date, categoryId, payeeId',
      settings: 'key',
      fixedExpenses: '++id',
      categories: '++id, name',
      payees: '++id, name',
      syncQueue: '++id, table, timestamp',
      fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
      schedules:
        '++id, type, effectiveYear, effectiveMonth, isActive, targetId, categoryId, payeeId',
      incomeSnapshots: '++id, [year+month], year, month',
      savingsSnapshots: '++id, [year+month], year, month',
      categoryMergeHistory: '++id, sourceCategoryId, targetCategoryId',
      payeeMergeHistory: '++id, sourcePayeeId, targetPayeeId',
    })

    this.version(17)
      .stores({
        expenses: '++id, date, categoryId, payeeId',
        settings: 'key',
        fixedExpenses: '++id',
        categories: '++id, name',
        payees: '++id, name',
        syncQueue: '++id, table, timestamp',
        fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
        schedules:
          '++id, type, effectiveYear, effectiveMonth, isActive, targetId, categoryId, payeeId',
        incomeSnapshots: '++id, [year+month], year, month',
        savingsSnapshots: '++id, [year+month], year, month',
        categoryMergeHistory: '++id, sourceCategoryId, targetCategoryId',
        payeeMergeHistory: '++id, sourcePayeeId, targetPayeeId',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString()
        const settings = (await tx.table('settings').toArray()) as Setting[]
        for (const row of settings) {
          if (!row.updatedAt) {
            await tx.table('settings').update(row.key, { updatedAt: now })
          }
        }
      })

    this.version(18)
      .stores({
        expenses:
          '++id, date, categoryId, payeeId, localId, cloudId, syncStatus, deletedAt, [categoryId+date]',
        settings: 'key, updatedAt, localId, cloudId, syncStatus, deletedAt',
        fixedExpenses: '++id, localId, cloudId, syncStatus, deletedAt',
        categories: '++id, name, normalizedName, localId, cloudId, syncStatus, deletedAt',
        payees: '++id, name, normalizedName, localId, cloudId, syncStatus, deletedAt',
        syncQueue: '++id, table, timestamp',
        fixedExpenseSnapshots:
          '++id, [fixedExpenseId+year+month], year, month, localId, cloudId, syncStatus, deletedAt',
        schedules:
          '++id, type, effectiveYear, effectiveMonth, isActive, targetId, categoryId, payeeId, localId, cloudId, syncStatus, deletedAt',
        incomeSnapshots: '++id, [year+month], year, month, localId, cloudId, syncStatus, deletedAt',
        savingsSnapshots:
          '++id, [year+month], year, month, localId, cloudId, syncStatus, deletedAt',
        categoryMergeHistory:
          '++id, sourceCategoryId, targetCategoryId, localId, cloudId, syncStatus, deletedAt',
        payeeMergeHistory:
          '++id, sourcePayeeId, targetPayeeId, localId, cloudId, syncStatus, deletedAt',
      })
      .upgrade(async (tx) => {
        await migrateV18SyncMetadata(tx)
      })

    this.version(19)
      .stores({
        expenses:
          '++id, date, categoryId, payeeId, localId, cloudId, syncStatus, deletedAt, [categoryId+date]',
        settings: 'key, updatedAt, localId, cloudId, syncStatus, deletedAt',
        fixedExpenses: '++id, localId, cloudId, syncStatus, deletedAt',
        categories: '++id, name, normalizedName, localId, cloudId, syncStatus, deletedAt',
        payees: '++id, name, normalizedName, localId, cloudId, syncStatus, deletedAt',
        syncQueue: '++id, table, timestamp',
        fixedExpenseSnapshots:
          '++id, [fixedExpenseId+year+month], year, month, localId, cloudId, syncStatus, deletedAt',
        schedules:
          '++id, type, effectiveYear, effectiveMonth, isActive, targetId, categoryId, payeeId, localId, cloudId, syncStatus, deletedAt',
        incomeSnapshots: '++id, [year+month], year, month, localId, cloudId, syncStatus, deletedAt',
        savingsSnapshots:
          '++id, [year+month], year, month, localId, cloudId, syncStatus, deletedAt',
        categoryMergeHistory:
          '++id, sourceCategoryId, targetCategoryId, localId, cloudId, syncStatus, deletedAt',
        payeeMergeHistory:
          '++id, sourcePayeeId, targetPayeeId, localId, cloudId, syncStatus, deletedAt',
      })
      .upgrade(async (tx) => {
        await migrateV19StripArchivedAt(tx)
      })

    this.version(20).stores({
      expenses:
        '++id, date, splitId, categoryId, payeeId, localId, cloudId, syncStatus, deletedAt, [categoryId+date]',
      expenseSplits: '++id, date, payeeId, localId, cloudId, syncStatus, deletedAt',
      settings: 'key, updatedAt, localId, cloudId, syncStatus, deletedAt',
      fixedExpenses: '++id, localId, cloudId, syncStatus, deletedAt',
      categories: '++id, name, normalizedName, localId, cloudId, syncStatus, deletedAt',
      payees: '++id, name, normalizedName, localId, cloudId, syncStatus, deletedAt',
      syncQueue: '++id, table, timestamp',
      fixedExpenseSnapshots:
        '++id, [fixedExpenseId+year+month], year, month, localId, cloudId, syncStatus, deletedAt',
      schedules:
        '++id, type, effectiveYear, effectiveMonth, isActive, targetId, categoryId, payeeId, localId, cloudId, syncStatus, deletedAt',
      incomeSnapshots: '++id, [year+month], year, month, localId, cloudId, syncStatus, deletedAt',
      savingsSnapshots:
        '++id, [year+month], year, month, localId, cloudId, syncStatus, deletedAt',
      categoryMergeHistory:
        '++id, sourceCategoryId, targetCategoryId, localId, cloudId, syncStatus, deletedAt',
      payeeMergeHistory:
        '++id, sourcePayeeId, targetPayeeId, localId, cloudId, syncStatus, deletedAt',
    })
    this.version(21).stores({
      expenses:
        '++id, date, splitId, categoryId, payeeId, localId, cloudId, syncStatus, deletedAt, [categoryId+date]',
      expenseSplits: '++id, date, payeeId, localId, cloudId, syncStatus, deletedAt',
      tags: '++id, name, normalizedName, localId, cloudId, syncStatus, deletedAt',
      expenseTags: '++id, expenseId, tagId, localId, cloudId, syncStatus, deletedAt, [expenseId+tagId]',
      settings: 'key, updatedAt, localId, cloudId, syncStatus, deletedAt',
      fixedExpenses: '++id, localId, cloudId, syncStatus, deletedAt',
      categories: '++id, name, normalizedName, localId, cloudId, syncStatus, deletedAt',
      payees: '++id, name, normalizedName, localId, cloudId, syncStatus, deletedAt',
      syncQueue: '++id, table, timestamp',
      fixedExpenseSnapshots:
        '++id, [fixedExpenseId+year+month], year, month, localId, cloudId, syncStatus, deletedAt',
      schedules:
        '++id, type, effectiveYear, effectiveMonth, isActive, targetId, categoryId, payeeId, localId, cloudId, syncStatus, deletedAt',
      incomeSnapshots: '++id, [year+month], year, month, localId, cloudId, syncStatus, deletedAt',
      savingsSnapshots:
        '++id, [year+month], year, month, localId, cloudId, syncStatus, deletedAt',
      categoryMergeHistory:
        '++id, sourceCategoryId, targetCategoryId, localId, cloudId, syncStatus, deletedAt',
      payeeMergeHistory:
        '++id, sourcePayeeId, targetPayeeId, localId, cloudId, syncStatus, deletedAt',
    })

    this.on('populate', () => {
      const now = new Date().toISOString()
      this.table('categories').bulkAdd(buildDefaultCategories(now))
      this.table('payees').bulkAdd(buildDefaultPayees(now))
    })

    this.on('versionchange', (event) => {
      console.warn(
        '[db] versionchange detected, closing existing connection',
        event.oldVersion,
        '->',
        event.newVersion,
      )
      this.close()
    })

    this.on('blocked', (event) => {
      console.warn(
        '[db] open blocked during upgrade. Another tab may still hold an old connection.',
        event.oldVersion,
        '->',
        event.newVersion,
      )
    })
  }
}

const db = new OutflowDB()

export default db
export { db, OutflowDB }
export type { Setting }
