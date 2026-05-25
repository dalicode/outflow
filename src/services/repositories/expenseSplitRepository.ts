import type { Expense, ExpenseSplit } from '../../types'
import { normalizeImportedSyncMetadata } from '../../utils/syncMetadata'
import db from '../db/schema'
import { filterActiveRows, markDeletedSyncRecord, markPendingActiveRecord } from './common'

export interface SplitChildExpenseInput {
  expenseId?: number
  categoryId?: number
  payeeId?: number
  notes?: string
  amount: number
}

export interface SaveExpenseSplitWithChildrenParams {
  splitId?: number
  replaceExpenseId?: number
  split: Omit<ExpenseSplit, 'id'>
  children: SplitChildExpenseInput[]
}

function normalizeSplitForImport(split: Omit<ExpenseSplit, 'id'>, now: string): ExpenseSplit {
  return normalizeImportedSyncMetadata(split as unknown as Record<string, unknown>, {
    now,
    forcePending: true,
  }) as unknown as ExpenseSplit
}

function normalizeExpenseForImport(expense: Omit<Expense, 'id'>, now: string): Expense {
  return normalizeImportedSyncMetadata(expense as unknown as Record<string, unknown>, {
    now,
    forcePending: true,
  }) as unknown as Expense
}

async function withResolvedNameSnapshots(
  expense: Omit<Expense, 'id'>,
): Promise<Omit<Expense, 'id'>> {
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

async function buildSplitChildPayload(
  splitId: number,
  split: Omit<ExpenseSplit, 'id'>,
  child: SplitChildExpenseInput,
): Promise<Omit<Expense, 'id'>> {
  return withResolvedNameSnapshots({
    date: split.date,
    splitId,
    categoryId: child.categoryId,
    payeeId: split.payeeId,
    payeeNameSnapshot: split.payeeNameSnapshot ?? null,
    notes: child.notes,
    amount: child.amount,
  })
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

export async function saveExpenseSplitWithChildren(
  params: SaveExpenseSplitWithChildrenParams,
): Promise<number> {
  const { children, replaceExpenseId, split, splitId } = params
  const now = new Date().toISOString()

  return db.transaction(
    'rw',
    db.expenseSplits,
    db.expenses,
    db.categories,
    db.payees,
    async () => {
    let resolvedSplitId = splitId
    if (typeof resolvedSplitId === 'number') {
      const existingSplit = await db.expenseSplits.get(resolvedSplitId)
      if (!existingSplit) {
        throw new Error(`Split container ${resolvedSplitId} was not found.`)
      }
      await updateExpenseSplit(resolvedSplitId, split)
    } else {
      resolvedSplitId = await db.expenseSplits.add(normalizeSplitForImport(split, now))
    }

    if (typeof resolvedSplitId !== 'number') {
      throw new Error('Split save did not produce a valid split id.')
    }

    if (typeof splitId === 'number') {
      const existingChildren = await db.expenses.where('splitId').equals(resolvedSplitId).toArray()
      const retainedExpenseIds = new Set(
        children
          .filter((child): child is SplitChildExpenseInput & { expenseId: number } => typeof child.expenseId === 'number')
          .map((child) => child.expenseId),
      )

      for (const existingChild of existingChildren) {
        if (
          existingChild.deletedAt == null &&
          typeof existingChild.id === 'number' &&
          !retainedExpenseIds.has(existingChild.id)
        ) {
          await db.expenses.put({
            ...existingChild,
            ...markDeletedSyncRecord(existingChild, now),
            id: existingChild.id,
          })
        }
      }
    }

    let didReplaceExistingExpense = false
    for (const child of children) {
      const childPayload = await buildSplitChildPayload(resolvedSplitId, split, child)

      if (typeof child.expenseId === 'number') {
        const existingChild = await db.expenses.get(child.expenseId)
        if (!existingChild) {
          throw new Error(`Split child expense ${child.expenseId} was not found.`)
        }

        await db.expenses.put({
          ...markPendingActiveRecord(
            {
              ...existingChild,
              ...childPayload,
              deletedAt: null,
            },
            now,
          ),
          id: child.expenseId,
        })
        continue
      }

      if (!didReplaceExistingExpense && typeof replaceExpenseId === 'number') {
        const existingExpense = await db.expenses.get(replaceExpenseId)
        if (!existingExpense) {
          throw new Error(`Expense ${replaceExpenseId} was not found for split conversion.`)
        }

        await db.expenses.put({
          ...markPendingActiveRecord(
            {
              ...existingExpense,
              ...childPayload,
              deletedAt: null,
            },
            now,
          ),
          id: replaceExpenseId,
        })
        didReplaceExistingExpense = true
        continue
      }

      await db.expenses.add(normalizeExpenseForImport(childPayload, now))
    }

    return resolvedSplitId
    },
  )
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

export async function unsplitSplitChildExpense(expenseId: number): Promise<void> {
  await db.transaction('rw', db.expenseSplits, db.expenses, async () => {
    const child = await db.expenses.get(expenseId)
    if (!child || typeof child.id !== 'number' || typeof child.splitId !== 'number') return

    const splitId = child.splitId
    const split = await db.expenseSplits.get(splitId)
    const now = new Date().toISOString()

    await db.expenses.put({
      ...markPendingActiveRecord(child, now),
      splitId: undefined,
      id: child.id,
    })

    if (!split || split.deletedAt != null) {
      return
    }

    const splitChildren = await db.expenses.where('splitId').equals(splitId).toArray()
    const remainingChildren = splitChildren.filter(
      (expense): expense is Expense & { id: number } =>
        typeof expense.id === 'number' && expense.id !== child.id && expense.deletedAt == null,
    )

    if (remainingChildren.length === 0) {
      await db.expenseSplits.put({
        ...split,
        ...markDeletedSyncRecord(split, now),
        id: splitId,
      })
      return
    }

    const remainingAmount = remainingChildren.reduce(
      (sum, expense) => sum + (expense.amount ?? 0),
      0,
    )

    await db.expenseSplits.put({
      ...markPendingActiveRecord(
        {
          ...split,
          amount: remainingAmount,
        },
        now,
      ),
      id: splitId,
    })
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
