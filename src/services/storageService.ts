import Dexie, { type Table } from 'dexie'
import type {
  Expense,
  Category,
  FixedExpense,
  FixedExpenseSnapshot,
  Schedule,
  SyncQueueItem,
} from '../types'

interface Setting {
  key: string
  value: unknown
}

class SpendingTrackerDB extends Dexie {
  expenses!: Table<Expense, number>
  categories!: Table<Category, number>
  fixedExpenses!: Table<FixedExpense, number>
  fixedExpenseSnapshots!: Table<FixedExpenseSnapshot, number>
  schedules!: Table<Schedule, number>
  settings!: Table<Setting, string>
  syncQueue!: Table<SyncQueueItem, number>

  constructor() {
    super('SpendingTracker')

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

    this.on('populate', () => {
      const now = new Date().toISOString()
      this.categories.bulkAdd(
        DEFAULT_CATEGORIES.map((name) => ({ name, createdAt: now, isArchived: false, isDeleted: false }))
      )
    })
  }
}

const db = new SpendingTrackerDB()

const DEFAULT_CATEGORIES = [
  'Entertainment', 'Health', 'Misc', 'Personal Goods',
  'Transportation', 'Groceries', 'Dining',
]

// Write a snapshot for a fixed expense for the current month (idempotent — upsert by compound key)
const snapshotFixed = async (item: FixedExpense) => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-12
  // Only write if no snapshot exists for this item+month yet (first write wins for history)
  const existing = await db.fixedExpenseSnapshots
    .where('[fixedExpenseId+year+month]').equals([item.id as number, year, month]).first()
  if (!existing) {
    await db.fixedExpenseSnapshots.add({
      fixedExpenseId: item.id as number,
      nameSnapshot: item.name,
      amountSnapshot: item.amount,
      year,
      month,
      createdAt: now.toISOString(),
    })
  }
}

// Enqueue a sync operation for the background engine to process
const enqueue = (table: string, operation: SyncQueueItem['operation'], payload: Record<string, unknown>) =>
  db.syncQueue.add({ table, operation, payload, timestamp: Date.now() })

