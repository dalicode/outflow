import type { IncomeSnapshot, SavingsSnapshot } from '../../types'
import db from '../db/schema'
import { snapshotIncome, snapshotSavings } from './common'

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
  return db.transaction('rw', db.incomeSnapshots, async () => {
    const upsertRows: IncomeSnapshot[] = []
    for (const row of rows) {
      const existing = await db.incomeSnapshots
        .where('[year+month]')
        .equals([row.year, row.month])
        .first()
      upsertRows.push(existing ? { ...row, id: existing.id } : row)
    }
    return db.incomeSnapshots.bulkPut(upsertRows)
  })
}

export function deleteIncomeSnapshotsForYear(year: number): Promise<number> {
  return db.incomeSnapshots.where('year').equals(year).delete()
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
  return db.transaction('rw', db.savingsSnapshots, async () => {
    const upsertRows: SavingsSnapshot[] = []
    for (const row of rows) {
      const existing = await db.savingsSnapshots
        .where('[year+month]')
        .equals([row.year, row.month])
        .first()
      upsertRows.push(existing ? { ...row, id: existing.id } : row)
    }
    return db.savingsSnapshots.bulkPut(upsertRows)
  })
}

export function deleteSavingsSnapshotsForYear(year: number): Promise<number> {
  return db.savingsSnapshots.where('year').equals(year).delete()
}
