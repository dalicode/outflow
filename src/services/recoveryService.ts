import db from './db/schema'
import { LOCAL_ONLY_SETTING_KEYS } from './sync/constants'
import { supabase } from './supabase'

export type RecoveryStatus =
  | 'healthy'
  | 'warning'
  | 'rebuild_cloud_required'
  | 'local_repair_required'

export interface TableCounts {
  expenses: number
  expenseSplits: number
  categories: number
  payees: number
  fixedExpenses: number
  fixedExpenseSnapshots: number
  incomeSnapshots: number
  savingsSnapshots: number
  schedules: number
  settings: number
}

export interface RecoveryReport {
  status: RecoveryStatus
  issues: string[]
  localCounts: TableCounts
  cloudCounts?: TableCounts
  brokenExpenseCategoryRefs: number
  brokenExpensePayeeRefs: number
  brokenExpenseSplitRefs: number
  duplicateIncomeSnapshots: number
  duplicateSavingsSnapshots: number
  duplicateFixedExpenseSnapshots: number
  duplicateCategoryNames: number
  duplicatePayeeNames: number
}

const TABLE_LABELS: Record<keyof TableCounts, string> = {
  expenses: 'Expenses',
  expenseSplits: 'Expense splits',
  categories: 'Categories',
  payees: 'Payees',
  fixedExpenses: 'Fixed expenses',
  fixedExpenseSnapshots: 'Fixed expense snapshots',
  incomeSnapshots: 'Income snapshots',
  savingsSnapshots: 'Savings snapshots',
  schedules: 'Schedules',
  settings: 'Settings',
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function duplicateCountByKey<T>(items: T[], keyFor: (item: T) => string): number {
  const seen = new Set<string>()
  let duplicates = 0
  for (const item of items) {
    const key = keyFor(item)
    if (seen.has(key)) duplicates += 1
    else seen.add(key)
  }
  return duplicates
}

async function getCloudCount(table: string, userId: string): Promise<number> {
  if (!supabase) return 0
  const result = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (result.error) throw new Error(`Cloud count ${table} failed: ${result.error.message}`)
  return result.count ?? 0
}

function isCloudSyncedSetting(setting: { key?: unknown }): boolean {
  return !LOCAL_ONLY_SETTING_KEYS.has(String(setting.key))
}

async function getCloudSettingsCount(userId: string): Promise<number> {
  if (!supabase) return 0
  const result = await supabase.from('settings').select('key').eq('user_id', userId)
  if (result.error) throw new Error(`Cloud count settings failed: ${result.error.message}`)
  const rows = Array.isArray(result.data) ? (result.data as Array<{ key?: unknown }>) : []
  return rows.filter(isCloudSyncedSetting).length
}

export async function runRecoveryDiagnostics(userId?: string): Promise<RecoveryReport> {
  const [
    expenses,
    categories,
    payees,
    fixedExpenses,
    expenseSplits,
    fixedExpenseSnapshots,
    incomeSnapshots,
    savingsSnapshots,
    schedules,
    settings,
  ] = await Promise.all([
    db.expenses.toArray(),
    db.categories.toArray(),
    db.payees.toArray(),
    db.fixedExpenses.toArray(),
    db.expenseSplits.toArray(),
    db.fixedExpenseSnapshots.toArray(),
    db.incomeSnapshots.toArray(),
    db.savingsSnapshots.toArray(),
    db.schedules.toArray(),
    db.settings.toArray(),
  ])

  const localCounts: TableCounts = {
    expenses: expenses.length,
    expenseSplits: expenseSplits.length,
    categories: categories.length,
    payees: payees.length,
    fixedExpenses: fixedExpenses.length,
    fixedExpenseSnapshots: fixedExpenseSnapshots.length,
    incomeSnapshots: incomeSnapshots.length,
    savingsSnapshots: savingsSnapshots.length,
    schedules: schedules.length,
    settings: settings.filter(isCloudSyncedSetting).length,
  }

  const validCategoryIds = new Set(
    categories.filter((c) => c.id != null).map((c) => c.id as number),
  )
  const validPayeeIds = new Set(payees.filter((p) => p.id != null).map((p) => p.id as number))
  const validSplitIds = new Set(
    expenseSplits
      .filter((split) => split.id != null && split.deletedAt == null)
      .map((split) => split.id as number),
  )

  let brokenExpenseCategoryRefs = 0
  let brokenExpensePayeeRefs = 0
  let brokenExpenseSplitRefs = 0
  for (const exp of expenses) {
    if (exp.categoryId != null && !validCategoryIds.has(exp.categoryId)) {
      brokenExpenseCategoryRefs += 1
    }
    if (exp.payeeId != null && !validPayeeIds.has(exp.payeeId)) {
      brokenExpensePayeeRefs += 1
    }
    if (exp.splitId != null && !validSplitIds.has(exp.splitId)) {
      brokenExpenseSplitRefs += 1
    }
  }

  const duplicateIncomeSnapshots = duplicateCountByKey(
    incomeSnapshots,
    (row) => `${row.year}-${row.month}`,
  )
  const duplicateSavingsSnapshots = duplicateCountByKey(
    savingsSnapshots,
    (row) => `${row.year}-${row.month}`,
  )
  const duplicateFixedExpenseSnapshots = duplicateCountByKey(
    fixedExpenseSnapshots,
    (row) => `${row.fixedExpenseId}-${row.year}-${row.month}`,
  )
  const duplicateCategoryNames = duplicateCountByKey(
    categories.filter((c) => !c.isArchived),
    (row) => normalizeName(row.name),
  )
  const duplicatePayeeNames = duplicateCountByKey(
    payees.filter((p) => !p.isArchived),
    (row) => normalizeName(row.name),
  )

  let cloudCounts: TableCounts | undefined
  if (userId && supabase) {
    const [
      expensesCount,
      categoriesCount,
      payeesCount,
      fixedExpensesCount,
      expenseSplitsCount,
      fixedExpenseSnapshotsCount,
      incomeSnapshotsCount,
      savingsSnapshotsCount,
      schedulesCount,
      settingsCount,
    ] = await Promise.all([
      getCloudCount('expenses', userId),
      getCloudCount('categories', userId),
      getCloudCount('payees', userId),
      getCloudCount('fixed_expenses', userId),
      getCloudCount('expense_splits', userId),
      getCloudCount('fixed_expense_snapshots', userId),
      getCloudCount('income_snapshots', userId),
      getCloudCount('savings_snapshots', userId),
      getCloudCount('schedules', userId),
      getCloudSettingsCount(userId),
    ])

    cloudCounts = {
      expenses: expensesCount,
      categories: categoriesCount,
      payees: payeesCount,
      fixedExpenses: fixedExpensesCount,
      expenseSplits: expenseSplitsCount,
      fixedExpenseSnapshots: fixedExpenseSnapshotsCount,
      incomeSnapshots: incomeSnapshotsCount,
      savingsSnapshots: savingsSnapshotsCount,
      schedules: schedulesCount,
      settings: settingsCount,
    }
  }

  const issues: string[] = []
  if (brokenExpenseCategoryRefs > 0) {
    issues.push(`${brokenExpenseCategoryRefs} expenses reference missing categories`)
  }
  if (brokenExpensePayeeRefs > 0) {
    issues.push(`${brokenExpensePayeeRefs} expenses reference missing payees`)
  }
  if (brokenExpenseSplitRefs > 0) {
    issues.push(`${brokenExpenseSplitRefs} expenses reference missing or deleted split containers`)
  }
  if (duplicateIncomeSnapshots > 0)
    issues.push(`${duplicateIncomeSnapshots} duplicate income snapshots`)
  if (duplicateSavingsSnapshots > 0)
    issues.push(`${duplicateSavingsSnapshots} duplicate savings snapshots`)
  if (duplicateFixedExpenseSnapshots > 0) {
    issues.push(`${duplicateFixedExpenseSnapshots} duplicate fixed expense snapshots`)
  }
  if (duplicateCategoryNames > 0) issues.push(`${duplicateCategoryNames} duplicate category names`)
  if (duplicatePayeeNames > 0) issues.push(`${duplicatePayeeNames} duplicate payee names`)

  let mismatchCount = 0
  if (cloudCounts) {
    const fields: Array<keyof TableCounts> = [
      'expenses',
      'expenseSplits',
      'categories',
      'payees',
      'fixedExpenses',
      'fixedExpenseSnapshots',
      'incomeSnapshots',
      'savingsSnapshots',
      'schedules',
      'settings',
    ]
    for (const field of fields) {
      if (cloudCounts[field] !== localCounts[field]) {
        mismatchCount += 1
        issues.push(
          `${TABLE_LABELS[field]} count mismatch: local ${localCounts[field]}, cloud ${cloudCounts[field]}`,
        )
      }
    }
  }

  let status: RecoveryStatus = 'healthy'
  const localIntegrityFailed =
    brokenExpenseCategoryRefs > 0 ||
    brokenExpensePayeeRefs > 0 ||
    brokenExpenseSplitRefs > 0 ||
    duplicateIncomeSnapshots > 0 ||
    duplicateSavingsSnapshots > 0 ||
    duplicateFixedExpenseSnapshots > 0 ||
    duplicateCategoryNames > 0 ||
    duplicatePayeeNames > 0

  if (localIntegrityFailed) {
    status = 'local_repair_required'
  } else if (mismatchCount >= 3) {
    status = 'rebuild_cloud_required'
  } else if (mismatchCount > 0) {
    status = 'warning'
  }

  return {
    status,
    issues,
    localCounts,
    cloudCounts,
    brokenExpenseCategoryRefs,
    brokenExpensePayeeRefs,
    brokenExpenseSplitRefs,
    duplicateIncomeSnapshots,
    duplicateSavingsSnapshots,
    duplicateFixedExpenseSnapshots,
    duplicateCategoryNames,
    duplicatePayeeNames,
  }
}
