/**
 * Outflow — Shared Type Definitions
 * ───────────────────────────────────
 * Central domain models used across the application.
 */

// ── Expenses ────────────────────────────────────────────────────────────────

export interface Expense {
  id?: number
  date: string
  amount: number
  categoryId?: number
  payeeId?: number
  description?: string
  createdAt?: string
}

// ── Categories ──────────────────────────────────────────────────────────────

export interface Category {
  id?: number
  name: string
  createdAt?: string
  updatedAt?: string
  isArchived?: boolean
  archivedAt?: string
  mergedIntoCategoryId?: number | null
}

// ── Payees ──────────────────────────────────────────────────────────────────

export interface Payee {
  id?: number
  name: string
  aliases?: string[]
  createdAt?: string
  updatedAt?: string
  isArchived?: boolean
  archivedAt?: string
  mergedIntoPayeeId?: number | null
}

// ── Merge History ────────────────────────────────────────────────────────────

export interface CategoryMergeHistory {
  id?: number
  sourceCategoryId: number
  targetCategoryId: number
  affectedExpenseIds: number[]
  createdAt: string
  revertedAt?: string | null
}

export interface PayeeMergeHistory {
  id?: number
  sourcePayeeId: number
  targetPayeeId: number
  affectedExpenseIds: number[]
  createdAt: string
  revertedAt?: string | null
}

// ── Fixed Expenses ──────────────────────────────────────────────────────────

export interface FixedExpense {
  id?: number
  name: string
  amount: number
  isArchived?: boolean
  archivedAt?: string
  updatedAt?: string
}

export interface FixedExpenseSnapshot {
  id?: number
  fixedExpenseId: number
  nameSnapshot: string
  amountSnapshot: number
  year: number
  month: number
  createdAt?: string
}

export interface IncomeSnapshot {
  id?: number
  year: number
  month: number
  amountSnapshot: number
  createdAt?: string
}

export interface SavingsSnapshot {
  id?: number
  year: number
  month: number
  rateSnapshot: number
  createdAt?: string
}

// ── Schedules ───────────────────────────────────────────────────────────────

export type ScheduleType = 'income' | 'savingsRate' | 'fixedExpense' | 'expense'

export interface Schedule {
  id?: number
  type: ScheduleType
  targetId: number | null
  effectiveYear: number
  effectiveMonth: number
  newValue: number
  previousValue?: number | null
  materializedAt?: string
  isActive: number  // IndexedDB cannot index booleans; stored as 1/0
  note?: string
  createdAt?: string
  day?: number        // 1–31, used by expense schedules
  categoryId?: number // used by expense schedules
  payeeId?: number    // used by expense schedules
}

export interface ScheduleMaterializationNotice {
  id: string
  type: ScheduleType
  title: string
  summary: string
  effectiveYear: number
  effectiveMonth: number
  effectiveLabel: string
  previousValue: number | null
  newValue: number
  appliedAt: string
}

// ── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  visualTheme: string
  font: string
  fontSize: string
  currencySymbol: string
  decimalPlaces: string
  thousandSep: string
  dateFormat: string
  hapticsEnabled: boolean
  enableCheckInReminders?: boolean
  reminderTime?: string
  reminderDays?: string[]
  reminderStyle?: string
  lastCheckInDismissedAt?: string
  lastCheckInCompletedAt?: string
  lastBackupAt?: string
}

// ── Finance Engine ──────────────────────────────────────────────────────────

export interface FinanceEngineData {
  expenses: Expense[]
  snapshots: FixedExpenseSnapshot[]
  fixedExpenses: FixedExpense[]
  globalIncome: number
  globalSavingsRate: number
  schedules?: Schedule[]
  incomeSnapshots?: IncomeSnapshot[]
  savingsSnapshots?: SavingsSnapshot[]
}

export interface MonthlySummary {
  income: number
  fixedExpensesTotal: number
  savingsRate: number
  autoSavings: number
  remaining: number
  variableExpenses: number
  fixedExpenses: Array<{
    id: number
    name: string
    amount: number
    isArchived: boolean
  }>
}

export interface MonthKey {
  year: number
  month: number
  key: string
  name: string
}

