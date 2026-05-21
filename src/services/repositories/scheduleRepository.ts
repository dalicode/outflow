import type { Schedule, ScheduleMaterializationNotice } from '../../types'
import { buildScheduleMaterializationNotice } from '../../utils/scheduleNotificationUtils'
import db from '../db/schema'
import {
  enqueue,
  compareScheduleDates,
  isBeforeOrEqualMonth,
  resolveScheduleValueForMonth,
} from './common'

function makeSettingRow(
  key: string,
  value: unknown,
): { key: string; value: unknown; updatedAt: string } {
  return {
    key,
    value,
    updatedAt: new Date().toISOString(),
  }
}

export async function getSchedules(): Promise<Schedule[]> {
  return db.schedules.toArray()
}

export async function getActiveSchedules(): Promise<Schedule[]> {
  return db.schedules.where('isActive').equals(1).toArray()
}

export async function addSchedule(
  schedule: Omit<Schedule, 'id' | 'isActive' | 'createdAt'>,
): Promise<number> {
  const now = new Date().toISOString()
  const id = await db.schedules.add({
    ...schedule,
    cloudId: crypto.randomUUID(),
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  } as Schedule)
  const row = await db.schedules.get(id)
  await enqueue('schedules', 'insert', row as unknown as Record<string, unknown>)
  return id
}

export async function updateSchedule(id: number, changes: Partial<Schedule>): Promise<void> {
  await db.schedules.update(id, changes)
  const row = await db.schedules.get(id)
  await enqueue('schedules', 'update', row as unknown as Record<string, unknown>)
}

export async function deleteSchedule(id: number): Promise<void> {
  const schedule = await db.schedules.get(id)
  await db.schedules.delete(id)
  await enqueue('schedules', 'delete', { id, cloudId: schedule?.cloudId })
}

// ── Schedule Materialization ──────────────────────────────
// When a schedule's effective date arrives, execute it by updating the live
// values only. Historical snapshots are written on rollover, so the schedule
// stays active until its effective month has been committed into snapshots.

