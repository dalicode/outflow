import type {
  Expense,
  FixedExpense,
  FixedExpenseSnapshot,
  IncomeSnapshot,
  SavingsSnapshot,
  Schedule,
  ScheduleMaterializationNotice,
  SyncedSettingRow,
} from '../../types'
import { buildScheduleMaterializationNotice } from '../../utils/scheduleNotificationUtils'
import db from '../db/schema'
import {
  buildCreatedSyncRecord,
  compareScheduleDates,
  filterActiveRows,
  isBeforeOrEqualMonth,
  markPendingActiveRecord,
  resolveScheduleValueForMonth,
} from './common'

async function upsertSettingRow(key: string, value: unknown, now: string): Promise<void> {
  const existing = await db.settings.get(key)
  if (existing) {
    await db.settings.put({
      ...existing,
      ...markPendingActiveRecord(existing, now),
      key,
      value,
      updatedAt: now,
      deletedAt: null,
    })
    return
  }

  await db.settings.put(
    buildCreatedSyncRecord(
      {
        key,
        value,
        updatedAt: now,
      },
      now,
    ) as SyncedSettingRow,
  )
}

async function updateSchedulePending(
  scheduleId: number,
  changes: Partial<Schedule>,
  now: string,
): Promise<void> {
  const existing = await db.schedules.get(scheduleId)
  if (!existing) return
  await db.schedules.put({
    ...existing,
    ...markPendingActiveRecord(existing, now),
    ...changes,
    id: scheduleId,
  })
}

export async function getAllSchedules(): Promise<Schedule[]> {
  return db.schedules.toArray()
}

export async function getSchedules(): Promise<Schedule[]> {
  return filterActiveRows(await getAllSchedules())
}

export async function getActiveSchedules(): Promise<Schedule[]> {
  return (await getSchedules()).filter((schedule) => schedule.isActive === 1)
}

export async function addSchedule(
  schedule: Omit<Schedule, 'id' | 'isActive' | 'createdAt'>,
): Promise<number> {
  const now = new Date().toISOString()
  return db.schedules.add(
    buildCreatedSyncRecord(
      {
        ...schedule,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      },
      now,
    ) as Schedule,
  )
}

export async function updateSchedule(id: number, changes: Partial<Schedule>): Promise<void> {
  await updateSchedulePending(id, changes, new Date().toISOString())
}

export async function deleteSchedule(id: number): Promise<void> {
  const now = new Date().toISOString()
  await updateSchedulePending(id, { isActive: 0, deletedAt: now }, now)
}

// ── Schedule Materialization ──────────────────────────────
// When a schedule's effective date arrives, execute it by updating the live
// values only. Historical snapshots are written on rollover, so the schedule
// stays active until its effective month has been committed into snapshots.