export const StorageService = {
  db,
  // ── Expenses ──────────────────────────────────────────────
  getAll: () => db.expenses.orderBy('date').toArray(),
  add: async (expense: Omit<Expense, 'id'>) => {
    const id = await db.expenses.add(expense as Expense)
    await enqueue('expenses', 'insert', { ...expense, id })
    return id
  },
  update: async (id: number, changes: Partial<Expense>) => {
    await db.expenses.update(id, changes)
    const row = await db.expenses.get(id)
    await enqueue('expenses', 'update', row as unknown as Record<string, unknown>)
  },
  remove: async (id: number) => {
    await db.expenses.delete(id)
    await enqueue('expenses', 'delete', { id })
  },
  removeMany: async (ids: number[]) => {
    await db.transaction('rw', db.expenses, db.syncQueue, async () => {
      await db.expenses.bulkDelete(ids)
      for (const id of ids) {
        await enqueue('expenses', 'delete', { id })
      }
    })
  },

  // ── Settings ──────────────────────────────────────────────
  getSetting: async <T>(key: string, fallback: T | null = null): Promise<T | null> => {
    const row = await db.settings.get(key)
    return row ? (row.value as T) : fallback
  },
  setSetting: async (key: string, value: unknown) => {
    await db.settings.put({ key, value })
    await enqueue('settings', 'upsert', { key, value })
  },

  // ── Fixed Expenses ────────────────────────────────────────
  getFixedExpenses: () => db.fixedExpenses.toArray(),
  // Active fixed expenses only (excludes archived / backfilled entries)
  getActiveFixedExpenses: () =>
    db.fixedExpenses.toArray().then((all) => all.filter((f) => f.isArchived !== true)),
  addFixedExpense: async (item: Omit<FixedExpense, 'id'>) => {
    const id = await db.fixedExpenses.add(item as FixedExpense)
    const row = await db.fixedExpenses.get(id)
    await snapshotFixed(row as FixedExpense)
    await enqueue('fixedExpenses', 'insert', row as unknown as Record<string, unknown>)
    return id
  },
  // Creates an archived fixed-expense definition for historical backfill.
  // Does NOT snapshot the current month — backfill snapshots are written separately.
  addArchivedFixedExpense: async (item: Omit<FixedExpense, 'id'>) => {
    const payload = {
      ...item,
      isArchived: true,
      archivedAt: new Date().toISOString(),
    }
    const id = await db.fixedExpenses.add(payload as FixedExpense)
    const row = await db.fixedExpenses.get(id)
    await enqueue('fixedExpenses', 'insert', row as unknown as Record<string, unknown>)
    return id
  },
  updateFixedExpense: async (id: number, changes: Partial<FixedExpense>) => {
    await db.fixedExpenses.update(id, changes)
    const row = await db.fixedExpenses.get(id)
    await snapshotFixed(row as FixedExpense)
    await enqueue('fixedExpenses', 'update', row as unknown as Record<string, unknown>)
  },
  removeFixedExpense: async (id: number) => {
    // Snapshot before deleting so history is preserved
    const row = await db.fixedExpenses.get(id)
    if (row) await snapshotFixed(row)
    await db.fixedExpenses.delete(id)
    await enqueue('fixedExpenses', 'delete', { id })
  },

  // ── Fixed Expense Snapshots ───────────────────────────────
  // Returns all snapshots for a given year
  getSnapshotsForYear: (year: number) => db.fixedExpenseSnapshots.where('year').equals(year).toArray(),
  bulkUpsertSnapshots: (rows: FixedExpenseSnapshot[]) => db.fixedExpenseSnapshots.bulkPut(rows),
  deleteSnapshotsForYear: (year: number) => db.fixedExpenseSnapshots.where('year').equals(year).delete(),

  // ── Scheduled Changes ─────────────────────────────────────
  getSchedules: () => db.schedules.toArray(),
  getActiveSchedules: () => db.schedules.where('isActive').equals(1 as any).toArray(),
  addSchedule: async (schedule: Omit<Schedule, 'id' | 'isActive' | 'createdAt'>) => {
    const id = await db.schedules.add({
      ...schedule,
      isActive: true,
      createdAt: new Date().toISOString(),
    } as Schedule)
    const row = await db.schedules.get(id)
    await enqueue('schedules', 'insert', row as unknown as Record<string, unknown>)
    return id
  },
  updateSchedule: async (id: number, changes: Partial<Schedule>) => {
    await db.schedules.update(id, changes)
    const row = await db.schedules.get(id)
    await enqueue('schedules', 'update', row as unknown as Record<string, unknown>)
  },
  deleteSchedule: async (id: number) => {
    await db.schedules.delete(id)
    await enqueue('schedules', 'delete', { id })
  },

  // ── Categories ────────────────────────────────────────────
  getCategories: () => db.categories.toArray(),
  addCategory: async (name: string) => {
    const id = await db.categories.add({
      name: name.trim(),
      createdAt: new Date().toISOString(),
      isArchived: false,
      isDeleted: false,
    } as Category)
    const row = await db.categories.get(id)
    await enqueue('categories', 'insert', row as unknown as Record<string, unknown>)
    return id
  },
  updateCategory: async (id: number, changes: Partial<Category>) => {
    await db.categories.update(id, changes)
    const row = await db.categories.get(id)
    await enqueue('categories', 'update', row as unknown as Record<string, unknown>)
  },
  deleteCategory: async (id: number) => {
    await db.categories.update(id, { isDeleted: true })
    const row = await db.categories.get(id)
    await enqueue('categories', 'update', row as unknown as Record<string, unknown>)
  },

  // ── Sync Queue (used by SyncEngine) ──────────────────────
  getSyncQueue: () => db.syncQueue.orderBy('timestamp').toArray(),
  removeSyncQueueItem: (id: number) => db.syncQueue.delete(id),
  clearSyncQueue: () => db.syncQueue.clear(),

  // ── Danger zone ───────────────────────────────────────────
  clearAllData: async () => {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) {
        await table.clear()
      }
    })
  },

  // ── Bulk upsert (used by incoming sync merge) ─────────────
  bulkUpsertExpenses: (rows: Expense[]) => db.expenses.bulkPut(rows),
  bulkUpsertCategories: (rows: Category[]) => db.categories.bulkPut(rows),
  bulkUpsertFixedExpenses: (rows: FixedExpense[]) => db.fixedExpenses.bulkPut(rows),

  // ── Full data backup (JSON export / import) ────────────────
  exportAllData: async () => ({
    expenses: await db.expenses.toArray(),
    categories: await db.categories.toArray(),
    fixedExpenses: await db.fixedExpenses.toArray(),
    fixedExpenseSnapshots: await db.fixedExpenseSnapshots.toArray(),
    schedules: await db.schedules.toArray(),
    settings: await db.settings.toArray(),
    syncQueue: await db.syncQueue.toArray(),
  }),

  importAllData: async (data: Record<string, unknown>, { replace = false } = {}) => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data')
    }

    if (replace) {
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
          await table.clear()
        }
      })
    }

    if (data.expenses) await db.expenses.bulkPut(data.expenses as Expense[])
    if (data.categories) await db.categories.bulkPut(data.categories as Category[])
    if (data.fixedExpenses) await db.fixedExpenses.bulkPut(data.fixedExpenses as FixedExpense[])
    if (data.fixedExpenseSnapshots) await db.fixedExpenseSnapshots.bulkPut(data.fixedExpenseSnapshots as FixedExpenseSnapshot[])
    if (data.schedules) await db.schedules.bulkPut(data.schedules as Schedule[])
    if (data.settings) await db.settings.bulkPut(data.settings as Setting[])
    if (data.syncQueue) await db.syncQueue.bulkPut(data.syncQueue as SyncQueueItem[])
  },
}
