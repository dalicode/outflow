import type { FixedExpenseSnapshot, IncomeSnapshot, SavingsSnapshot } from '../../types'
import { clamp, flattenRangesToMonthMap, type RangeItem } from '../../utils/historicalDataHelpers'
import db from '../db/schema'
import { enqueue } from './common'

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
    db.syncQueue,
    async () => {
      const now = new Date().toISOString()

      for (const year of dirtyYears) {
        const config = yearConfigs[year] || {
          incomeRanges: [],
          savingsRanges: [],
          fixedItems: [],
        }

        const [existingIncome, existingSavings, existingFixed] = await Promise.all([
          db.incomeSnapshots.where('year').equals(year).toArray(),
          db.savingsSnapshots.where('year').equals(year).toArray(),
          db.fixedExpenseSnapshots.where('year').equals(year).toArray(),
        ])

        const desiredIncomeByKey = new Map<string, Pick<IncomeSnapshot, 'year' | 'month' | 'amountSnapshot'>>()
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
          existingIncome.map((row) => [buildMonthKey(row.year, row.month), row]),
        )
        for (const [key, desired] of desiredIncomeByKey.entries()) {
          const existing = existingIncomeByKey.get(key)
          if (existing && existing.amountSnapshot === desired.amountSnapshot) continue
          if (existing) {
            const payload = {
              ...existing,
              amountSnapshot: desired.amountSnapshot,
              updatedAt: now,
            }
            await db.incomeSnapshots.put(payload)
            await enqueue('incomeSnapshots', 'update', payload as unknown as Record<string, unknown>)
            continue
          }
          const created: IncomeSnapshot = {
            ...desired,
            cloudId: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          }
          const id = await db.incomeSnapshots.add(created)
          const inserted = await db.incomeSnapshots.get(id)
          await enqueue('incomeSnapshots', 'insert', inserted as unknown as Record<string, unknown>)
        }
        for (const row of existingIncome) {
          if (desiredIncomeByKey.has(buildMonthKey(row.year, row.month))) continue
          if (row.id == null) continue
          await db.incomeSnapshots.delete(row.id)
          await enqueue('incomeSnapshots', 'delete', { id: row.id, cloudId: row.cloudId })
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
          existingSavings.map((row) => [buildMonthKey(row.year, row.month), row]),
        )
        for (const [key, desired] of desiredSavingsByKey.entries()) {
          const existing = existingSavingsByKey.get(key)
          if (existing && existing.rateSnapshot === desired.rateSnapshot) continue
          if (existing) {
            const payload = {
              ...existing,
              rateSnapshot: desired.rateSnapshot,
              updatedAt: now,
            }
            await db.savingsSnapshots.put(payload)
            await enqueue('savingsSnapshots', 'update', payload as unknown as Record<string, unknown>)
            continue
          }
          const created: SavingsSnapshot = {
            ...desired,
            cloudId: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          }
          const id = await db.savingsSnapshots.add(created)
          const inserted = await db.savingsSnapshots.get(id)
          await enqueue('savingsSnapshots', 'insert', inserted as unknown as Record<string, unknown>)
        }
        for (const row of existingSavings) {
          if (desiredSavingsByKey.has(buildMonthKey(row.year, row.month))) continue
          if (row.id == null) continue
          await db.savingsSnapshots.delete(row.id)
          await enqueue('savingsSnapshots', 'delete', { id: row.id, cloudId: row.cloudId })
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
            const fixedPayload = {
              name: fixedName,
              amount: fixedAmount,
              cloudId: crypto.randomUUID(),
              isArchived: true,
              archivedAt: now,
              updatedAt: now,
            }
            const id = await db.fixedExpenses.add(fixedPayload)
            const inserted = await db.fixedExpenses.get(id)
            await enqueue('fixedExpenses', 'insert', inserted as unknown as Record<string, unknown>)
            fixedExpenseId = id
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
          existingFixed.map((row) => [buildFixedKey(row.fixedExpenseId, row.year, row.month), row]),
        )
        for (const [key, desired] of desiredFixedByKey.entries()) {
          const existing = existingFixedByKey.get(key)
          if (
            existing &&
            existing.amountSnapshot === desired.amountSnapshot &&
            existing.nameSnapshot === desired.nameSnapshot
          ) {
            continue
          }
          if (existing) {
            const payload = {
              ...existing,
              amountSnapshot: desired.amountSnapshot,
              nameSnapshot: desired.nameSnapshot,
              updatedAt: now,
            }
            await db.fixedExpenseSnapshots.put(payload)
            await enqueue(
              'fixedExpenseSnapshots',
              'update',
              payload as unknown as Record<string, unknown>,
            )
            continue
          }
          const created: FixedExpenseSnapshot = {
            ...desired,
            cloudId: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          }
          const id = await db.fixedExpenseSnapshots.add(created)
          const inserted = await db.fixedExpenseSnapshots.get(id)
          await enqueue(
            'fixedExpenseSnapshots',
            'insert',
            inserted as unknown as Record<string, unknown>,
          )
        }
        for (const row of existingFixed) {
          if (desiredFixedByKey.has(buildFixedKey(row.fixedExpenseId, row.year, row.month))) continue
          if (row.id == null) continue
          await db.fixedExpenseSnapshots.delete(row.id)
          await enqueue('fixedExpenseSnapshots', 'delete', { id: row.id, cloudId: row.cloudId })
        }
      }
    },
  )
}
