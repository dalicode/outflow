import type { Schedule, SyncQueueItem } from '../../types'
import db from '../db/schema'

const enqueue = (
  table: string,
  operation: SyncQueueItem['operation'],
  payload: Record<string, unknown>,
) => db.syncQueue.add({ table, operation, payload, timestamp: Date.now() })

function compareScheduleDates(aYear: number, aMonth: number, bYear: number, bMonth: number) {
  if (aYear !== bYear) return aYear - bYear
  return aMonth - bMonth
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
  const existing = await db.incomeSnapshots.where({ year, month }).first()
  if (existing) {
    await db.incomeSnapshots.update(existing.id as number, {
      amountSnapshot: amount,
    })
    const updated = await db.incomeSnapshots.get(existing.id as number)
    await enqueue('incomeSnapshots', 'update', updated as unknown as Record<string, unknown>)
  } else {
    const id = await db.incomeSnapshots.add({
      year,
      month,
      amountSnapshot: amount,
      createdAt: new Date().toISOString(),
    })
    const row = await db.incomeSnapshots.get(id)
    await enqueue('incomeSnapshots', 'insert', row as unknown as Record<string, unknown>)
  }
}

async function snapshotSavings(year: number, month: number, rate: number) {
  const existing = await db.savingsSnapshots.where({ year, month }).first()
  if (existing) {
    await db.savingsSnapshots.update(existing.id as number, {
      rateSnapshot: rate,
    })
    const updated = await db.savingsSnapshots.get(existing.id as number)
    await enqueue('savingsSnapshots', 'update', updated as unknown as Record<string, unknown>)
  } else {
    const id = await db.savingsSnapshots.add({
      year,
      month,
      rateSnapshot: rate,
      createdAt: new Date().toISOString(),
    })
    const row = await db.savingsSnapshots.get(id)
    await enqueue('savingsSnapshots', 'insert', row as unknown as Record<string, unknown>)
  }
}

export {
  enqueue,
  compareScheduleDates,
  isBeforeMonth,
  isBeforeOrEqualMonth,
  resolveScheduleValueForMonth,
  snapshotIncome,
  snapshotSavings,
}
