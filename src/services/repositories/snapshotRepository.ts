import type { IncomeSnapshot, SavingsSnapshot } from '../../types'
import db from '../db/schema'
import {
  buildCreatedSyncRecord,
  filterActiveRows,
  markDeletedSyncRecord,
  markPendingActiveRecord,
  snapshotIncome,
  snapshotSavings,
} from './common'

export async function getIncomeSnapshot(year: number, month: number): Promise<number | null> {
  const rows = await db.incomeSnapshots.where({ year, month }).toArray()
  const row = rows.find((entry) => entry.deletedAt == null)
  return row ? row.amountSnapshot : null
}

export const setIncomeSnapshot = snapshotIncome

export async function getAllIncomeSnapshotsForYear(year: number): Promise<IncomeSnapshot[]> {
  return db.incomeSnapshots.where('year').equals(year).toArray()
}

export async function getIncomeSnapshotsForYear(year: number): Promise<IncomeSnapshot[]> {
  return filterActiveRows(await getAllIncomeSnapshotsForYear(year))
}

export async function getAllIncomeSnapshots(): Promise<IncomeSnapshot[]> {
  return db.incomeSnapshots.toArray()
}

export async function getIncomeSnapshots(): Promise<IncomeSnapshot[]> {
  return filterActiveRows(await getAllIncomeSnapshots())
}

export function bulkUpsertIncomeSnapshots(rows: IncomeSnapshot[]): Promise<number> {
  return db.transaction('rw', db.incomeSnapshots, async () => {
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
          ...markPendingActiveRecord(existing, now),
          id,
          createdAt: row.createdAt ?? existing.createdAt ?? now,
          deletedAt: null,
        })
        changed += 1
        continue
      }

      await db.incomeSnapshots.add(
        buildCreatedSyncRecord(
          {
            ...row,
            createdAt: row.createdAt ?? now,
            updatedAt: now,
          },
          now,
        ) as IncomeSnapshot,
      )
      changed += 1
    }

    return changed
  })
}

export async function deleteIncomeSnapshotsForYear(year: number): Promise<number> {
  const rows = await getIncomeSnapshotsForYear(year)
  if (rows.length === 0) return 0
  const now = new Date().toISOString()
  await db.incomeSnapshots.bulkPut(
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

interface IncomeSnapshotNaturalKey {
  year: number
  month: number
}

export function deleteIncomeSnapshotsByNaturalKeys(
  keys: IncomeSnapshotNaturalKey[],
): Promise<number> {
  return db.transaction('rw', db.incomeSnapshots, async () => {
    let deleted = 0
    const now = new Date().toISOString()
    for (const key of keys) {
      const existing = await db.incomeSnapshots
        .where('[year+month]')
        .equals([key.year, key.month])
        .first()
      if (!existing || existing.id == null || existing.deletedAt != null) continue
      await db.incomeSnapshots.put({
        ...existing,
        ...markDeletedSyncRecord(existing, now),
        id: existing.id,
      })
      deleted += 1
    }
    return deleted
  })
}

export async function getSavingsSnapshot(year: number, month: number): Promise<number | null> {
  const rows = await db.savingsSnapshots.where({ year, month }).toArray()
  const row = rows.find((entry) => entry.deletedAt == null)
  return row ? row.rateSnapshot : null
}

export const setSavingsSnapshot = snapshotSavings

export async function getAllSavingsSnapshotsForYear(year: number): Promise<SavingsSnapshot[]> {
  return db.savingsSnapshots.where('year').equals(year).toArray()
}

export async function getSavingsSnapshotsForYear(year: number): Promise<SavingsSnapshot[]> {
  return filterActiveRows(await getAllSavingsSnapshotsForYear(year))
}

export async function getAllSavingsSnapshots(): Promise<SavingsSnapshot[]> {
  return db.savingsSnapshots.toArray()
}

export async function getSavingsSnapshots(): Promise<SavingsSnapshot[]> {
  return filterActiveRows(await getAllSavingsSnapshots())
}

export function bulkUpsertSavingsSnapshots(rows: SavingsSnapshot[]): Promise<number> {
  return db.transaction('rw', db.savingsSnapshots, async () => {
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
          ...markPendingActiveRecord(existing, now),
          id,
          createdAt: row.createdAt ?? existing.createdAt ?? now,
          deletedAt: null,
        })
        changed += 1
        continue
      }

      await db.savingsSnapshots.add(
        buildCreatedSyncRecord(
          {
            ...row,
            createdAt: row.createdAt ?? now,
            updatedAt: now,
          },
          now,
        ) as SavingsSnapshot,
      )
      changed += 1
    }

    return changed
  })
}

export async function deleteSavingsSnapshotsForYear(year: number): Promise<number> {
  const rows = await getSavingsSnapshotsForYear(year)
  if (rows.length === 0) return 0
  const now = new Date().toISOString()
  await db.savingsSnapshots.bulkPut(
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

interface SavingsSnapshotNaturalKey {
  year: number
  month: number
}

export function deleteSavingsSnapshotsByNaturalKeys(
  keys: SavingsSnapshotNaturalKey[],
): Promise<number> {
  return db.transaction('rw', db.savingsSnapshots, async () => {
    let deleted = 0
    const now = new Date().toISOString()
    for (const key of keys) {
      const existing = await db.savingsSnapshots
        .where('[year+month]')
        .equals([key.year, key.month])
        .first()
      if (!existing || existing.id == null || existing.deletedAt != null) continue
      await db.savingsSnapshots.put({
        ...existing,
        ...markDeletedSyncRecord(existing, now),
        id: existing.id,
      })
      deleted += 1
    }
    return deleted
  })
}