export async function materializePendingSnapshots(): Promise<ScheduleMaterializationNotice[]> {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

  const schedules = await db.schedules.where('isActive').equals(1).toArray()
  const fixedDefs = await db.fixedExpenses.toArray()
  const fixedDefMap = new Map(fixedDefs.map((f) => [f.id, f]))
  const monthlyIncomeRow = await db.settings.get('monthlyIncome')
  const savingsRateRow = await db.settings.get('savingsRate')
  const noticeRow = await db.settings.get('scheduleMaterializationLog')
  let liveIncome = (monthlyIncomeRow?.value as number) ?? 0
  let liveSavingsRate = (savingsRateRow?.value as number) ?? 0
  const existingNoticeLog = Array.isArray(noticeRow?.value)
    ? (noticeRow.value as ScheduleMaterializationNotice[])
    : []
  const newNotices: ScheduleMaterializationNotice[] = []

  const dueSchedules = [...schedules]
    .filter(
      (schedule) =>
        schedule.effectiveYear < currentYear ||
        (schedule.effectiveYear === currentYear && schedule.effectiveMonth <= currentMonth),
    )
    .sort((a, b) =>
      compareScheduleDates(a.effectiveYear, a.effectiveMonth, b.effectiveYear, b.effectiveMonth),
    )

  for (const schedule of dueSchedules) {
    if (schedule.type === 'income') {
      const firstMaterialization = schedule.previousValue == null || schedule.materializedAt == null
      if (firstMaterialization) {
        await db.schedules.update(schedule.id as number, {
          previousValue: liveIncome,
          materializedAt: currentKey,
        })
        newNotices.push(
          buildScheduleMaterializationNotice(schedule, {
            appliedAt: now.toISOString(),
            previousValue: liveIncome,
          }),
        )
      }
      liveIncome = schedule.newValue
      await db.settings.put(makeSettingRow('monthlyIncome', liveIncome))
      await db.settings.put(
        makeSettingRow(
          'monthlyIncomeUpdatedAt',
          `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, '0')}`,
        ),
      )
      await enqueue('settings', 'upsert', { key: 'monthlyIncome', value: liveIncome })
      await enqueue('settings', 'upsert', {
        key: 'monthlyIncomeUpdatedAt',
        value: `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, '0')}`,
      })
      const updatedSchedule = await db.schedules.get(schedule.id as number)
      await enqueue('schedules', 'update', updatedSchedule as unknown as Record<string, unknown>)
    } else if (schedule.type === 'savingsRate') {
      const firstMaterialization = schedule.previousValue == null || schedule.materializedAt == null
      if (firstMaterialization) {
        await db.schedules.update(schedule.id as number, {
          previousValue: liveSavingsRate,
          materializedAt: currentKey,
        })
        newNotices.push(
          buildScheduleMaterializationNotice(schedule, {
            appliedAt: now.toISOString(),
            previousValue: liveSavingsRate,
          }),
        )
      }
      liveSavingsRate = schedule.newValue
      await db.settings.put(makeSettingRow('savingsRate', liveSavingsRate))
      await db.settings.put(
        makeSettingRow(
          'savingsRateUpdatedAt',
          `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, '0')}`,
        ),
      )
      await enqueue('settings', 'upsert', { key: 'savingsRate', value: liveSavingsRate })
      await enqueue('settings', 'upsert', {
        key: 'savingsRateUpdatedAt',
        value: `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, '0')}`,
      })
      const updatedSchedule = await db.schedules.get(schedule.id as number)
      await enqueue('schedules', 'update', updatedSchedule as unknown as Record<string, unknown>)
    } else if (schedule.type === 'fixedExpense' && schedule.targetId != null) {
      const def = fixedDefMap.get(schedule.targetId)
      const firstMaterialization = schedule.previousValue == null || schedule.materializedAt == null
      if (firstMaterialization) {
        await db.schedules.update(schedule.id as number, {
          previousValue: def?.amount ?? 0,
          materializedAt: currentKey,
        })
        newNotices.push(
          buildScheduleMaterializationNotice(schedule, {
            appliedAt: now.toISOString(),
            previousValue: def?.amount ?? 0,
            label: def?.name ?? 'Fixed expense',
          }),
        )
      }
      if (def) {
        await db.fixedExpenses.update(schedule.targetId, {
          amount: schedule.newValue,
          updatedAt: now.toISOString(),
        })
        def.amount = schedule.newValue
        def.updatedAt = now.toISOString()
        const updatedDef = await db.fixedExpenses.get(schedule.targetId)
        await enqueue('fixedExpenses', 'update', updatedDef as unknown as Record<string, unknown>)
      }
      const updatedSchedule = await db.schedules.get(schedule.id as number)
      await enqueue('schedules', 'update', updatedSchedule as unknown as Record<string, unknown>)
    } else if (schedule.type === 'expense') {
      const day = schedule.day ?? 1
      const date = `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const expenseId = await db.expenses.add({
        cloudId: crypto.randomUUID(),
        date,
        amount: schedule.newValue,
        categoryId: schedule.categoryId,
        description: schedule.note,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      const expenseRow = await db.expenses.get(expenseId)
      await enqueue('expenses', 'insert', expenseRow as unknown as Record<string, unknown>)
      newNotices.push(
        buildScheduleMaterializationNotice(schedule, {
          appliedAt: now.toISOString(),
          label: schedule.note?.trim() || 'Planned expense',
        }),
      )
      await db.schedules.update(schedule.id as number, { isActive: 0 })
      const updatedSchedule = await db.schedules.get(schedule.id as number)
      await enqueue('schedules', 'update', updatedSchedule as unknown as Record<string, unknown>)
    }
  }

  if (newNotices.length > 0) {
    const mergedLog = [...newNotices, ...existingNoticeLog].slice(0, 20)
    await db.settings.put(makeSettingRow('scheduleMaterializationLog', mergedLog))
  }

  return newNotices
}

// ── Monthly Snapshot Rollover ─────────────────────────────
// When the app opens in a new month, automatically create snapshots
// for any past gap months using the live values that are in effect at rollover time.
// This backfills missed months so later live edits do not retroactively change them.

export async function rolloverSnapshots() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

  const lastOpenRow = await db.settings.get('lastAppOpenMonthKey')
  const lastOpenKey = lastOpenRow?.value as string | undefined

  // First-time: initialize without rollover
  if (!lastOpenKey) {
    await db.settings.put(makeSettingRow('lastAppOpenMonthKey', currentKey))
    await enqueue('settings', 'upsert', { key: 'lastAppOpenMonthKey', value: currentKey })
    return
  }

  // Backward time travel guard
  if (lastOpenKey >= currentKey) {
    await db.settings.put(makeSettingRow('lastAppOpenMonthKey', currentKey))
    await enqueue('settings', 'upsert', { key: 'lastAppOpenMonthKey', value: currentKey })
    return
  }

  // Parse last open month and validate format
  const [lastYearStr, lastMonthStr] = lastOpenKey.split('-')
  const lastYear = parseInt(lastYearStr, 10)
  const lastMonth = parseInt(lastMonthStr, 10)

  // Guard against corrupted value: skip rollover if date is in the future or malformed
  if (
    !Number.isFinite(lastYear) ||
    !Number.isFinite(lastMonth) ||
    lastMonth < 1 ||
    lastMonth > 12
  ) {
    await db.settings.put(makeSettingRow('lastAppOpenMonthKey', currentKey))
    await enqueue('settings', 'upsert', { key: 'lastAppOpenMonthKey', value: currentKey })
    return
  }

  // Build list of months to snapshot — includes the last open month and all
  // skipped months up to (but not including) the current month.
  const gapMonths: { year: number; month: number }[] = []
  let y = lastYear
  let m = lastMonth
  let iterationGuard = 0
  while (true) {
    if (y === currentYear && m === currentMonth) break
    if (iterationGuard++ > 1200) break // safety cap: prevent infinite loop on corrupted data
    gapMonths.push({ year: y, month: m })
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }

  if (gapMonths.length === 0) {
    await db.settings.put(makeSettingRow('lastAppOpenMonthKey', currentKey))
    await enqueue('settings', 'upsert', { key: 'lastAppOpenMonthKey', value: currentKey })
    return
  }

  // Load data
  const [
    allFixedDefs,
    incomeSnaps,
    savingsSnaps,
    fixedSnaps,
    globalIncomeRow,
    globalRateRow,
    activeSchedules,
  ] = await Promise.all([
    db.fixedExpenses.toArray(),
    db.incomeSnapshots.toArray(),
    db.savingsSnapshots.toArray(),
    db.fixedExpenseSnapshots.toArray(),
    db.settings.get('monthlyIncome'),
    db.settings.get('savingsRate'),
    db.schedules.where('isActive').equals(1).toArray(),
  ])

  const activeFixed = allFixedDefs.filter((f) => f.isArchived !== true)
  const globalIncome = (globalIncomeRow?.value as number) ?? 0
  const globalRate = (globalRateRow?.value as number) ?? 0

  const incomeToAdd: {
    year: number
    month: number
    amountSnapshot: number
    createdAt: string
  }[] = []
  const savingsToAdd: {
    year: number
    month: number
    rateSnapshot: number
    createdAt: string
  }[] = []
  const fixedToAdd: {
    fixedExpenseId: number
    nameSnapshot: string
    amountSnapshot: number
    year: number
    month: number
    createdAt: string
  }[] = []
  const scheduleUpdates: Schedule[] = []

  for (const { year, month } of gapMonths) {
    const hasIncome = incomeSnaps.some((s) => s.year === year && s.month === month)
    if (!hasIncome) {
      incomeToAdd.push({
        cloudId: crypto.randomUUID(),
        year,
        month,
        amountSnapshot: resolveScheduleValueForMonth(
          activeSchedules,
          year,
          month,
          globalIncome,
          'income',
        ),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
    }

    const hasSavings = savingsSnaps.some((s) => s.year === year && s.month === month)
    if (!hasSavings) {
      savingsToAdd.push({
        cloudId: crypto.randomUUID(),
        year,
        month,
        rateSnapshot: resolveScheduleValueForMonth(
          activeSchedules,
          year,
          month,
          globalRate,
          'savingsRate',
        ),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
    }

    for (const def of activeFixed) {
      if (!def.id) continue
      const hasFixed = fixedSnaps.some(
        (s) => s.fixedExpenseId === def.id && s.year === year && s.month === month,
      )
      if (!hasFixed) {
        fixedToAdd.push({
          cloudId: crypto.randomUUID(),
          fixedExpenseId: def.id,
          nameSnapshot: def.name,
          amountSnapshot: resolveScheduleValueForMonth(
            activeSchedules,
            year,
            month,
            def.amount,
            'fixedExpense',
            def.id as number,
          ),
          year,
          month,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        })
      }
    }

    for (const schedule of activeSchedules) {
      if (
        schedule.id != null &&
        isBeforeOrEqualMonth(schedule.effectiveYear, schedule.effectiveMonth, year, month)
      ) {
        scheduleUpdates.push(schedule)
      }
    }
  }

  // Batch write everything in one transaction
  await db.transaction(
    'rw',
    [db.incomeSnapshots, db.savingsSnapshots, db.fixedExpenseSnapshots, db.settings, db.syncQueue],
    async () => {
      if (incomeToAdd.length) await db.incomeSnapshots.bulkAdd(incomeToAdd)
      if (savingsToAdd.length) await db.savingsSnapshots.bulkAdd(savingsToAdd)
      if (fixedToAdd.length) await db.fixedExpenseSnapshots.bulkAdd(fixedToAdd)
      for (const row of incomeToAdd) {
        await enqueue('incomeSnapshots', 'insert', row as unknown as Record<string, unknown>)
      }
      for (const row of savingsToAdd) {
        await enqueue('savingsSnapshots', 'insert', row as unknown as Record<string, unknown>)
      }
      for (const row of fixedToAdd) {
        await enqueue('fixedExpenseSnapshots', 'insert', row as unknown as Record<string, unknown>)
      }
      const uniqueScheduleIds = new Set(
        scheduleUpdates
          .filter((schedule) => schedule.id != null)
          .map((schedule) => schedule.id as number),
      )
      for (const scheduleId of uniqueScheduleIds) {
        await db.schedules.update(scheduleId, { isActive: 0 })
        const updatedSchedule = await db.schedules.get(scheduleId)
        await enqueue('schedules', 'update', updatedSchedule as unknown as Record<string, unknown>)
      }
      await db.settings.put(makeSettingRow('lastAppOpenMonthKey', currentKey))
      await enqueue('settings', 'upsert', { key: 'lastAppOpenMonthKey', value: currentKey })
    },
  )
}
