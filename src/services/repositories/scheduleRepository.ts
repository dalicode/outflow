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
  repairFixedSnapshotIdentitySplits,
  resolveHistoricalFixedExpenseIdForSnapshot,
} from './fixedSnapshotRepair'
import {
  buildCreatedSyncRecord,
  compareScheduleDates,
  filterActiveRows,
  getLocalDayKey,
  isBeforeOrEqualMonth,
  isScheduleDueOnDate,
  markDeletedSyncRecord,
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

type SnapshotRow = {
  id?: number
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
  localId?: string
  cloudId?: string | null
}

function getTimestampMs(value?: string): number {
  if (typeof value !== 'string' || value.length === 0) return Number.NEGATIVE_INFINITY
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

function compareSnapshotRows<T extends SnapshotRow>(a: T, b: T): number {
  const aActive = a.deletedAt == null ? 1 : 0
  const bActive = b.deletedAt == null ? 1 : 0
  if (aActive !== bActive) return bActive - aActive

  const aUpdatedAt = getTimestampMs(a.updatedAt)
  const bUpdatedAt = getTimestampMs(b.updatedAt)
  if (aUpdatedAt !== bUpdatedAt) return bUpdatedAt - aUpdatedAt

  const aCreatedAt = getTimestampMs(a.createdAt)
  const bCreatedAt = getTimestampMs(b.createdAt)
  if (aCreatedAt !== bCreatedAt) return bCreatedAt - aCreatedAt

  const aId = typeof a.id === 'number' ? a.id : Number.POSITIVE_INFINITY
  const bId = typeof b.id === 'number' ? b.id : Number.POSITIVE_INFINITY
  return aId - bId
}

function pickPreferredSnapshotRow<T extends SnapshotRow>(rows: T[]): T | undefined {
  if (rows.length === 0) return undefined
  return [...rows].sort(compareSnapshotRows)[0]
}

async function repairSnapshotRows<T extends SnapshotRow & Record<string, unknown>>(
  rows: T[],
  table: {
    put: (row: T) => Promise<unknown>
    add: (row: T) => Promise<unknown>
  },
  buildRow: (preferred: T | undefined) => T,
  nowIso: string,
): Promise<void> {
  const preferred = pickPreferredSnapshotRow(rows)

  if (!preferred) {
    await table.add(buildRow(undefined))
    return
  }

  const hasActivePreferred = preferred.deletedAt == null
  if (!hasActivePreferred) {
    await table.add(buildRow(undefined))
  }

  const duplicateRows = rows.filter((row) => row.id != null && row.id !== preferred.id)
  for (const duplicate of duplicateRows) {
    await table.put({
      ...duplicate,
      ...markDeletedSyncRecord(duplicate, nowIso),
      id: duplicate.id,
    })
  }
}

async function upsertIncomeSnapshot(
  year: number,
  month: number,
  amountSnapshot: number,
  nowIso: string,
): Promise<void> {
  const rows = (await db.incomeSnapshots.where('[year+month]').equals([year, month]).toArray()) as
    | Array<SnapshotRow & { year: number; month: number; amountSnapshot: number }>
    | []

  await repairSnapshotRows(
    rows,
    db.incomeSnapshots,
    (preferred) =>
      buildCreatedSyncRecord(
        {
          ...(preferred ?? {}),
          year,
          month,
          amountSnapshot,
          createdAt: preferred?.createdAt ?? nowIso,
          updatedAt: nowIso,
        },
        nowIso,
      ) as SnapshotRow & { year: number; month: number; amountSnapshot: number },
    nowIso,
  )
}

async function upsertSavingsSnapshot(
  year: number,
  month: number,
  rateSnapshot: number,
  nowIso: string,
): Promise<void> {
  const rows = (await db.savingsSnapshots.where('[year+month]').equals([year, month]).toArray()) as
    | Array<SnapshotRow & { year: number; month: number; rateSnapshot: number }>
    | []

  await repairSnapshotRows(
    rows,
    db.savingsSnapshots,
    (preferred) =>
      buildCreatedSyncRecord(
        {
          ...(preferred ?? {}),
          year,
          month,
          rateSnapshot,
          createdAt: preferred?.createdAt ?? nowIso,
          updatedAt: nowIso,
        },
        nowIso,
      ) as SnapshotRow & { year: number; month: number; rateSnapshot: number },
    nowIso,
  )
}

async function upsertFixedExpenseSnapshot(
  fixedExpenseId: number,
  year: number,
  month: number,
  amountSnapshot: number,
  nameSnapshot: string,
  nowIso: string,
): Promise<void> {
  const rows = (await db.fixedExpenseSnapshots
    .where('[fixedExpenseId+year+month]')
    .equals([fixedExpenseId, year, month])
    .toArray()) as Array<
    SnapshotRow & {
      fixedExpenseId: number
      year: number
      month: number
      amountSnapshot: number
      nameSnapshot: string
    }
  >

  await repairSnapshotRows(
    rows,
    db.fixedExpenseSnapshots,
    (preferred) =>
      buildCreatedSyncRecord(
        {
          ...(preferred ?? {}),
          fixedExpenseId,
          year,
          month,
          amountSnapshot,
          nameSnapshot,
          createdAt: preferred?.createdAt ?? nowIso,
          updatedAt: nowIso,
        },
        nowIso,
      ) as SnapshotRow & {
        fixedExpenseId: number
        year: number
        month: number
        amountSnapshot: number
        nameSnapshot: string
      },
    nowIso,
  )
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

export async function hasActiveUnmaterializedDueSchedule(
  date: Date = new Date(),
): Promise<boolean> {
  const schedules = await getActiveSchedules()
  return schedules.some((schedule) => {
    const hasMaterializedAt =
      typeof schedule.materializedAt === 'string' && schedule.materializedAt.length > 0
    return !hasMaterializedAt && isScheduleDueOnDate(schedule, date)
  })
}

// ── Schedule Materialization ──────────────────────────────
// When a schedule's effective date arrives, execute it by updating the live
// values only. Historical snapshots are written on rollover, so the schedule
// stays active until its effective month has been committed into snapshots.

export async function materializePendingSnapshots(): Promise<ScheduleMaterializationNotice[]> {
  const now = new Date()
  const nowIso = now.toISOString()
  const currentKey = getLocalDayKey(now).slice(0, 7)

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
    .filter((schedule) => isScheduleDueOnDate(schedule, now))
    .sort((a, b) =>
      compareScheduleDates(a.effectiveYear, a.effectiveMonth, b.effectiveYear, b.effectiveMonth),
    )

  await db.transaction(
    'rw',
    [db.schedules, db.settings, db.fixedExpenses, db.expenses],
    async () => {
      for (const schedule of dueSchedules) {
        if (schedule.id == null) continue

        if (schedule.type === 'income') {
          const hasPreviousValue = schedule.previousValue != null
          const hasMaterializedAt =
            typeof schedule.materializedAt === 'string' && schedule.materializedAt.length > 0
          const firstMaterialization = !hasPreviousValue && !hasMaterializedAt
          const scheduleChanges: Partial<Schedule> = {}

          if (!hasPreviousValue) {
            scheduleChanges.previousValue = liveIncome
          }
          if (!hasMaterializedAt) {
            scheduleChanges.materializedAt = currentKey
          }
          if (Object.keys(scheduleChanges).length > 0) {
            await updateSchedulePending(schedule.id, scheduleChanges, nowIso)
          }

          if (firstMaterialization) {
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
          const hasPreviousValue = schedule.previousValue != null
          const hasMaterializedAt =
            typeof schedule.materializedAt === 'string' && schedule.materializedAt.length > 0
          const firstMaterialization = !hasPreviousValue && !hasMaterializedAt
          const scheduleChanges: Partial<Schedule> = {}

          if (!hasPreviousValue) {
            scheduleChanges.previousValue = liveSavingsRate
          }
          if (!hasMaterializedAt) {
            scheduleChanges.materializedAt = currentKey
          }
          if (Object.keys(scheduleChanges).length > 0) {
            await updateSchedulePending(schedule.id, scheduleChanges, nowIso)
          }

          if (firstMaterialization) {
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
          const hasPreviousValue = schedule.previousValue != null
          const hasMaterializedAt =
            typeof schedule.materializedAt === 'string' && schedule.materializedAt.length > 0
          const firstMaterialization = !hasPreviousValue && !hasMaterializedAt
          const scheduleChanges: Partial<Schedule> = {}
          const previousValue = def?.amount ?? 0

          if (!hasPreviousValue) {
            scheduleChanges.previousValue = previousValue
          }
          if (!hasMaterializedAt) {
            scheduleChanges.materializedAt = currentKey
          }
          if (Object.keys(scheduleChanges).length > 0) {
            await updateSchedulePending(schedule.id, scheduleChanges, nowIso)
          }

          if (firstMaterialization) {
            newNotices.push(
              buildScheduleMaterializationNotice(schedule, {
                appliedAt: nowIso,
                previousValue,
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
          const hasMaterializedAt =
            typeof schedule.materializedAt === 'string' && schedule.materializedAt.length > 0

          if (!hasMaterializedAt) {
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
                  notes: schedule.notes,
                  createdAt: nowIso,
                  updatedAt: nowIso,
                },
                nowIso,
              ) as Expense,
            )
            newNotices.push(
              buildScheduleMaterializationNotice(schedule, {
                appliedAt: nowIso,
                label: schedule.notes?.trim() || 'Planned expense',
              }),
            )
            await updateSchedulePending(
              schedule.id,
              { materializedAt: currentKey, isActive: 0 },
              nowIso,
            )
          } else {
            await updateSchedulePending(schedule.id, { isActive: 0 }, nowIso)
          }
        }
      }

      if (newNotices.length > 0) {
        const mergedLog = [...newNotices, ...existingNoticeLog].slice(0, 20)
        await upsertSettingRow('scheduleMaterializationLog', mergedLog, nowIso)
      }
    },
  )

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
    allFixedSnaps,
    globalIncomeRow,
    globalRateRow,
    activeSchedules,
  ] = await Promise.all([
    db.fixedExpenses.toArray(),
    db.fixedExpenseSnapshots.toArray(),
    db.settings.get('monthlyIncome'),
    db.settings.get('savingsRate'),
    getActiveSchedules(),
  ])

  const activeFixed = filterActiveRows(allFixedDefs).filter((row) => row.isArchived !== true)
  const repairedFixedSnaps = await repairFixedSnapshotIdentitySplits(
    allFixedSnaps,
    db.fixedExpenseSnapshots,
    nowIso,
  )
  const globalIncome =
    globalIncomeRow?.deletedAt == null ? ((globalIncomeRow?.value as number) ?? 0) : 0
  const globalRate = globalRateRow?.deletedAt == null ? ((globalRateRow?.value as number) ?? 0) : 0

  const incomeToAdd: IncomeSnapshot[] = []
  const savingsToAdd: SavingsSnapshot[] = []
  const fixedToAdd: FixedExpenseSnapshot[] = []
  const scheduleUpdates: Schedule[] = []

  for (const { year, month } of gapMonths) {
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

    for (const def of activeFixed) {
      if (!def.id) continue
      const amountSnapshot = resolveScheduleValueForMonth(
        activeSchedules,
        year,
        month,
        def.amount,
        'fixedExpense',
        def.id,
      )
      const fixedExpenseId = resolveHistoricalFixedExpenseIdForSnapshot(
        [...repairedFixedSnaps, ...fixedToAdd],
        year,
        month,
        def.name,
        amountSnapshot,
        def.id,
      )
      fixedToAdd.push(
        buildCreatedSyncRecord(
          {
            fixedExpenseId,
            nameSnapshot: def.name,
            amountSnapshot,
            year,
            month,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          nowIso,
        ) as FixedExpenseSnapshot,
      )
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
      for (const snapshot of incomeToAdd) {
        await upsertIncomeSnapshot(snapshot.year, snapshot.month, snapshot.amountSnapshot, nowIso)
      }
      for (const snapshot of savingsToAdd) {
        await upsertSavingsSnapshot(snapshot.year, snapshot.month, snapshot.rateSnapshot, nowIso)
      }
      for (const snapshot of fixedToAdd) {
        await upsertFixedExpenseSnapshot(
          snapshot.fixedExpenseId,
          snapshot.year,
          snapshot.month,
          snapshot.amountSnapshot,
          snapshot.nameSnapshot,
          nowIso,
        )
      }

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
