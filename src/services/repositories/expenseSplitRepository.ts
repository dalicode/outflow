import type { Expense, ExpenseSplit } from '../../types'
import { normalizeImportedSyncMetadata } from '../../utils/syncMetadata'
import db from '../db/schema'
import { filterActiveRows, markDeletedSyncRecord, markPendingActiveRecord } from './common'

function normalizeSplitForImport(split: Omit<ExpenseSplit, 'id'>, now: string): ExpenseSplit {
  return normalizeImportedSyncMetadata(split as unknown as Record<string, unknown>, {
    now,
    forcePending: true,
  }) as unknown as ExpenseSplit
}

export async function getAllExpenseSplits(): Promise<ExpenseSplit[]> {
  return db.expenseSplits.orderBy('date').toArray()
}

export async function getExpenseSplits(): Promise<ExpenseSplit[]> {
  return filterActiveRows(await getAllExpenseSplits())
}

export async function addExpenseSplit(split: Omit<ExpenseSplit, 'id'>): Promise<number> {
  const now = new Date().toISOString()
  return db.expenseSplits.add(normalizeSplitForImport(split, now))
}

function applySplitContainerFieldsToChild(
  child: Expense,
  split: ExpenseSplit,
  now: string,
): Expense | null {
  const nextDate = split.date
  const nextPayeeId = split.payeeId
  const nextPayeeNameSnapshot = split.payeeNameSnapshot ?? null
  const needsUpdate =
    child.date !== nextDate ||
    child.payeeId !== nextPayeeId ||
    (child.payeeNameSnapshot ?? null) !== nextPayeeNameSnapshot ||
    child.deletedAt != null

  if (!needsUpdate) return null

  return {
    ...markPendingActiveRecord(child, now),
    date: nextDate,
    payeeId: nextPayeeId,
    payeeNameSnapshot: nextPayeeNameSnapshot,
    id: child.id,
  }
}

export async function updateExpenseSplit(id: number, changes: Partial<ExpenseSplit>): Promise<void> {
  await db.transaction('rw', db.expenseSplits, db.expenses, async () => {
    const existing = await db.expenseSplits.get(id)
    if (!existing) return
    const now = new Date().toISOString()
    const hasDeletedAtChange = Object.hasOwn(changes, 'deletedAt')
    const nextSplit = {
      ...markPendingActiveRecord(
        {
          ...existing,
          ...changes,
          deletedAt: hasDeletedAtChange ? (changes.deletedAt ?? null) : (existing.deletedAt ?? null),
        },
        now,
      ),
      id,
    }
    await db.expenseSplits.put(nextSplit)

    const shouldPropagateDate = Object.hasOwn(changes, 'date')
    const shouldPropagatePayee =
      Object.hasOwn(changes, 'payeeId') || Object.hasOwn(changes, 'payeeNameSnapshot')
    if (!shouldPropagateDate && !shouldPropagatePayee) return

    const children = await db.expenses.where('splitId').equals(id).toArray()
    for (const child of children) {
      if (typeof child.id !== 'number') continue
      const nextChild = {
        ...child,
        ...(shouldPropagateDate ? { date: nextSplit.date } : {}),
        ...(shouldPropagatePayee
          ? {
              payeeId: nextSplit.payeeId,
              payeeNameSnapshot: nextSplit.payeeNameSnapshot ?? null,
            }
          : {}),
      }
      const pendingChild = markPendingActiveRecord(nextChild, now)
      await db.expenses.put({
        ...pendingChild,
        id: child.id,
      })
    }
  })
}

export async function getSplitChildExpenses(splitId: number): Promise<Expense[]> {
  return filterActiveRows(await db.expenses.where('splitId').equals(splitId).toArray())
}

export async function getAllSplitChildExpenses(splitId: number): Promise<Expense[]> {
  return db.expenses.where('splitId').equals(splitId).toArray()
}

export async function removeExpenseSplit(id: number): Promise<void> {
  await db.transaction('rw', db.expenseSplits, db.expenses, async () => {
    const split = await db.expenseSplits.get(id)
    if (!split) return

    const now = new Date().toISOString()
    await db.expenseSplits.put({
      ...split,
      ...markDeletedSyncRecord(split, now),
      id,
    })

    const children = await db.expenses.where('splitId').equals(id).toArray()
    for (const child of children) {
      if (typeof child.id !== 'number') continue
      await db.expenses.put({
        ...child,
        ...markDeletedSyncRecord(child, now),
        id: child.id,
      })
    }
  })
}

export async function restoreExpenseSplit(id: number): Promise<void> {
  await db.transaction('rw', db.expenseSplits, db.expenses, async () => {
    const split = await db.expenseSplits.get(id)
    if (!split) return

    const now = new Date().toISOString()
    await db.expenseSplits.put({
      ...split,
      ...markPendingActiveRecord(split, now),
      id,
    })

    const children = await db.expenses.where('splitId').equals(id).toArray()
    for (const child of children) {
      if (typeof child.id !== 'number') continue
      const normalizedChild = applySplitContainerFieldsToChild(child, split, now)
      await db.expenses.put(
        normalizedChild ?? {
          ...child,
          ...markPendingActiveRecord(child, now),
          id: child.id,
        },
      )
    }
  })
}

export async function unsplitExpenseSplit(id: number): Promise<void> {
  await db.transaction('rw', db.expenseSplits, db.expenses, async () => {
    const split = await db.expenseSplits.get(id)
    if (!split) return

    const now = new Date().toISOString()
    await db.expenseSplits.put({
      ...split,
      ...markDeletedSyncRecord(split, now),
      id,
    })

    const children = await db.expenses.where('splitId').equals(id).toArray()
    for (const child of children) {
      if (typeof child.id !== 'number') continue
      const pendingChild = markPendingActiveRecord(child, now)
      await db.expenses.put({
        ...pendingChild,
        splitId: undefined,
        id: child.id,
      })
    }
  })
}

export async function repairOrphanedSplitChildren(): Promise<number> {
  const allExpenses = await db.expenses.toArray()
  const activeExpenses = allExpenses.filter(
    (expense): expense is Expense & { id: number; splitId: number } =>
      expense.deletedAt == null && typeof expense.id === 'number' && typeof expense.splitId === 'number',
  )
  if (activeExpenses.length === 0) return 0

  const splits = await db.expenseSplits.toArray()
  const activeSplitIds = new Set(
    splits
      .filter((split) => split.deletedAt == null && typeof split.id === 'number')
      .map((split) => split.id as number),
  )

  const now = new Date().toISOString()
  let repairedCount = 0

  await db.transaction('rw', db.expenses, async () => {
    for (const expense of activeExpenses) {
      if (activeSplitIds.has(expense.splitId)) continue
      const pendingExpense = markPendingActiveRecord(expense, now)
      await db.expenses.put({
        ...pendingExpense,
        splitId: undefined,
        id: expense.id,
      })
      repairedCount += 1
    }
  })

  return repairedCount
}
