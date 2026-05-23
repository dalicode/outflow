import type { FixedExpense, FixedExpenseSnapshot } from '../../types'
import db from '../db/schema'
import {
  buildCreatedSyncRecord,
  filterActiveRows,
  markDeletedSyncRecord,
  markPendingActiveRecord,
} from './common'

export async function getAllFixedExpenses(): Promise<FixedExpense[]> {
  return db.fixedExpenses.toArray()
}

export async function getFixedExpenses(): Promise<FixedExpense[]> {
  return filterActiveRows(await getAllFixedExpenses())
}

export async function getActiveFixedExpenses(): Promise<FixedExpense[]> {
  return (await getFixedExpenses()).filter((expense) => expense.isArchived !== true)
}

export async function addFixedExpense(item: Omit<FixedExpense, 'id'>): Promise<number> {
  const now = new Date().toISOString()
  return db.fixedExpenses.add(
    buildCreatedSyncRecord(
      {
        ...item,
        isArchived: false,
        updatedAt: now,
      },
      now,
    ) as FixedExpense,
  )
}

export async function addArchivedFixedExpense(item: Omit<FixedExpense, 'id'>): Promise<number> {
  const now = new Date().toISOString()
  return db.fixedExpenses.add(
    buildCreatedSyncRecord(
      {
        ...item,
        isArchived: true,
        updatedAt: now,
      },
      now,
    ) as FixedExpense,
  )
}

export async function updateFixedExpense(
  id: number,
  changes: Partial<FixedExpense>,
): Promise<void> {
  const existing = await db.fixedExpenses.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  await db.fixedExpenses.put({
    ...existing,
    ...changes,
    ...markPendingActiveRecord(existing, now),
    id,
  })
}

export async function removeFixedExpense(id: number): Promise<void> {
  const existing = await db.fixedExpenses.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  await db.fixedExpenses.put({
    ...existing,
    ...markPendingActiveRecord(existing, now),
    id,
    isArchived: true,
  })
}

export async function getAllFixedExpenseSnapshots(): Promise<FixedExpenseSnapshot[]> {
  return db.fixedExpenseSnapshots.toArray()
}

export async function getFixedExpenseSnapshots(): Promise<FixedExpenseSnapshot[]> {
  return filterActiveRows(await getAllFixedExpenseSnapshots())
}

export async function getAllSnapshotsForYear(year: number): Promise<FixedExpenseSnapshot[]> {
  return db.fixedExpenseSnapshots.where('year').equals(year).toArray()
}

export async function getSnapshotsForYear(year: number): Promise<FixedExpenseSnapshot[]> {
  return filterActiveRows(await getAllSnapshotsForYear(year))
}

export function bulkUpsertSnapshots(rows: FixedExpenseSnapshot[]): Promise<number> {
  return db.transaction('rw', db.fixedExpenseSnapshots, async () => {
    const now = new Date().toISOString()
    let changed = 0

    for (const row of rows) {
      const existing = await db.fixedExpenseSnapshots
        .where('[fixedExpenseId+year+month]')
        .equals([row.fixedExpenseId, row.year, row.month])
        .first()

      if (existing) {
        const id = existing.id as number
        await db.fixedExpenseSnapshots.put({
          ...existing,
          ...row,
          ...markPendingActiveRecord(existing, now),
          id,
          createdAt: row.createdAt ?? existing.createdAt ?? now,
          deletedAt: null,
        })
        changed += 1
        continue
      }

      await db.fixedExpenseSnapshots.add(
        buildCreatedSyncRecord(
          {
            ...row,
            createdAt: row.createdAt ?? now,
            updatedAt: now,
          },
          now,
        ) as FixedExpenseSnapshot,
      )
      changed += 1
    }

    return changed
  })
}

export async function deleteSnapshotsForYear(year: number): Promise<number> {
  const rows = await getSnapshotsForYear(year)
  if (rows.length === 0) return 0
  const now = new Date().toISOString()
  await db.fixedExpenseSnapshots.bulkPut(
    rows
      .filter((row) => row.id != null)
      .map((row) => ({
        ...row,
        ...markDeletedSyncRecord(row, now),
        id: row.id as number,
      })),
  )
  return rows.length
}

interface FixedExpenseSnapshotNaturalKey {
  fixedExpenseId: number
  year: number
  month: number
}

export function deleteSnapshotsByNaturalKeys(
  keys: FixedExpenseSnapshotNaturalKey[],
): Promise<number> {
  return db.transaction('rw', db.fixedExpenseSnapshots, async () => {
    let deleted = 0
    const now = new Date().toISOString()
    for (const key of keys) {
      const existing = await db.fixedExpenseSnapshots
        .where('[fixedExpenseId+year+month]')
        .equals([key.fixedExpenseId, key.year, key.month])
        .first()
      if (!existing || existing.id == null || existing.deletedAt != null) continue
      await db.fixedExpenseSnapshots.put({
        ...existing,
        ...markDeletedSyncRecord(existing, now),
        id: existing.id,
      })
      deleted += 1
    }
    return deleted
  })
}
