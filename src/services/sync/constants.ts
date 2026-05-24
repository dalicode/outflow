export const TABLE_MAP: Record<string, string> = {
  expenses: 'expenses',
  expenseSplits: 'expense_splits',
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

export const SYNC_BATCH_SIZE = 500
export const CLOUD_FETCH_PAGE_SIZE = 500
export const STALE_SYNC_RUN_MESSAGE = 'Sync run superseded'
export const LOCAL_ONLY_SETTING_KEYS = new Set(['localPrivacyModeEnabled'])

export const FULL_SYNC_ORDER = [
  'categories',
  'payees',
  'fixed_expenses',
  'expense_splits',
  'settings',
  'fixed_expense_snapshots',
  'income_snapshots',
  'savings_snapshots',
  'schedules',
  'category_merge_history',
  'payee_merge_history',
  'expenses',
] as const

export const FULL_SYNC_DELETE_ORDER = [
  'expenses',
  'expense_splits',
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
  categories: 'user_id,name',
  payees: 'user_id,name',
  fixed_expenses: 'user_id,local_id',
  expense_splits: 'user_id,local_id',
  fixed_expense_snapshots: 'user_id,local_id',
  income_snapshots: 'user_id,local_id',
  savings_snapshots: 'user_id,local_id',
  schedules: 'user_id,local_id',
  category_merge_history: 'user_id,local_id',
  payee_merge_history: 'user_id,local_id',
  expenses: 'user_id,local_id',
}

export const CLOUD_ID_TABLES = [
  'expenses',
  'expenseSplits',
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
