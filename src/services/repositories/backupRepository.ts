import type {
  Category,
  CategoryMergeHistory,
  Expense,
  FixedExpense,
  FixedExpenseSnapshot,
  IncomeSnapshot,
  Payee,
  PayeeMergeHistory,
  SavingsSnapshot,
  Schedule,
  SyncQueueItem,
} from '../../types'
import type { Setting } from '../db/schema'
import { decryptBackup, isEncryptedEnvelope } from '../../utils/backupCrypto'
import { buildDefaultCategories, buildDefaultPayees } from '../defaults'
import db from '../db/schema'
import { queueImportSyncMarker } from '../importService'
import { FULL_SYNC_QUEUE_REASON } from '../syncRuntime'

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
    }
    const now = new Date().toISOString()
    await db.table('categories').bulkAdd(buildDefaultCategories(now))
    await db.table('payees').bulkAdd(buildDefaultPayees(now))
  })
}

export function dbVersion(): number {
  return db.verno
}

export async function exportAllData(): Promise<Record<string, unknown>> {
  return {
    expenses: await db.expenses.toArray(),
    categories: await db.categories.toArray(),
    payees: await db.payees.toArray(),
    fixedExpenses: await db.fixedExpenses.toArray(),
    fixedExpenseSnapshots: await db.fixedExpenseSnapshots.toArray(),
    incomeSnapshots: await db.incomeSnapshots.toArray(),
    savingsSnapshots: await db.savingsSnapshots.toArray(),
    schedules: await db.schedules.toArray(),
    settings: await db.settings.toArray(),
    syncQueue: await db.syncQueue.toArray(),
    categoryMergeHistory: await db.categoryMergeHistory.toArray(),
    payeeMergeHistory: await db.payeeMergeHistory.toArray(),
  }
}

export async function importBackup(
  data: Record<string, unknown>,
  password: string | null,
  { replace = false, queueFullSync = false } = {},
): Promise<void> {
  if (isEncryptedEnvelope(data)) {
    if (!password) {
      throw new Error('This backup is encrypted. Please enter the password.')
    }
    const decrypted = await decryptBackup(data, password)
    return importAllData(decrypted, { replace, queueFullSync })
  }
  return importAllData(data, { replace, queueFullSync })
}

export function bulkUpsertExpenses(rows: Expense[]): Promise<number> {
  return db.expenses.bulkPut(rows)
}

export function bulkUpsertCategories(rows: Category[]): Promise<number> {
  return db.categories.bulkPut(rows)
}

export function bulkUpsertPayees(rows: Payee[]): Promise<number> {
  return db.payees.bulkPut(rows)
}

export function bulkUpsertFixedExpenses(rows: FixedExpense[]): Promise<number> {
  return db.fixedExpenses.bulkPut(rows)
}

export async function importAllData(
  data: Record<string, unknown>,
  { replace = false, queueFullSync = false } = {},
): Promise<void> {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data')
  }

  // Support new { meta, data } format and old flat format
  const payload =
    'data' in data && typeof data.data === 'object' && data.data !== null
      ? (data.data as Record<string, unknown>)
      : data

  await db.transaction('rw', db.tables, async () => {
    if (replace) {
      for (const table of db.tables) {
        await table.clear()
      }
    }

    if (payload.expenses) await db.expenses.bulkPut(payload.expenses as Expense[])
    if (payload.categories) await db.categories.bulkPut(payload.categories as Category[])
    if (payload.payees) await db.payees.bulkPut(payload.payees as Payee[])
    if (payload.fixedExpenses)
      await db.fixedExpenses.bulkPut(payload.fixedExpenses as FixedExpense[])
    if (payload.fixedExpenseSnapshots) {
      await db.fixedExpenseSnapshots.bulkPut(payload.fixedExpenseSnapshots as FixedExpenseSnapshot[])
    }
    if (payload.incomeSnapshots) {
      await db.incomeSnapshots.bulkPut(payload.incomeSnapshots as IncomeSnapshot[])
    }
    if (payload.savingsSnapshots) {
      await db.savingsSnapshots.bulkPut(payload.savingsSnapshots as SavingsSnapshot[])
    }
    if (payload.schedules) await db.schedules.bulkPut(payload.schedules as Schedule[])
    if (payload.settings) await db.settings.bulkPut(payload.settings as Setting[])
    if (payload.categoryMergeHistory) {
      await db.categoryMergeHistory.bulkPut(payload.categoryMergeHistory as CategoryMergeHistory[])
    }
    if (payload.payeeMergeHistory) {
      await db.payeeMergeHistory.bulkPut(payload.payeeMergeHistory as PayeeMergeHistory[])
    }

    if (!queueFullSync && payload.syncQueue) {
      await db.syncQueue.bulkPut(payload.syncQueue as SyncQueueItem[])
    }
  })

  if (queueFullSync) {
    await queueImportSyncMarker(
      { reason: FULL_SYNC_QUEUE_REASON, replace },
      { preserveDeletesOnly: true },
    )
  }
}
