import type { Expense, Payee, PayeeMergeHistory } from '../../types'
import { normalizeNameForSync } from '../../utils/syncMetadata'
import db from '../db/schema'
import { buildCreatedSyncRecord, filterActiveRows, markPendingActiveRecord } from './common'

export async function getAllPayees(): Promise<Payee[]> {
  return db.payees.toArray()
}

export async function getPayees(): Promise<Payee[]> {
  return filterActiveRows(await getAllPayees())
}

export async function getActivePayees(): Promise<Payee[]> {
  return (await getPayees()).filter((payee) => payee.isArchived !== true)
}

async function findByNormalizedName(normalizedName: string): Promise<Payee[]> {
  return db.payees.where('normalizedName').equals(normalizedName).toArray()
}

export async function addPayee(name: string): Promise<number> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Payee name is required')

  const normalizedName = normalizeNameForSync(trimmed)
  const matches = await findByNormalizedName(normalizedName)
  const active = matches.find((row) => row.deletedAt == null)
  const now = new Date().toISOString()

  if (active) {
    if (active.isArchived && active.id != null) {
      await db.payees.put({
        ...active,
        ...markPendingActiveRecord(active, now),
        id: active.id,
        name: trimmed,
        normalizedName,
        isArchived: false,
        mergedIntoPayeeId: null,
      })
      return active.id
    }
    throw new Error('A payee with that name already exists')
  }

  const tombstoned = matches.find((row) => row.deletedAt != null)
  if (tombstoned && tombstoned.id != null) {
    await db.payees.put({
      ...tombstoned,
      ...markPendingActiveRecord(tombstoned, now),
      id: tombstoned.id,
      name: trimmed,
      normalizedName,
      isArchived: false,
      mergedIntoPayeeId: null,
    })
    return tombstoned.id
  }

  return db.payees.add(
    buildCreatedSyncRecord(
      {
        name: trimmed,
        normalizedName,
        isArchived: false,
      },
      now,
    ) as Payee,
  )
}

export async function ensureForImport(names: string[]): Promise<Record<string, number>> {
  const trimmedNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  const payeeMap: Record<string, number> = {}
  if (trimmedNames.length === 0) return payeeMap

  await db.transaction('rw', db.payees, async () => {
    const now = new Date().toISOString()

    for (const name of trimmedNames) {
      const normalizedName = normalizeNameForSync(name)
      const matches = await findByNormalizedName(normalizedName)
      const active = matches.find((row) => row.deletedAt == null)

      if (active && active.id != null) {
        if (active.isArchived) {
          await db.payees.put({
            ...active,
            ...markPendingActiveRecord(active, now),
            id: active.id,
            name,
            normalizedName,
            isArchived: false,
            mergedIntoPayeeId: null,
          })
        }
        payeeMap[name] = active.id
        continue
      }

      const tombstoned = matches.find((row) => row.deletedAt != null)
      if (tombstoned && tombstoned.id != null) {
        await db.payees.put({
          ...tombstoned,
          ...markPendingActiveRecord(tombstoned, now),
          id: tombstoned.id,
          name,
          normalizedName,
          isArchived: false,
          mergedIntoPayeeId: null,
        })
        payeeMap[name] = tombstoned.id
        continue
      }

      const id = await db.payees.add(
        buildCreatedSyncRecord(
          {
            name,
            normalizedName,
            isArchived: false,
          },
          now,
        ) as Payee,
      )
      payeeMap[name] = id
    }
  })

  return payeeMap
}

export async function updatePayee(id: number, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Payee name is required')

  const existing = await db.payees.get(id)
  if (!existing) return

  const normalizedName = normalizeNameForSync(trimmed)
  const conflicts = filterActiveRows(await findByNormalizedName(normalizedName)).filter(
    (row) => row.id !== id,
  )
  if (conflicts.length > 0) throw new Error('A payee with that name already exists')

  const now = new Date().toISOString()
  await db.payees.put({
    ...existing,
    ...markPendingActiveRecord(existing, now),
    id,
    name: trimmed,
    normalizedName,
  })
}

