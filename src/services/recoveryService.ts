import db from './db/schema'
import { supabase } from './supabase'

export type RecoveryStatus = 'healthy' | 'warning' | 'rebuild_cloud_required' | 'local_repair_required'

export interface TableCounts {
  expenses: number
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
  duplicateIncomeSnapshots: number
  duplicateSavingsSnapshots: number
  duplicateFixedExpenseSnapshots: number
  duplicateCategoryNames: number
  duplicatePayeeNames: number
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

export async function runRecoveryDiagnostics(userId?: string): Promise<RecoveryReport> {
  const [
    expenses,
    categories,
    payees,
    fixedExpenses,
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
    db.fixedExpenseSnapshots.toArray(),
    db.incomeSnapshots.toArray(),
    db.savingsSnapshots.toArray(),
    db.schedules.toArray(),
    db.settings.toArray(),
  ])

  const localCounts: TableCounts = {
    expenses: expenses.length,
    categories: categories.length,
    payees: payees.length,
    fixedExpenses: fixedExpenses.length,
    fixedExpenseSnapshots: fixedExpenseSnapshots.length,
    incomeSnapshots: incomeSnapshots.length,
    savingsSnapshots: savingsSnapshots.length,
    schedules: schedules.length,
    settings: settings.length,
  }

  const validCategoryIds = new Set(categories.filter((c) => c.id != null).map((c) => c.id as number))
  const validPayeeIds = new Set(payees.filter((p) => p.id != null).map((p) => p.id as number))

  let brokenExpenseCategoryRefs = 0
  let brokenExpensePayeeRefs = 0
  for (const exp of expenses) {
    if (exp.categoryId != null && !validCategoryIds.has(exp.categoryId)) {
      brokenExpenseCategoryRefs += 1
    }
    if (exp.payeeId != null && !validPayeeIds.has(exp.payeeId)) {
      brokenExpensePayeeRefs += 1
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
      getCloudCount('fixed_expense_snapshots', userId),
      getCloudCount('income_snapshots', userId),
      getCloudCount('savings_snapshots', userId),
      getCloudCount('schedules', userId),
      getCloudCount('settings', userId),
    ])

    cloudCounts = {
      expenses: expensesCount,
      categories: categoriesCount,
      payees: payeesCount,
      fixedExpenses: fixedExpensesCount,
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
  if (duplicateIncomeSnapshots > 0) issues.push(`${duplicateIncomeSnapshots} duplicate income snapshots`)
  if (duplicateSavingsSnapshots > 0) issues.push(`${duplicateSavingsSnapshots} duplicate savings snapshots`)
  if (duplicateFixedExpenseSnapshots > 0) {
    issues.push(`${duplicateFixedExpenseSnapshots} duplicate fixed expense snapshots`)
  }
  if (duplicateCategoryNames > 0) issues.push(`${duplicateCategoryNames} duplicate category names`)
  if (duplicatePayeeNames > 0) issues.push(`${duplicatePayeeNames} duplicate payee names`)

  let mismatchCount = 0
  if (cloudCounts) {
    const fields: Array<keyof TableCounts> = [
      'expenses',
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
      if (cloudCounts[field] !== localCounts[field]) mismatchCount += 1
    }
    if (mismatchCount > 0) {
      issues.push(`${mismatchCount} table count mismatches between local and cloud`)
    }
  }

  let status: RecoveryStatus = 'healthy'
  const localIntegrityFailed =
    brokenExpenseCategoryRefs > 0 ||
    brokenExpensePayeeRefs > 0 ||
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
    duplicateIncomeSnapshots,
    duplicateSavingsSnapshots,
    duplicateFixedExpenseSnapshots,
    duplicateCategoryNames,
    duplicatePayeeNames,
  }
}

