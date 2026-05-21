import Dexie, { type Table } from 'dexie'
import type {
  Category,
  CategoryMergeHistory,
  FixedExpense,
  FixedExpenseSnapshot,
  IncomeSnapshot,
  Payee,
  PayeeMergeHistory,
  SavingsSnapshot,
  Schedule,
  SyncQueueItem,
} from '../../types'
import { buildDefaultCategories, buildDefaultPayees } from '../defaults'
import { migrateV10CategoryPayeeIds } from './migrations'

interface Setting {
  key: string
  value: unknown
  updatedAt?: string
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
            updatedAt: row.archivedAt || now,
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

    this.on('populate', () => {
      const now = new Date().toISOString()
      this.table('categories').bulkAdd(buildDefaultCategories(now))
      this.table('payees').bulkAdd(buildDefaultPayees(now))
    })
  }
}

const db = new OutflowDB()

export default db
export { db, OutflowDB }
export type { Setting }