export async function archivePayee(id: number): Promise<void> {
  const existing = await db.payees.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  await db.payees.put({
    ...existing,
    ...markPendingActiveRecord(existing, now),
    id,
    isArchived: true,
  })
}

export async function unarchivePayee(id: number): Promise<void> {
  const existing = await db.payees.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  await db.payees.put({
    ...existing,
    ...markPendingActiveRecord(existing, now),
    id,
    isArchived: false,
    mergedIntoPayeeId: null,
  })
}

export async function mergePayee(sourcePayeeId: number, targetPayeeId: number): Promise<number> {
  if (sourcePayeeId === targetPayeeId) {
    throw new Error('Cannot merge a payee into itself.')
  }

  const now = new Date().toISOString()
  const targetPayee = await db.payees.get(targetPayeeId)
  const sourcePayee = await db.payees.get(sourcePayeeId)
  if (!sourcePayee) {
    throw new Error('Source payee not found.')
  }

  const affected = filterActiveRows(
    await db.expenses.where('payeeId').equals(sourcePayeeId).toArray(),
  )
  if (affected.length > 0) {
    const updates = affected
      .filter((expense) => expense.id != null)
      .map((expense) => ({
        ...expense,
        ...markPendingActiveRecord(expense, now),
        id: expense.id as number,
        payeeId: targetPayeeId,
        payeeNameSnapshot: targetPayee?.name ?? expense.payeeNameSnapshot ?? null,
      }))
    await db.expenses.bulkPut(updates as Expense[])
  }

  const mergeId = await db.payeeMergeHistory.add(
    buildCreatedSyncRecord(
      {
        sourcePayeeId,
        targetPayeeId,
        affectedExpenseIds: affected
          .map((expense) => expense.id)
          .filter((expenseId): expenseId is number => typeof expenseId === 'number'),
        revertedAt: null,
      },
      now,
    ) as PayeeMergeHistory,
  )

  await db.payees.put({
    ...sourcePayee,
    ...markPendingActiveRecord(sourcePayee, now),
    id: sourcePayeeId,
    isArchived: true,
    mergedIntoPayeeId: targetPayeeId,
  })

  return mergeId
}

export async function revertPayeeMerge(mergeId: number): Promise<void> {
  const mergeRow = await db.payeeMergeHistory.get(mergeId)
  if (!mergeRow || mergeRow.revertedAt) {
    throw new Error('Merge record not found or already reverted.')
  }

  const now = new Date().toISOString()
  const sourcePayee = await db.payees.get(mergeRow.sourcePayeeId)

  if (mergeRow.affectedExpenseIds.length > 0) {
    const affected = await db.expenses.bulkGet(mergeRow.affectedExpenseIds)
    const reverted = filterActiveRows(
      affected.filter((expense): expense is Expense => Boolean(expense)),
    )
      .filter((expense) => expense.id != null)
      .map((expense) => ({
        ...expense,
        ...markPendingActiveRecord(expense, now),
        id: expense.id as number,
        payeeId: mergeRow.sourcePayeeId,
        payeeNameSnapshot: sourcePayee?.name ?? expense.payeeNameSnapshot ?? null,
      }))
    if (reverted.length > 0) {
      await db.expenses.bulkPut(reverted)
    }
  }

  if (sourcePayee) {
    await db.payees.put({
      ...sourcePayee,
      ...markPendingActiveRecord(sourcePayee, now),
      id: mergeRow.sourcePayeeId,
      isArchived: false,
      mergedIntoPayeeId: null,
    } as Payee)
  }

  await db.payeeMergeHistory.put({
    ...mergeRow,
    ...markPendingActiveRecord(mergeRow, now),
    id: mergeId,
    revertedAt: now,
  } as PayeeMergeHistory)
}
