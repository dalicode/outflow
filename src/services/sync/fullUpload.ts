import type { Category, Expense, FixedExpense, Payee } from '../../types'
import { StorageService } from '../storageService'
import { supabase } from '../supabase'
import { FULL_SYNC_DELETE_ORDER, FULL_SYNC_ORDER, LOCAL_ONLY_SETTING_KEYS } from './constants'
import { deduplicateByName } from './integrity'
import { toCloud, toLocalCloudMap } from './conversion'
import { assertNoSupabaseError, ensureCloudIdsForSync, upsertRowsInBatches } from './supabaseUtils'
import db from '../db/schema'
import { isSyncPaused } from '../syncRuntime'

async function deleteUserRowsForReplace(table: string, userId: string): Promise<void> {
  if (!supabase) return
  const deleteResult = await supabase.from(table).delete().eq('user_id', userId)
  assertNoSupabaseError(deleteResult, `Delete ${table} rows for replace`)
}

async function replaceSupabaseData(
  userId: string,
  tables: readonly string[] = FULL_SYNC_DELETE_ORDER,
): Promise<void> {
  for (const table of tables) {
    await deleteUserRowsForReplace(table, userId)
  }
}

export async function clearUserCloudData(userId: string): Promise<void> {
  if (!supabase || !userId) return
  await replaceSupabaseData(userId)
}

export async function migrateLocalToSupabase(
  userId: string,
  options: { ignorePause?: boolean } = {},
): Promise<void> {
  if (!supabase || !userId || (!options.ignorePause && isSyncPaused())) return

  await deduplicateByName(db.table('categories'), 'categoryId')
  await deduplicateByName(db.table('payees'), 'payeeId')
  await ensureCloudIdsForSync()

  const [
    expenses,
    categories,
    payees,
    fixedExpenses,
    settings,
    fixedExpenseSnapshots,
    incomeSnapshots,
    savingsSnapshots,
    schedules,
    categoryMergeHistory,
    payeeMergeHistory,
  ] = await Promise.all([
    StorageService.getAll() as Promise<Expense[]>,
    StorageService.getCategories() as Promise<Category[]>,
    StorageService.getPayees() as Promise<Payee[]>,
    StorageService.getFixedExpenses() as Promise<FixedExpense[]>,
    StorageService.db.settings.toArray(),
    StorageService.db.fixedExpenseSnapshots.toArray(),
    StorageService.db.incomeSnapshots.toArray(),
    StorageService.db.savingsSnapshots.toArray(),
    StorageService.db.schedules.toArray(),
    StorageService.db.categoryMergeHistory.toArray(),
    StorageService.db.payeeMergeHistory.toArray(),
  ])

  const categoryIdToCloudId = toLocalCloudMap(categories)
  const payeeIdToCloudId = toLocalCloudMap(payees)
  const fixedExpenseIdToCloudId = toLocalCloudMap(fixedExpenses)
  const maps = { categoryIdToCloudId, payeeIdToCloudId, fixedExpenseIdToCloudId }

  const rowsByTable: Record<(typeof FULL_SYNC_ORDER)[number], Record<string, unknown>[]> = {
    categories: categories.map((r) =>
      toCloud('categories', r as unknown as Record<string, unknown>, userId, maps),
    ),
    payees: payees.map((r) =>
      toCloud('payees', r as unknown as Record<string, unknown>, userId, maps),
    ),
    fixed_expenses: fixedExpenses.map((r) =>
      toCloud('fixedExpenses', r as unknown as Record<string, unknown>, userId, maps),
    ),
    fixed_expense_snapshots: fixedExpenseSnapshots.map((r) =>
      toCloud('fixedExpenseSnapshots', r as unknown as Record<string, unknown>, userId, maps),
    ),
    income_snapshots: incomeSnapshots.map((r) =>
      toCloud('incomeSnapshots', r as unknown as Record<string, unknown>, userId, maps),
    ),
    savings_snapshots: savingsSnapshots.map((r) =>
      toCloud('savingsSnapshots', r as unknown as Record<string, unknown>, userId, maps),
    ),
    schedules: schedules.map((r) =>
      toCloud('schedules', r as unknown as Record<string, unknown>, userId, maps),
    ),
    category_merge_history: categoryMergeHistory.map((r) =>
      toCloud('categoryMergeHistory', r as unknown as Record<string, unknown>, userId, maps),
    ),
    payee_merge_history: payeeMergeHistory.map((r) =>
      toCloud('payeeMergeHistory', r as unknown as Record<string, unknown>, userId, maps),
    ),
    settings: settings
      .filter((r) => !LOCAL_ONLY_SETTING_KEYS.has(String(r.key)))
      .map((r) => toCloud('settings', r as unknown as Record<string, unknown>, userId, maps)),
    expenses: expenses.map((r) =>
      toCloud('expenses', r as unknown as Record<string, unknown>, userId, maps),
    ),
  }

  for (const table of FULL_SYNC_ORDER) {
    await upsertRowsInBatches(table, rowsByTable[table])
  }
}

export async function runFullSyncUpload(
  userId: string,
  replaceCloud = false,
  replaceTables?: readonly string[],
): Promise<void> {
  if (replaceCloud) {
    await replaceSupabaseData(userId, replaceTables)
  }
  await migrateLocalToSupabase(userId)
}
