import type { Expense } from '../../types'
import { normalizeImportedSyncMetadata } from '../../utils/syncMetadata'
import db from '../db/schema'
import { filterActiveRows, markDeletedSyncRecord, markPendingActiveRecord } from './common'
import { queueImportSyncMarker } from '../importService'
import { CSV_IMPORT_QUEUE_REASON, CSV_REPLACE_QUEUE_REASON } from '../syncRuntime'

function normalizeExpenseForImport(expense: Omit<Expense, 'id'>, now: string): Expense {
  return normalizeImportedSyncMetadata(expense as Record<string, unknown>, {
    now,
    forcePending: true,
  }) as Expense
}

async function withResolvedNameSnapshots(expense: Omit<Expense, 'id'>): Promise<Omit<Expense, 'id'>> {
  let categoryNameSnapshot = expense.categoryNameSnapshot
  if (typeof expense.categoryId === 'number') {
    const category = await db.categories.get(expense.categoryId)
    if (category && category.deletedAt == null) {
      categoryNameSnapshot = category.name
    }
  }

  let payeeNameSnapshot = expense.payeeNameSnapshot
  if (typeof expense.payeeId === 'number') {
    const payee = await db.payees.get(expense.payeeId)
    if (payee && payee.deletedAt == null) {
      payeeNameSnapshot = payee.name
    }
  }

  return {
    ...expense,
    categoryNameSnapshot,
    payeeNameSnapshot,
  }
}

export async function getAllExpenses(): Promise<Expense[]> {
  return db.expenses.orderBy('date').toArray()
}

export async function getAll(): Promise<Expense[]> {
  return filterActiveRows(await getAllExpenses())
}

export async function add(expense: Omit<Expense, 'id'>): Promise<number> {
  const now = new Date().toISOString()
  const withSnapshots = await withResolvedNameSnapshots(expense)
  return db.expenses.add(normalizeExpenseForImport(withSnapshots, now))
}

export async function update(id: number, changes: Partial<Expense>): Promise<void> {
  const existing = await db.expenses.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  const hasDeletedAtChange = Object.hasOwn(changes, 'deletedAt')
  const nextExpense = await withResolvedNameSnapshots({
    ...existing,
    ...changes,
    deletedAt: hasDeletedAtChange ? (changes.deletedAt ?? null) : (existing.deletedAt ?? null),
  })
  await db.expenses.put({
    ...markPendingActiveRecord(nextExpense, now),
    id,
  })
}

export async function remove(id: number): Promise<void> {
  const expense = await db.expenses.get(id)
  if (!expense) return
  await db.expenses.update(id, markDeletedSyncRecord(expense, new Date().toISOString()))
}

export async function removeMany(ids: number[]): Promise<void> {
  await db.transaction('rw', db.expenses, async () => {
    const now = new Date().toISOString()
    const expenses = await db.expenses.bulkGet(ids)
    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i]
      const id = ids[i]
      if (!expense || id == null) continue
      await db.expenses.put({
        ...expense,
        ...markDeletedSyncRecord(expense, now),
        id,
      })
    }
  })
}

export async function restore(id: number): Promise<void> {
  const expense = await db.expenses.get(id)
  if (!expense) return
  await db.expenses.put({
    ...expense,
    ...markPendingActiveRecord(expense, new Date().toISOString()),
    id,
  })
}

export async function restoreMany(ids: number[]): Promise<void> {
  await db.transaction('rw', db.expenses, async () => {
    const expenses = await db.expenses.bulkGet(ids)
    const now = new Date().toISOString()
    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i]
      const id = ids[i]
      if (!expense || id == null) continue
      await db.expenses.put({
        ...expense,
        ...markPendingActiveRecord(expense, now),
        id,
      })
    }
  })
}

export async function replaceAll(
  expenses: Array<Omit<Expense, 'id'>>,
  queueCloudReplace = false,
): Promise<void> {
  const now = new Date().toISOString()
  const records: Expense[] = expenses.map((expense) => normalizeExpenseForImport(expense, now))

  await db.transaction('rw', db.expenses, async () => {
    await db.expenses.clear()
    if (records.length > 0) {
      await db.expenses.bulkAdd(records)
    }
  })

  if (queueCloudReplace) {
    await queueImportSyncMarker(
      { reason: CSV_REPLACE_QUEUE_REASON, replaceTables: ['expenses'] },
      {
        clearTables: ['expenses'],
        clearReasons: [CSV_IMPORT_QUEUE_REASON, CSV_REPLACE_QUEUE_REASON],
      },
    )
  }
}

export async function bulkAddForImport(
  expenses: Array<Omit<Expense, 'id'>>,
  queueFullSync = false,
): Promise<void> {
  const now = new Date().toISOString()
  const records: Expense[] = expenses.map((expense) => normalizeExpenseForImport(expense, now))

  await db.transaction('rw', db.expenses, async () => {
    if (records.length > 0) {
      await db.expenses.bulkAdd(records)
    }
  })

  if (queueFullSync) {
    await queueImportSyncMarker(
      { reason: CSV_IMPORT_QUEUE_REASON, replace: false },
      {
        clearTables: ['expenses'],
        clearReasons: [CSV_IMPORT_QUEUE_REASON, CSV_REPLACE_QUEUE_REASON],
      },
    )
  }
}

export async function getExpenseCountForCategory(categoryId: number): Promise<number> {
  const matches = await db.expenses.where('categoryId').equals(categoryId).toArray()
  return filterActiveRows(matches).length
}

export async function getExpenseCountForPayee(payeeId: number): Promise<number> {
  const matches = await db.expenses.where('payeeId').equals(payeeId).toArray()
  return filterActiveRows(matches).length
}
