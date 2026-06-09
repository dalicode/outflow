import type { IncomeSnapshot, SavingsSnapshot, Schedule, SyncedRecord } from '../../types'
import { createSyncMetadata, markRecordDeleted, markRecordPending } from '../../utils/syncMetadata'
import db from '../db/schema'

type TombstoneRecord = {
  deletedAt?: string | null
}

function filterActiveRows<T extends TombstoneRecord>(rows: T[]): T[] {
  return rows.filter((row) => row.deletedAt == null)
}

function markPendingActiveRecord<T extends SyncedRecord>(
  record: T,
  now: string = new Date().toISOString(),
): T {
  return {
    ...markRecordPending(record, now),
    deletedAt: null,
  } as T
}

function markDeletedSyncRecord<T extends SyncedRecord>(
  record: T,
  now: string = new Date().toISOString(),
): T {
  return markRecordDeleted(record, now) as T
}

function buildCreatedSyncRecord<T extends Record<string, unknown>>(
  record: T,
  now: string = new Date().toISOString(),
): T {
  return {
    ...createSyncMetadata(now),
    ...record,
  } as T
}

function compareScheduleDates(aYear: number, aMonth: number, bYear: number, bMonth: number) {
  if (aYear !== bYear) return aYear - bYear
  return aMonth - bMonth
}

function getLocalDayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

function isScheduleDueOnDate(schedule: Schedule, date: Date = new Date()): boolean {
  const currentYear = date.getFullYear()
  const currentMonth = date.getMonth() + 1

  if (schedule.effectiveYear < currentYear) return true
  if (schedule.effectiveYear > currentYear) return false
  if (schedule.effectiveMonth < currentMonth) return true
  if (schedule.effectiveMonth > currentMonth) return false

  if (schedule.type !== 'expense') return true

  const effectiveDay = schedule.day ?? 1
  return effectiveDay <= date.getDate()
}

function isBeforeMonth(year: number, month: number, refYear: number, refMonth: number) {
  return year < refYear || (year === refYear && month < refMonth)
}

function isBeforeOrEqualMonth(year: number, month: number, refYear: number, refMonth: number) {
  return year < refYear || (year === refYear && month <= refMonth)
}

function resolveScheduleValueForMonth(
  schedules: Schedule[],
  targetYear: number,
  targetMonth: number,
  fallbackValue: number,
  type: Schedule['type'],
  targetId: number | null = null,
): number {
  const relevant = schedules
    .filter((schedule) => schedule.isActive === 1 && schedule.type === type)
    .filter((schedule) => targetId == null || schedule.targetId === targetId)
    .sort((a, b) =>
      compareScheduleDates(a.effectiveYear, a.effectiveMonth, b.effectiveYear, b.effectiveMonth),
    )

  if (relevant.length === 0) return fallbackValue

  const applied = relevant.filter((schedule) =>
    isBeforeOrEqualMonth(schedule.effectiveYear, schedule.effectiveMonth, targetYear, targetMonth),
  )

  if (applied.length > 0) {
    const base = applied[0].previousValue ?? fallbackValue
    return applied.reduce((_value, schedule) => schedule.newValue, base)
  }

  const nextSchedule = relevant.find((schedule) =>
    isBeforeMonth(targetYear, targetMonth, schedule.effectiveYear, schedule.effectiveMonth),
  )

  return nextSchedule?.previousValue ?? fallbackValue
}

async function snapshotIncome(year: number, month: number, amount: number) {
  const now = new Date().toISOString()
  const existing = (await db.incomeSnapshots.where({ year, month }).toArray()).find(
    (row) => row.deletedAt == null,
  )
  if (existing) {
    await db.incomeSnapshots.update(existing.id as number, {
      ...markPendingActiveRecord(existing, now),
      amountSnapshot: amount,
    })
  } else {
    const row: Omit<IncomeSnapshot, 'id'> = buildCreatedSyncRecord(
      {
        year,
        month,
        amountSnapshot: amount,
      },
      now,
    )
    await db.incomeSnapshots.add({
      ...row,
      year,
      month,
    })
  }
}

async function snapshotSavings(year: number, month: number, rate: number) {
  const now = new Date().toISOString()
  const existing = (await db.savingsSnapshots.where({ year, month }).toArray()).find(
    (row) => row.deletedAt == null,
  )
  if (existing) {
    await db.savingsSnapshots.update(existing.id as number, {
      ...markPendingActiveRecord(existing, now),
      rateSnapshot: rate,
    })
  } else {
    const row: Omit<SavingsSnapshot, 'id'> = buildCreatedSyncRecord(
      {
        year,
        month,
        rateSnapshot: rate,
      },
      now,
    )
    await db.savingsSnapshots.add(row)
  }
}

export {
  compareScheduleDates,
  buildCreatedSyncRecord,
  filterActiveRows,
  getLocalDayKey,
  isScheduleDueOnDate,
  isBeforeMonth,
  isBeforeOrEqualMonth,
  markDeletedSyncRecord,
  markPendingActiveRecord,
  resolveScheduleValueForMonth,
  snapshotIncome,
  snapshotSavings,
}
