import type { Payee, PayeeMergeHistory } from '../../types'
import db from '../db/schema'
import { enqueue } from './common'

export async function getPayees(): Promise<Payee[]> {
  return db.payees.toArray()
}

export async function getActivePayees(): Promise<Payee[]> {
  return db.payees.toArray().then((all) => all.filter((p) => p.isArchived !== true))
}

export async function addPayee(name: string): Promise<number> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Payee name is required')
  const existing = await db.payees.where('name').equalsIgnoreCase(trimmed).first()
  if (existing) {
    if (existing.isArchived) {
      await db.payees.update(existing.id as number, {
        name: trimmed,
        isArchived: false,
      })
      const row = await db.payees.get(existing.id as number)
      await enqueue('payees', 'update', row as unknown as Record<string, unknown>)
      return existing.id as number
    }
    throw new Error('A payee with that name already exists')
  }
  const now = new Date().toISOString()
  const id = await db.payees.add({
    name: trimmed,
    cloudId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    isArchived: false,
  } as Payee)
  const row = await db.payees.get(id)
  await enqueue('payees', 'insert', row as unknown as Record<string, unknown>)
  return id
}

export async function ensureForImport(names: string[]): Promise<Record<string, number>> {
  const trimmedNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  const payeeMap: Record<string, number> = {}
  if (trimmedNames.length === 0) return payeeMap

  await db.transaction('rw', db.payees, async () => {
    for (const name of trimmedNames) {
      const existing = await db.payees.where('name').equalsIgnoreCase(name).first()
      if (existing) {
        if (existing.isArchived) {
          await db.payees.update(existing.id as number, {
            name,
            isArchived: false,
            updatedAt: new Date().toISOString(),
          })
        }
        payeeMap[name] = existing.id as number
        continue
      }

      const now = new Date().toISOString()
      const id = await db.payees.add({
        name,
        cloudId: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      } as Payee)
      payeeMap[name] = id
    }
  })

  return payeeMap
}

export async function updatePayee(id: number, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Payee name is required')
  const existing = await db.payees.where('name').equalsIgnoreCase(trimmed).first()
  if (existing && existing.id !== id) throw new Error('A payee with that name already exists')
  const updates: Partial<Payee> = {
    name: trimmed,
    updatedAt: new Date().toISOString(),
  }
  await db.payees.update(id, updates)
  const row = await db.payees.get(id)
  await enqueue('payees', 'update', row as unknown as Record<string, unknown>)
}

export async function archivePayee(id: number): Promise<void> {
  await db.payees.update(id, { isArchived: true })
  const row = await db.payees.get(id)
  await enqueue('payees', 'update', row as unknown as Record<string, unknown>)
}

export async function unarchivePayee(id: number): Promise<void> {
  await db.payees.update(id, { isArchived: false })
  const row = await db.payees.get(id)
  await enqueue('payees', 'update', row as unknown as Record<string, unknown>)
}

export async function mergePayee(sourcePayeeId: number, targetPayeeId: number): Promise<number> {
  if (sourcePayeeId === targetPayeeId) {
    throw new Error('Cannot merge a payee into itself.')
  }
  const now = new Date().toISOString()

  const affected = await db.expenses.where('payeeId').equals(sourcePayeeId).toArray()
  const affectedIds = affected.map((e) => e.id as number)

  if (affectedIds.length > 0) {
    await db.expenses.where('payeeId').equals(sourcePayeeId).modify({ payeeId: targetPayeeId })
  }

  const mergeId = await db.payeeMergeHistory.add({
    cloudId: crypto.randomUUID(),
    sourcePayeeId,
    targetPayeeId,
    affectedExpenseIds: affectedIds,
    createdAt: now,
    updatedAt: now,
    revertedAt: null,
  } as PayeeMergeHistory)
  const mergeRow = await db.payeeMergeHistory.get(mergeId)
  if (mergeRow) {
    await enqueue('payeeMergeHistory', 'insert', mergeRow as unknown as Record<string, unknown>)
  }

  await db.payees.update(sourcePayeeId, {
    isArchived: true,
    archivedAt: now,
    mergedIntoPayeeId: targetPayeeId,
    updatedAt: now,
  })
  const updatedPayee = await db.payees.get(sourcePayeeId)
  await enqueue('payees', 'update', updatedPayee as unknown as Record<string, unknown>)

  return mergeId
}

export async function revertPayeeMerge(mergeId: number): Promise<void> {
  const mergeRow = await db.payeeMergeHistory.get(mergeId)
  if (!mergeRow || mergeRow.revertedAt) {
    throw new Error('Merge record not found or already reverted.')
  }
  const now = new Date().toISOString()

  if (mergeRow.affectedExpenseIds.length > 0) {
    await db.expenses.bulkUpdate(
      mergeRow.affectedExpenseIds.map((id) => ({
        key: id,
        changes: { payeeId: mergeRow.sourcePayeeId },
      })),
    )
  }

  await db.payees.update(mergeRow.sourcePayeeId, {
    isArchived: false,
    archivedAt: undefined,
    mergedIntoPayeeId: null,
    updatedAt: now,
  } as Partial<Payee>)

  await db.payeeMergeHistory.update(mergeId, { revertedAt: now })
  const updatedMerge = await db.payeeMergeHistory.get(mergeId)
  await enqueue('payeeMergeHistory', 'update', updatedMerge as unknown as Record<string, unknown>)

  const updatedPayee = await db.payees.get(mergeRow.sourcePayeeId)
  await enqueue('payees', 'update', updatedPayee as unknown as Record<string, unknown>)
}