export async function materializePendingSnapshots(): Promise<ScheduleMaterializationNotice[]> {
  const now = new Date()
  const nowIso = now.toISOString()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

  const [schedules, categories, payees, fixedDefs, monthlyIncomeRow, savingsRateRow, noticeRow] =
    await Promise.all([
      getActiveSchedules(),
      db.categories.toArray(),
      db.payees.toArray(),
      db.fixedExpenses.toArray(),
      db.settings.get('monthlyIncome'),
      db.settings.get('savingsRate'),
      db.settings.get('scheduleMaterializationLog'),
    ])
  const activeCategories = filterActiveRows(categories)
  const activePayees = filterActiveRows(payees)
  const activeCategoryNameById = new Map<number, string>(
    activeCategories
      .filter(
        (category): category is { id: number; name: string } =>
          typeof category.id === 'number' && typeof category.name === 'string',
      )
      .map((category) => [category.id, category.name]),
  )
  const activePayeeNameById = new Map<number, string>(
    activePayees
      .filter(
        (payee): payee is { id: number; name: string } =>
          typeof payee.id === 'number' && typeof payee.name === 'string',
      )
      .map((payee) => [payee.id, payee.name]),
  )
  const activeFixedDefs = filterActiveRows(fixedDefs)
  const fixedDefMap = new Map<number, FixedExpense>(
    activeFixedDefs
      .filter((fixed): fixed is FixedExpense & { id: number } => typeof fixed.id === 'number')
      .map((fixed) => [fixed.id, fixed]),
  )
  let liveIncome =
    monthlyIncomeRow?.deletedAt == null ? ((monthlyIncomeRow?.value as number) ?? 0) : 0
  let liveSavingsRate =
    savingsRateRow?.deletedAt == null ? ((savingsRateRow?.value as number) ?? 0) : 0
  const existingNoticeLog =
    noticeRow?.deletedAt == null && Array.isArray(noticeRow?.value)
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
    if (schedule.id == null) continue

    if (schedule.type === 'income') {
      const firstMaterialization = schedule.previousValue == null || schedule.materializedAt == null
      if (firstMaterialization) {
        await updateSchedulePending(
          schedule.id,
          { previousValue: liveIncome, materializedAt: currentKey },
          nowIso,
        )
        newNotices.push(
          buildScheduleMaterializationNotice(schedule, {
            appliedAt: nowIso,
            previousValue: liveIncome,
          }),
        )
      }
      liveIncome = schedule.newValue
      await upsertSettingRow('monthlyIncome', liveIncome, nowIso)
      await upsertSettingRow(
        'monthlyIncomeUpdatedAt',
        `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, '0')}`,
        nowIso,
      )
    } else if (schedule.type === 'savingsRate') {
      const firstMaterialization = schedule.previousValue == null || schedule.materializedAt == null
      if (firstMaterialization) {
        await updateSchedulePending(
          schedule.id,
          { previousValue: liveSavingsRate, materializedAt: currentKey },
          nowIso,
        )
        newNotices.push(
          buildScheduleMaterializationNotice(schedule, {
            appliedAt: nowIso,
            previousValue: liveSavingsRate,
          }),
        )
      }
      liveSavingsRate = schedule.newValue
      await upsertSettingRow('savingsRate', liveSavingsRate, nowIso)
      await upsertSettingRow(
        'savingsRateUpdatedAt',
        `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, '0')}`,
        nowIso,
      )
    } else if (schedule.type === 'fixedExpense' && schedule.targetId != null) {
      const def = fixedDefMap.get(schedule.targetId)
      const firstMaterialization = schedule.previousValue == null || schedule.materializedAt == null
      if (firstMaterialization) {
        await updateSchedulePending(
          schedule.id,
          { previousValue: def?.amount ?? 0, materializedAt: currentKey },
          nowIso,
        )
        newNotices.push(
          buildScheduleMaterializationNotice(schedule, {
            appliedAt: nowIso,
            previousValue: def?.amount ?? 0,
            label: def?.name ?? 'Fixed expense',
          }),
        )
      }

      if (def && def.id != null) {
        const nextDef: FixedExpense = {
          ...def,
          ...markPendingActiveRecord(def, nowIso),
          id: def.id,
          amount: schedule.newValue,
          updatedAt: nowIso,
        }
        await db.fixedExpenses.put(nextDef)
        fixedDefMap.set(def.id, nextDef)
      }
    } else if (schedule.type === 'expense') {
      const day = schedule.day ?? 1
      const date = `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const categoryNameSnapshot =
        typeof schedule.categoryId === 'number'
          ? (activeCategoryNameById.get(schedule.categoryId) ?? null)
          : null
      const payeeNameSnapshot =
        typeof schedule.payeeId === 'number'
          ? (activePayeeNameById.get(schedule.payeeId) ?? null)
          : null
      await db.expenses.add(
        buildCreatedSyncRecord(
          {
            date,
            amount: schedule.newValue,
            categoryId: schedule.categoryId,
            payeeId: schedule.payeeId,
            categoryNameSnapshot,
            payeeNameSnapshot,
            description: schedule.note,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          nowIso,
        ) as Expense,
      )
      newNotices.push(
        buildScheduleMaterializationNotice(schedule, {
          appliedAt: nowIso,
          label: schedule.note?.trim() || 'Planned expense',
        }),
      )
      await updateSchedulePending(schedule.id, { isActive: 0 }, nowIso)
    }
  }

  if (newNotices.length > 0) {
    const mergedLog = [...newNotices, ...existingNoticeLog].slice(0, 20)
    await upsertSettingRow('scheduleMaterializationLog', mergedLog, nowIso)
  }

  return newNotices
}

// ── Monthly Snapshot Rollover ─────────────────────────────
// When the app opens in a new month, automatically create snapshots
// for any past gap months using the live values that are in effect at rollover time.
// This backfills missed months so later live edits do not retroactively change them.

export async function rolloverSnapshots() {
  const now = new Date()
  const nowIso = now.toISOString()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

  const lastOpenRow = await db.settings.get('lastAppOpenMonthKey')
  const lastOpenKey =
    lastOpenRow?.deletedAt == null ? (lastOpenRow?.value as string | undefined) : undefined

  // First-time: initialize without rollover
  if (!lastOpenKey) {
    await upsertSettingRow('lastAppOpenMonthKey', currentKey, nowIso)
    return
  }

  // Backward time travel guard
  if (lastOpenKey >= currentKey) {
    await upsertSettingRow('lastAppOpenMonthKey', currentKey, nowIso)
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
    await upsertSettingRow('lastAppOpenMonthKey', currentKey, nowIso)
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
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }

  if (gapMonths.length === 0) {
    await upsertSettingRow('lastAppOpenMonthKey', currentKey, nowIso)
    return
  }

  // Load data
  const [
    allFixedDefs,
    allIncomeSnaps,
    allSavingsSnaps,
    allFixedSnaps,
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
    getActiveSchedules(),
  ])

  const activeFixed = filterActiveRows(allFixedDefs).filter((row) => row.isArchived !== true)
  const incomeSnaps = filterActiveRows(allIncomeSnaps)
  const savingsSnaps = filterActiveRows(allSavingsSnaps)
  const fixedSnaps = filterActiveRows(allFixedSnaps)
  const globalIncome =
    globalIncomeRow?.deletedAt == null ? ((globalIncomeRow?.value as number) ?? 0) : 0
  const globalRate = globalRateRow?.deletedAt == null ? ((globalRateRow?.value as number) ?? 0) : 0

  const incomeToAdd: IncomeSnapshot[] = []
  const savingsToAdd: SavingsSnapshot[] = []
  const fixedToAdd: FixedExpenseSnapshot[] = []
  const scheduleUpdates: Schedule[] = []

  for (const { year, month } of gapMonths) {
    const hasIncome = incomeSnaps.some(
      (snapshot) => snapshot.year === year && snapshot.month === month,
    )
    if (!hasIncome) {
      incomeToAdd.push(
        buildCreatedSyncRecord(
          {
            year,
            month,
            amountSnapshot: resolveScheduleValueForMonth(
              activeSchedules,
              year,
              month,
              globalIncome,
              'income',
            ),
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          nowIso,
        ) as IncomeSnapshot,
      )
    }

    const hasSavings = savingsSnaps.some(
      (snapshot) => snapshot.year === year && snapshot.month === month,
    )
    if (!hasSavings) {
      savingsToAdd.push(
        buildCreatedSyncRecord(
          {
            year,
            month,
            rateSnapshot: resolveScheduleValueForMonth(
              activeSchedules,
              year,
              month,
              globalRate,
              'savingsRate',
            ),
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          nowIso,
        ) as SavingsSnapshot,
      )
    }

    for (const def of activeFixed) {
      if (!def.id) continue
      const hasFixed = fixedSnaps.some(
        (snapshot) =>
          snapshot.fixedExpenseId === def.id && snapshot.year === year && snapshot.month === month,
      )
      if (!hasFixed) {
        fixedToAdd.push(
          buildCreatedSyncRecord(
            {
              fixedExpenseId: def.id,
              nameSnapshot: def.name,
              amountSnapshot: resolveScheduleValueForMonth(
                activeSchedules,
                year,
                month,
                def.amount,
                'fixedExpense',
                def.id,
              ),
              year,
              month,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            nowIso,
          ) as FixedExpenseSnapshot,
        )
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
    [db.incomeSnapshots, db.savingsSnapshots, db.fixedExpenseSnapshots, db.schedules, db.settings],
    async () => {
      if (incomeToAdd.length > 0) await db.incomeSnapshots.bulkAdd(incomeToAdd)
      if (savingsToAdd.length > 0) await db.savingsSnapshots.bulkAdd(savingsToAdd)
      if (fixedToAdd.length > 0) await db.fixedExpenseSnapshots.bulkAdd(fixedToAdd)

      const uniqueScheduleIds = new Set(
        scheduleUpdates
          .filter((schedule) => schedule.id != null)
          .map((schedule) => schedule.id as number),
      )
      for (const scheduleId of uniqueScheduleIds) {
        await updateSchedulePending(scheduleId, { isActive: 0 }, nowIso)
      }

      await upsertSettingRow('lastAppOpenMonthKey', currentKey, nowIso)
    },
  )
}
