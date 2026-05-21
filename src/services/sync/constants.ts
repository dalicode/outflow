export const TABLE_MAP: Record<string, string> = {
  expenses: 'expenses',
  categories: 'categories',
  payees: 'payees',
  fixedExpenses: 'fixed_expenses',
  fixedExpenseSnapshots: 'fixed_expense_snapshots',
  incomeSnapshots: 'income_snapshots',
  savingsSnapshots: 'savings_snapshots',
  schedules: 'schedules',
  categoryMergeHistory: 'category_merge_history',
  payeeMergeHistory: 'payee_merge_history',
  settings: 'settings',
}

export const SYNC_BATCH_SIZE = 250
export const CLOUD_FETCH_PAGE_SIZE = 1000
export const STALE_SYNC_RUN_MESSAGE = 'Sync run superseded'
export const LOCAL_ONLY_SETTING_KEYS = new Set(['localPrivacyModeEnabled'])

export const FULL_SYNC_ORDER = [
  'categories',
  'payees',
  'fixed_expenses',
  'fixed_expense_snapshots',
  'income_snapshots',
  'savings_snapshots',
  'schedules',
  'category_merge_history',
  'payee_merge_history',
  'settings',
  'expenses',
] as const

export const FULL_SYNC_DELETE_ORDER = [
  'expenses',
  'category_merge_history',
  'payee_merge_history',
  'schedules',
  'fixed_expense_snapshots',
  'income_snapshots',
  'savings_snapshots',
  'fixed_expenses',
  'categories',
  'payees',
  'settings',
] as const

export const UPSERT_CONFLICT_MAP: Partial<Record<string, string>> = {
  settings: 'user_id,key',
  income_snapshots: 'user_id,year,month',
  savings_snapshots: 'user_id,year,month',
  fixed_expense_snapshots: 'user_id,fixed_expense_id,year,month',
}

export const CLOUD_ID_TABLES = [
  'expenses',
  'categories',
  'payees',
  'fixedExpenses',
  'fixedExpenseSnapshots',
  'incomeSnapshots',
  'savingsSnapshots',
  'schedules',
  'categoryMergeHistory',
  'payeeMergeHistory',
] as const
