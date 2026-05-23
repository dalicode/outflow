import type { Schedule } from '../types'

function compareMonthKey(schedule: Schedule, year: number, month: number): number {
  if (schedule.effectiveYear !== year) return schedule.effectiveYear - year
  return schedule.effectiveMonth - month
}

function isMaterializedActiveScheduleHidden(
  schedule: Schedule,
  year: number,
  month: number,
): boolean {
  return (
    schedule.isActive === 1 &&
    schedule.materializedAt != null &&
    compareMonthKey(schedule, year, month) <= 0
  )
}

export function partitionSchedulesForList(
  schedules: Schedule[],
  now: Date = new Date(),
): {
  upcoming: Schedule[]
  archived: Schedule[]
} {
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const upcoming = schedules
    .filter((schedule) => schedule.isActive === 1)
    .filter((schedule) => !isMaterializedActiveScheduleHidden(schedule, year, month))
    .sort((a, b) => a.effectiveYear - b.effectiveYear || a.effectiveMonth - b.effectiveMonth)

  const archived = schedules
    .filter((schedule) => schedule.isActive === 0)
    .sort((a, b) => b.effectiveYear - a.effectiveYear || b.effectiveMonth - a.effectiveMonth)

  return { upcoming, archived }
}
