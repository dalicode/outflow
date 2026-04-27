import Dexie from 'dexie'

const db = new Dexie('SpendingTracker')

db.version(1).stores({ expenses: '++id, date, category' })
db.version(2).stores({
  expenses: '++id, date, category',
  settings: 'key',
  fixedExpenses: '++id',
})
db.version(3).stores({
  expenses: '++id, date, category, categoryId',
  settings: 'key',
  fixedExpenses: '++id',
  categories: '++id, name',
})
db.version(4).stores({
  expenses: '++id, date, category, categoryId',
  settings: 'key',
  fixedExpenses: '++id',
  categories: '++id, name',
  syncQueue: '++id, table, timestamp',
})
db.version(5).stores({
  expenses: '++id, date, category, categoryId',
  settings: 'key',
  fixedExpenses: '++id',
  categories: '++id, name',
  syncQueue: '++id, table, timestamp',
  // One snapshot row per fixed expense per month: [fixedExpenseId, year, month]
  fixedExpenseSnapshots: '++id, [fixedExpenseId+year+month], year, month',
})

const DEFAULT_CATEGORIES = [
  'Entertainment', 'Health', 'Misc', 'Personal Goods',
  'Transportation', 'Groceries', 'Dining',
]

db.on('populate', () => {
  const now = new Date().toISOString()
  db.categories.bulkAdd(
    DEFAULT_CATEGORIES.map((name) => ({ name, createdAt: now, isArchived: false, isDeleted: false }))
  )
})

// Write a snapshot for a fixed expense for the current month (idempotent — upsert by compound key)
const snapshotFixed = async (item) => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-12
  // Only write if no snapshot exists for this item+month yet (first write wins for history)
  const existing = await db.fixedExpenseSnapshots
    .where('[fixedExpenseId+year+month]').equals([item.id, year, month]).first()
  if (!existing) {
    await db.fixedExpenseSnapshots.add({
      fixedExpenseId: item.id,
      nameSnapshot: item.name,
      amountSnapshot: item.amount,
      year,
      month,
      createdAt: now.toISOString(),
    })
  }
}

// Enqueue a sync operation for the background engine to process
const enqueue = (table, operation, payload) =>
  db.syncQueue.add({ table, operation, payload, timestamp: Date.now() })

export const StorageService = {
  // ── Expenses ──────────────────────────────────────────────
  getAll: () => db.expenses.orderBy('date').toArray(),
  add: async (expense) => {
    const id = await db.expenses.add(expense)
    await enqueue('expenses', 'insert', { ...expense, id })
    return id
  },
  update: async (id, changes) => {
    await db.expenses.update(id, changes)
    const row = await db.expenses.get(id)
    await enqueue('expenses', 'update', row)
  },
  remove: async (id) => {
    await db.expenses.delete(id)
    await enqueue('expenses', 'delete', { id })
  },
  removeMany: async (ids) => {
    await db.transaction('rw', db.expenses, db.syncQueue, async () => {
      await db.expenses.bulkDelete(ids)
      for (const id of ids) {
        await enqueue('expenses', 'delete', { id })
      }
    })
  },

  // ── Settings ──────────────────────────────────────────────
  getSetting: async (key, fallback = null) => {
    const row = await db.settings.get(key)
    return row ? row.value : fallback
  },
  setSetting: async (key, value) => {
    await db.settings.put({ key, value })
    await enqueue('settings', 'upsert', { key, value })
  },

  // ── Fixed Expenses ────────────────────────────────────────
  getFixedExpenses: () => db.fixedExpenses.toArray(),
  addFixedExpense: async (item) => {
    const id = await db.fixedExpenses.add(item)
    const row = await db.fixedExpenses.get(id)
    await snapshotFixed(row)
    await enqueue('fixedExpenses', 'insert', row)
    return id
  },
  updateFixedExpense: async (id, changes) => {
    await db.fixedExpenses.update(id, changes)
    const row = await db.fixedExpenses.get(id)
    await snapshotFixed(row)
    await enqueue('fixedExpenses', 'update', row)
  },
  removeFixedExpense: async (id) => {
    // Snapshot before deleting so history is preserved
    const row = await db.fixedExpenses.get(id)
    if (row) await snapshotFixed(row)
    await db.fixedExpenses.delete(id)
    await enqueue('fixedExpenses', 'delete', { id })
  },

  // ── Fixed Expense Snapshots ───────────────────────────────
  // Returns all snapshots for a given year
  getSnapshotsForYear: (year) => db.fixedExpenseSnapshots.where('year').equals(year).toArray(),
  bulkUpsertSnapshots: (rows) => db.fixedExpenseSnapshots.bulkPut(rows),

  // ── Categories ────────────────────────────────────────────
  getCategories: () => db.categories.toArray(),
  addCategory: async (name) => {
    const id = await db.categories.add({
      name: name.trim(),
      createdAt: new Date().toISOString(),
      isArchived: false,
      isDeleted: false,
    })
    const row = await db.categories.get(id)
    await enqueue('categories', 'insert', row)
    return id
  },
  updateCategory: async (id, changes) => {
    await db.categories.update(id, changes)
    const row = await db.categories.get(id)
    await enqueue('categories', 'update', row)
  },
  deleteCategory: async (id) => {
    await db.categories.update(id, { isDeleted: true })
    const row = await db.categories.get(id)
    await enqueue('categories', 'update', row)
  },

  // ── Sync Queue (used by SyncEngine) ──────────────────────
  getSyncQueue: () => db.syncQueue.orderBy('timestamp').toArray(),
  removeSyncQueueItem: (id) => db.syncQueue.delete(id),
  clearSyncQueue: () => db.syncQueue.clear(),

  // ── Bulk upsert (used by incoming sync merge) ─────────────
  bulkUpsertExpenses: (rows) => db.expenses.bulkPut(rows),
  bulkUpsertCategories: (rows) => db.categories.bulkPut(rows),
  bulkUpsertFixedExpenses: (rows) => db.fixedExpenses.bulkPut(rows),

  // ── Full data backup (JSON export / import) ────────────────
  exportAllData: async () => ({
    expenses: await db.expenses.toArray(),
    categories: await db.categories.toArray(),
    fixedExpenses: await db.fixedExpenses.toArray(),
    fixedExpenseSnapshots: await db.fixedExpenseSnapshots.toArray(),
    settings: await db.settings.toArray(),
    syncQueue: await db.syncQueue.toArray(),
  }),

  importAllData: async (data, { replace = false } = {}) => {
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

    if (data.expenses) await db.expenses.bulkPut(data.expenses)
    if (data.categories) await db.categories.bulkPut(data.categories)
    if (data.fixedExpenses) await db.fixedExpenses.bulkPut(data.fixedExpenses)
    if (data.fixedExpenseSnapshots) await db.fixedExpenseSnapshots.bulkPut(data.fixedExpenseSnapshots)
    if (data.settings) await db.settings.bulkPut(data.settings)
    if (data.syncQueue) await db.syncQueue.bulkPut(data.syncQueue)
  },
}