export interface MultiMonthCategoryRow {
  name: string
  totalTransactions: number
  monthlyAmounts: number[]
}

export interface MultiMonthFixedRow {
  id: number
  name: string
  monthlyAmounts: (number | null)[]
}

export interface FixedRow {
  id: string
  name: string
  amounts: number[]
  yearTotal: number
  isArchived: boolean
}

export interface YearSummary {
  months: MonthlySummary[]
  fixedRows: FixedRow[]
  monthlyFixedTotals: number[]
  monthlyVariableTotals: number[]
  monthlyTotals: number[]
  monthlySavings: number[]
  monthlyRemaining: number[]
  monthlyTotalSavings: number[]
  monthlySavingsRates: number[]
  monthlySavingsPct: (number | null)[]
  totals: {
    totalIncome: number
    totalFixed: number
    totalVariable: number
    totalSavings: number
    totalRemaining: number
    totalSavingsWithRemaining: number
    yearTotal: number
    avgSavingsPct: number
  }
}

export interface VariableGridResult {
  grid: Record<string, number[]>
  variableRows: Array<{
    key: string
    name: string
    amounts: number[]
    yearTotal: number
  }>
  monthlyVariableTotals: number[]
  maxPerMonth: number[]
  yearVariableTotal: number
}

export interface AnalyticsData {
  loading?: boolean
  year: number
  monthlyIncome: number[]
  variableRows: VariableGridResult['variableRows']
  payeeRows: VariableGridResult['variableRows']
  grid: VariableGridResult['grid']
  fixedRows: FixedRow[]
  monthlyFixedTotals: number[]
  monthlyVariableTotals: number[]
  monthlyTotals: number[]
  monthlySavings: (number | null)[]
  monthlyRemaining: (number | null)[]
  monthlyTotalSavings: (number | null)[]
  monthlySavingsRates: number[]
  monthlySavingsPct: (number | null)[]
  monthlyHasData: boolean[]
  yearVariableTotal: number
  yearFixedTotal: number
  yearTotal: number
  yearSavings: number
  yearRemaining: number
  yearTotalIncome: number
  avgSavingsPct: number
  maxPerMonth: number[]
}

export interface EditHistoricalDataMonthResult {
  month: number
  income: number
  fixedTotal: number
  fixedItems: Array<{ name: string; amount: number }>
  savingsRate: number
  autoSavings: number
  remaining: number
}

// ── Theme ───────────────────────────────────────────────────────────────────

export interface ThemeConfig {
  name: string
  id: string
  isDark?: boolean
  glassEffect?: boolean
  colors: {
    background: string
    surface: string
    primary: string
    secondary: string
    text: string
    muted: string
    border: string
    danger: string
    success: string
  }
  borderRadius: {
    small: string
    medium: string
    large: string
  }
  spacing: {
    tight: string
    normal: string
    loose: string
  }
  numberStyle: {
    currencyColor: string
    positiveColor: string
    negativeColor: string
    zeroColor: string
  }
}

// ── Sync ────────────────────────────────────────────────────────────────────

export interface SyncQueueItem {
  id?: number
  table: string
  operation: 'insert' | 'update' | 'delete' | 'upsert'
  payload: Record<string, unknown>
  timestamp: number
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

// ── Auth ────────────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: import('@supabase/supabase-js').User | null
  loading: boolean
  syncStatus: SyncStatus
  triggerSync: () => void
  signOut: () => Promise<{ error: import('@supabase/supabase-js').AuthError | null }>
}

// ── Settings Context ────────────────────────────────────────────────────────

export interface SettingsContextValue {
  settings: AppSettings
  save: (patch: Partial<AppSettings>) => Promise<void>
  currentTheme: ThemeConfig
  themeColors: ThemeConfig['colors']
  currency: (n: number | null | undefined) => string
  formatAmount: (n: number | null | undefined) => string
  formatAmountPlain: (n: number | null | undefined) => string
  getNumberColorClass: (n: number | null | undefined) => string
  formatDate: (iso: string) => string
  formatMonth: (n: number) => string
  formatShortMonth: (n: number) => string
  loaded: boolean
  availableThemes: Record<string, ThemeConfig>
}
