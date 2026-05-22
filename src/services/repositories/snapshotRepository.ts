import type { IncomeSnapshot, SavingsSnapshot } from '../../types'
import db from '../db/schema'
import { enqueue, snapshotIncome, snapshotSavings } from './common'

export async function getIncomeSnapshot(year: number, month: number): Promise<number | null> {
  const row = await db.incomeSnapshots.where({ year, month }).first()
  return row ? row.amountSnapshot : null
}

export const setIncomeSnapshot = snapshotIncome

export async function getIncomeSnapshotsForYear(year: number): Promise<IncomeSnapshot[]> {
  return db.incomeSnapshots.where('year').equals(year).toArray()
}

export async function getAllIncomeSnapshots(): Promise<IncomeSnapshot[]> {
  return db.incomeSnapshots.toArray()
}

export function bulkUpsertIncomeSnapshots(rows: IncomeSnapshot[]): Promise<number> {
  return db.transaction('rw', db.incomeSnapshots, db.syncQueue, async () => {
    const now = new Date().toISOString()
    let changed = 0

    for (const row of rows) {
      const existing = await db.incomeSnapshots
        .where('[year+month]')
        .equals([row.year, row.month])
        .first()

      if (existing) {
        const id = existing.id as number
        await db.incomeSnapshots.put({
          ...existing,
          ...row,
          id,
          cloudId: row.cloudId ?? existing.cloudId,
          createdAt: row.createdAt ?? existing.createdAt,
          updatedAt: now,
        })
        const updated = await db.incomeSnapshots.get(id)
        await enqueue('incomeSnapshots', 'update', updated as unknown as Record<string, unknown>)
        changed += 1
        continue
      }

      const id = await db.incomeSnapshots.add({
        ...row,
        cloudId: row.cloudId ?? crypto.randomUUID(),
        createdAt: row.createdAt ?? now,
        updatedAt: now,
      })
      const inserted = await db.incomeSnapshots.get(id)
      await enqueue('incomeSnapshots', 'insert', inserted as unknown as Record<string, unknown>)
      changed += 1
    }

    return changed
  })
}

export function deleteIncomeSnapshotsForYear(year: number): Promise<number> {
  return db.incomeSnapshots.where('year').equals(year).delete()
}

interface IncomeSnapshotNaturalKey {
  year: number
  month: number
}

export function deleteIncomeSnapshotsByNaturalKeys(
  keys: IncomeSnapshotNaturalKey[],
): Promise<number> {
  return db.transaction('rw', db.incomeSnapshots, db.syncQueue, async () => {
    let deleted = 0
    for (const key of keys) {
      const existing = await db.incomeSnapshots
        .where('[year+month]')
        .equals([key.year, key.month])
        .first()
      if (!existing || existing.id == null) continue
      await db.incomeSnapshots.delete(existing.id)
      await enqueue('incomeSnapshots', 'delete', {
        id: existing.id,
        cloudId: existing.cloudId,
      })
      deleted += 1
    }
    return deleted
  })
}

export async function getSavingsSnapshot(year: number, month: number): Promise<number | null> {
  const row = await db.savingsSnapshots.where({ year, month }).first()
  return row ? row.rateSnapshot : null
}

export const setSavingsSnapshot = snapshotSavings

export async function getSavingsSnapshotsForYear(year: number): Promise<SavingsSnapshot[]> {
  return db.savingsSnapshots.where('year').equals(year).toArray()
}

export async function getAllSavingsSnapshots(): Promise<SavingsSnapshot[]> {
  return db.savingsSnapshots.toArray()
}

export function bulkUpsertSavingsSnapshots(rows: SavingsSnapshot[]): Promise<number> {
  return db.transaction('rw', db.savingsSnapshots, db.syncQueue, async () => {
    const now = new Date().toISOString()
    let changed = 0

    for (const row of rows) {
      const existing = await db.savingsSnapshots
        .where('[year+month]')
        .equals([row.year, row.month])
        .first()

      if (existing) {
        const id = existing.id as number
        await db.savingsSnapshots.put({
          ...existing,
          ...row,
          id,
          cloudId: row.cloudId ?? existing.cloudId,
          createdAt: row.createdAt ?? existing.createdAt,
          updatedAt: now,
        })
        const updated = await db.savingsSnapshots.get(id)
        await enqueue('savingsSnapshots', 'update', updated as unknown as Record<string, unknown>)
        changed += 1
        continue
      }

      const id = await db.savingsSnapshots.add({
        ...row,
        cloudId: row.cloudId ?? crypto.randomUUID(),
        createdAt: row.createdAt ?? now,
        updatedAt: now,
      })
      const inserted = await db.savingsSnapshots.get(id)
      await enqueue('savingsSnapshots', 'insert', inserted as unknown as Record<string, unknown>)
      changed += 1
    }

    return changed
  })
}

export function deleteSavingsSnapshotsForYear(year: number): Promise<number> {
  return db.savingsSnapshots.where('year').equals(year).delete()
}

interface SavingsSnapshotNaturalKey {
  year: number
  month: number
}

export function deleteSavingsSnapshotsByNaturalKeys(
  keys: SavingsSnapshotNaturalKey[],
): Promise<number> {
  return db.transaction('rw', db.savingsSnapshots, db.syncQueue, async () => {
    let deleted = 0
    for (const key of keys) {
      const existing = await db.savingsSnapshots
        .where('[year+month]')
        .equals([key.year, key.month])
        .first()
      if (!existing || existing.id == null) continue
      await db.savingsSnapshots.delete(existing.id)
      await enqueue('savingsSnapshots', 'delete', {
        id: existing.id,
        cloudId: existing.cloudId,
      })
      deleted += 1
    }
    return deleted
  })
}
