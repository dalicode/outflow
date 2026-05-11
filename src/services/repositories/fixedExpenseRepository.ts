import type { FixedExpense, FixedExpenseSnapshot } from '../../types'
import db from '../db/schema'
import { enqueue } from './common'

export async function getFixedExpenses(): Promise<FixedExpense[]> {
  return db.fixedExpenses.toArray()
}

export async function getActiveFixedExpenses(): Promise<FixedExpense[]> {
  return db.fixedExpenses.toArray().then((all) => all.filter((f) => f.isArchived !== true))
}

export async function addFixedExpense(item: Omit<FixedExpense, 'id'>): Promise<number> {
  const now = new Date().toISOString()
  const id = await db.fixedExpenses.add({
    ...item,
    cloudId: crypto.randomUUID(),
    updatedAt: now,
  } as FixedExpense)
  const row = await db.fixedExpenses.get(id)
  await enqueue('fixedExpenses', 'insert', row as unknown as Record<string, unknown>)
  return id
}

export async function addArchivedFixedExpense(item: Omit<FixedExpense, 'id'>): Promise<number> {
  const now = new Date().toISOString()
  const payload = {
    ...item,
    cloudId: crypto.randomUUID(),
    isArchived: true,
    archivedAt: now,
    updatedAt: now,
  }
  const id = await db.fixedExpenses.add(payload as FixedExpense)
  const row = await db.fixedExpenses.get(id)
  await enqueue('fixedExpenses', 'insert', row as unknown as Record<string, unknown>)
  return id
}

export async function updateFixedExpense(
  id: number,
  changes: Partial<FixedExpense>,
): Promise<void> {
  await db.fixedExpenses.update(id, {
    ...changes,
    updatedAt: new Date().toISOString(),
  })
  const row = await db.fixedExpenses.get(id)
  await enqueue('fixedExpenses', 'update', row as unknown as Record<string, unknown>)
}

export async function removeFixedExpense(id: number): Promise<void> {
  await db.fixedExpenses.delete(id)
  await enqueue('fixedExpenses', 'delete', { id })
}

export async function getSnapshotsForYear(year: number): Promise<FixedExpenseSnapshot[]> {
  return db.fixedExpenseSnapshots.where('year').equals(year).toArray()
}

export async function getAllFixedExpenseSnapshots(): Promise<FixedExpenseSnapshot[]> {
  return db.fixedExpenseSnapshots.toArray()
}

export function bulkUpsertSnapshots(rows: FixedExpenseSnapshot[]): Promise<number> {
  return db.fixedExpenseSnapshots.bulkPut(rows)
}

export function deleteSnapshotsForYear(year: number): Promise<number> {
  return db.fixedExpenseSnapshots.where('year').equals(year).delete()
}
