import type { FixedExpenseSnapshot, IncomeSnapshot, SavingsSnapshot } from '../../types'
import { clamp, flattenRangesToMonthMap, type RangeItem } from '../../utils/historicalDataHelpers'
import db from '../db/schema'
import {
  buildCreatedSyncRecord,
  filterActiveRows,
  markDeletedSyncRecord,
  markPendingActiveRecord,
} from './common'

export interface HistoricalFixedItem {
  id: string
  name: string
  amount: string | number
  startMonth: number
  endMonth: number
  existingFixedExpenseId?: number
}

export interface HistoricalYearConfig {
  incomeRanges: RangeItem[]
  savingsRanges: RangeItem[]
  fixedItems: HistoricalFixedItem[]
}

export interface SaveHistoricalSnapshotConfigsParams {
  dirtyYears: Set<number>
  yearConfigs: Record<number, HistoricalYearConfig>
}

const buildMonthKey = (year: number, month: number): string => `${year}-${month}`
const buildFixedKey = (fixedExpenseId: number, year: number, month: number): string =>
  `${fixedExpenseId}-${year}-${month}`

export function saveHistoricalSnapshotConfigs({
  dirtyYears,
  yearConfigs,
}: SaveHistoricalSnapshotConfigsParams): Promise<void> {
  return db.transaction(
    'rw',
    db.fixedExpenses,
    db.fixedExpenseSnapshots,
    db.incomeSnapshots,
    db.savingsSnapshots,
    async () => {
      const now = new Date().toISOString()

      for (const year of dirtyYears) {
        const config = yearConfigs[year] || {
          incomeRanges: [],
          savingsRanges: [],
          fixedItems: [],
        }

        const [allIncome, allSavings, allFixed] = await Promise.all([
          db.incomeSnapshots.where('year').equals(year).toArray(),
          db.savingsSnapshots.where('year').equals(year).toArray(),
          db.fixedExpenseSnapshots.where('year').equals(year).toArray(),
        ])
        const existingIncome = filterActiveRows(allIncome)
        const existingSavings = filterActiveRows(allSavings)
        const existingFixed = filterActiveRows(allFixed)

        const desiredIncomeByKey = new Map<
          string,
          Pick<IncomeSnapshot, 'year' | 'month' | 'amountSnapshot'>
        >()
        const desiredIncomeMonthMap = flattenRangesToMonthMap(config.incomeRanges)
        for (const [month, amount] of Object.entries(desiredIncomeMonthMap)) {
          const parsedMonth = Number(month)
          desiredIncomeByKey.set(buildMonthKey(year, parsedMonth), {
            year,
            month: parsedMonth,
            amountSnapshot: amount as number,
          })
        }

        const existingIncomeByKey = new Map(
          allIncome.map((row) => [buildMonthKey(row.year, row.month), row]),
        )
        for (const [key, desired] of desiredIncomeByKey.entries()) {
          const existing = existingIncomeByKey.get(key)
          if (
            existing &&
            existing.amountSnapshot === desired.amountSnapshot &&
            existing.deletedAt == null
          )
            continue
          if (existing && existing.id != null) {
            await db.incomeSnapshots.put({
              ...existing,
              ...markPendingActiveRecord(existing, now),
              id: existing.id,
              amountSnapshot: desired.amountSnapshot,
              deletedAt: null,
            })
            continue
          }
          await db.incomeSnapshots.add(
            buildCreatedSyncRecord(
              {
                ...desired,
                createdAt: now,
                updatedAt: now,
              },
              now,
            ) as IncomeSnapshot,
          )
        }
        for (const row of existingIncome) {
          if (desiredIncomeByKey.has(buildMonthKey(row.year, row.month)) || row.id == null) continue
          await db.incomeSnapshots.put({
            ...row,
            ...markDeletedSyncRecord(row, now),
            id: row.id,
          })
        }

        const desiredSavingsByKey = new Map<
          string,
          Pick<SavingsSnapshot, 'year' | 'month' | 'rateSnapshot'>
        >()
        const desiredSavingsMonthMap = flattenRangesToMonthMap(config.savingsRanges)
        for (const [month, rate] of Object.entries(desiredSavingsMonthMap)) {
          const parsedMonth = Number(month)
          desiredSavingsByKey.set(buildMonthKey(year, parsedMonth), {
            year,
            month: parsedMonth,
            rateSnapshot: rate as number,
          })
        }

        const existingSavingsByKey = new Map(
          allSavings.map((row) => [buildMonthKey(row.year, row.month), row]),
        )
        for (const [key, desired] of desiredSavingsByKey.entries()) {
          const existing = existingSavingsByKey.get(key)
          if (
            existing &&
            existing.rateSnapshot === desired.rateSnapshot &&
            existing.deletedAt == null
          )
            continue
          if (existing && existing.id != null) {
            await db.savingsSnapshots.put({
              ...existing,
              ...markPendingActiveRecord(existing, now),
              id: existing.id,
              rateSnapshot: desired.rateSnapshot,
              deletedAt: null,
            })
            continue
          }
          await db.savingsSnapshots.add(
            buildCreatedSyncRecord(
              {
                ...desired,
                createdAt: now,
                updatedAt: now,
              },
              now,
            ) as SavingsSnapshot,
          )
        }
        for (const row of existingSavings) {
          if (desiredSavingsByKey.has(buildMonthKey(row.year, row.month)) || row.id == null)
            continue
          await db.savingsSnapshots.put({
            ...row,
            ...markDeletedSyncRecord(row, now),
            id: row.id,
          })
        }

        const desiredFixedByKey = new Map<string, FixedExpenseSnapshot>()
        const validFixedItems = config.fixedItems.filter(
          (item) =>
            item.name.trim() &&
            !Number.isNaN(Number.parseFloat(String(item.amount))) &&
            Number.parseFloat(String(item.amount)) !== 0,
        )

        for (const item of validFixedItems) {
          const fixedAmount = Number.parseFloat(String(item.amount))
          const fixedName = item.name.trim()
          let fixedExpenseId = item.existingFixedExpenseId
          if (fixedExpenseId == null) {
            fixedExpenseId = await db.fixedExpenses.add(
              buildCreatedSyncRecord(
                {
                  name: fixedName,
                  amount: fixedAmount,
                  isArchived: true,
                  archivedAt: now,
                  updatedAt: now,
                },
                now,
              ),
            )
          }

          const startMonth = clamp(Number.parseInt(String(item.startMonth), 10) || 1, 1, 12)
          const endMonth = clamp(Number.parseInt(String(item.endMonth), 10) || 12, 1, 12)
          for (let month = startMonth; month <= endMonth; month += 1) {
            const row: FixedExpenseSnapshot = {
              fixedExpenseId,
              year,
              month,
              amountSnapshot: fixedAmount,
              nameSnapshot: fixedName,
            }
            desiredFixedByKey.set(buildFixedKey(fixedExpenseId, year, month), row)
          }
        }

        const existingFixedByKey = new Map(
          allFixed.map((row) => [buildFixedKey(row.fixedExpenseId, row.year, row.month), row]),
        )
        for (const [key, desired] of desiredFixedByKey.entries()) {
          const existing = existingFixedByKey.get(key)
          if (
            existing &&
            existing.amountSnapshot === desired.amountSnapshot &&
            existing.nameSnapshot === desired.nameSnapshot &&
            existing.deletedAt == null
          ) {
            continue
          }
          if (existing && existing.id != null) {
            await db.fixedExpenseSnapshots.put({
              ...existing,
              ...markPendingActiveRecord(existing, now),
              id: existing.id,
              amountSnapshot: desired.amountSnapshot,
              nameSnapshot: desired.nameSnapshot,
              deletedAt: null,
            })
            continue
          }
          await db.fixedExpenseSnapshots.add(
            buildCreatedSyncRecord(
              {
                ...desired,
                createdAt: now,
                updatedAt: now,
              },
              now,
            ) as FixedExpenseSnapshot,
          )
        }
        for (const row of existingFixed) {
          if (
            desiredFixedByKey.has(buildFixedKey(row.fixedExpenseId, row.year, row.month)) ||
            row.id == null
          ) {
            continue
          }
          await db.fixedExpenseSnapshots.put({
            ...row,
            ...markDeletedSyncRecord(row, now),
            id: row.id,
          })
        }
      }
    },
  )
}
