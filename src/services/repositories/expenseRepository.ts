import type { Expense } from '../../types'
import db from '../db/schema'
import { enqueue } from './common'

export async function getAll(): Promise<Expense[]> {
  return db.expenses.orderBy('date').toArray()
}

export async function add(expense: Omit<Expense, 'id'>): Promise<number> {
  const now = new Date().toISOString()
  const record = {
    ...expense,
    cloudId: crypto.randomUUID(),
    updatedAt: now,
  } as Expense
  const id = await db.expenses.add(record)
  await enqueue('expenses', 'insert', { ...expense, id, cloudId: record.cloudId })
  return id
}

export async function update(id: number, changes: Partial<Expense>): Promise<void> {
  await db.expenses.update(id, { ...changes, updatedAt: new Date().toISOString() })
  const row = await db.expenses.get(id)
  await enqueue('expenses', 'update', row as unknown as Record<string, unknown>)
}

export async function remove(id: number): Promise<void> {
  const expense = await db.expenses.get(id)
  await db.expenses.delete(id)
  await enqueue('expenses', 'delete', { id, cloudId: expense?.cloudId })
}

export async function removeMany(ids: number[]): Promise<void> {
  await db.transaction('rw', db.expenses, db.syncQueue, async () => {
    const expenses = await db.expenses.bulkGet(ids)
    await db.expenses.bulkDelete(ids)
    for (let i = 0; i < ids.length; i++) {
      await enqueue('expenses', 'delete', { id: ids[i], cloudId: expenses[i]?.cloudId })
    }
  })
}

export async function getExpenseCountForCategory(categoryId: number): Promise<number> {
  return db.expenses.where('categoryId').equals(categoryId).count()
}

export async function getExpenseCountForPayee(payeeId: number): Promise<number> {
  return db.expenses.where('payeeId').equals(payeeId).count()
}
