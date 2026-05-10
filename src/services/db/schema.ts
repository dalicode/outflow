import Dexie, { type Table } from 'dexie'
import type {
  Category,
  CategoryMergeHistory,
  Expense,
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

interface Setting {
  key: string
  value: unknown
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
        // Migrate expense category/payee strings to IDs
        const expenses = await tx.table('expenses').toArray()
        const categories = await tx.table('categories').toArray()
        const payees = await tx.table('payees').toArray()
        const catByName = new Map(categories.map((c: Category) => [c.name.toLowerCase(), c.id]))
        const payeeByName = new Map(payees.map((p: Payee) => [p.name.toLowerCase(), p.id]))

        for (const exp of expenses) {
          const updates: Partial<Expense> = {}
          if (!exp.categoryId && (exp as Record<string, unknown>).category) {
            const catId = catByName.get(
              String((exp as Record<string, unknown>).category).toLowerCase(),
            )
            if (catId) updates.categoryId = catId
          }
          if (!exp.payeeId && (exp as Record<string, unknown>).payee) {
            const payeeId = payeeByName.get(
              String((exp as Record<string, unknown>).payee).toLowerCase(),
            )
            if (payeeId) updates.payeeId = payeeId
          }
          // Convert schedule.category string to categoryId
          const schedules = await tx.table('schedules').toArray()
          for (const s of schedules) {
            if (
              (s as Record<string, unknown>).category &&
              !(s as Record<string, unknown>).categoryId
            ) {
              const catId = catByName.get(
                String((s as Record<string, unknown>).category).toLowerCase(),
              )
              if (catId) {
                await tx.table('schedules').update(s.id, { categoryId: catId })
              }
            }
          }
          if (Object.keys(updates).length > 0) {
            await tx.table('expenses').update(exp.id, updates)
          }
        }
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
