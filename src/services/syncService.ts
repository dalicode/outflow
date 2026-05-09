/**
 * SyncEngine — offline-first sync between IndexedDB and Supabase.
 *
 * Outgoing: drains the syncQueue, pushing each op to Supabase.
 * Incoming: on login / reconnect, fetches all user rows and merges
 *           into IndexedDB using last-write-wins (updated_at).
 */

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
} from '../types'
import { StorageService } from './storageService'
import { supabase } from './supabase'

// Map local table names → Supabase table names
const TABLE_MAP: Record<string, string> = {
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

function toNumberOrUndefined(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
}

// Convert a local row to a Supabase-shaped row (snake_case + user_id)
function toCloud(
  table: string,
  payload: Record<string, unknown>,
  userId: string,
): Record<string, unknown> {
  const now = new Date().toISOString()
  const base = { user_id: userId, updated_at: now }

  if (table === 'expenses') {
    const p = payload as unknown as Expense
    return {
      ...base,
      id: String(p.id),
      date: p.date,
      category_id: p.categoryId != null ? String(p.categoryId) : null,
      payee_id: p.payeeId != null ? String(p.payeeId) : null,
      description: p.description ?? '',
      amount: p.amount,
    }
  }
  if (table === 'categories') {
    const p = payload as unknown as Category
    return {
      ...base,
      id: String(p.id),
      name: p.name,
      is_archived: p.isArchived ?? false,
      archived_at: p.archivedAt ?? null,
      merged_into_category_id:
        (p as unknown as Record<string, unknown>).mergedIntoCategoryId != null
          ? String((p as unknown as Record<string, unknown>).mergedIntoCategoryId)
          : null,
    }
  }
  if (table === 'payees') {
    const p = payload as unknown as Payee
    return {
      ...base,
      id: String(p.id),
      name: p.name,
      is_archived: p.isArchived ?? false,
      archived_at: p.archivedAt ?? null,
      merged_into_payee_id: p.mergedIntoPayeeId != null ? String(p.mergedIntoPayeeId) : null,
    }
  }
  if (table === 'fixedExpenses') {
    const p = payload as unknown as FixedExpense
    return {
      ...base,
      id: String(p.id),
      name: p.name,
      amount: p.amount,
      is_archived: p.isArchived ?? false,
      archived_at: p.archivedAt ?? null,
    }
  }
  if (table === 'fixedExpenseSnapshots') {
    const p = payload as unknown as FixedExpenseSnapshot
    return {
      ...base,
      id: String(p.id),
      fixed_expense_id: String(p.fixedExpenseId),
      name_snapshot: p.nameSnapshot,
      amount_snapshot: p.amountSnapshot,
      month: p.month,
      year: p.year,
    }
  }
  if (table === 'incomeSnapshots') {
    const p = payload as unknown as IncomeSnapshot
    return {
      ...base,
      id: String(p.id ?? `${p.year}-${p.month}`),
      year: p.year,
      month: p.month,
      amount_snapshot: p.amountSnapshot,
      created_at: p.createdAt ?? now,
    }
  }
  if (table === 'savingsSnapshots') {
    const p = payload as unknown as SavingsSnapshot
    return {
      ...base,
      id: String(p.id ?? `${p.year}-${p.month}`),
      year: p.year,
      month: p.month,
      rate_snapshot: p.rateSnapshot,
      created_at: p.createdAt ?? now,
    }
  }
  if (table === 'schedules') {
    const p = payload as unknown as Schedule
    return {
      ...base,
      id: String(p.id),
      type: p.type,
      target_id: p.targetId != null ? String(p.targetId) : null,
      effective_year: p.effectiveYear,
      effective_month: p.effectiveMonth,
      new_value: p.newValue,
      previous_value: p.previousValue ?? null,
      materialized_at: p.materializedAt ?? null,
      is_active: p.isActive,
      note: p.note ?? null,
      day: p.day ?? null,
      category_id: p.categoryId != null ? String(p.categoryId) : null,
      payee_id: p.payeeId != null ? String(p.payeeId) : null,
    }
  }
  if (table === 'categoryMergeHistory') {
    const p = payload as unknown as CategoryMergeHistory
    return {
      ...base,
      id: String(p.id ?? `${p.sourceCategoryId}-${p.targetCategoryId}-${p.createdAt}`),
      source_category_id: String(p.sourceCategoryId),
      target_category_id: String(p.targetCategoryId),
      affected_expense_ids: p.affectedExpenseIds,
      created_at: p.createdAt,
      reverted_at: p.revertedAt ?? null,
    }
  }
  if (table === 'payeeMergeHistory') {
    const p = payload as unknown as PayeeMergeHistory
    return {
      ...base,
      id: String(p.id ?? `${p.sourcePayeeId}-${p.targetPayeeId}-${p.createdAt}`),
      source_payee_id: String(p.sourcePayeeId),
      target_payee_id: String(p.targetPayeeId),
      affected_expense_ids: p.affectedExpenseIds,
      created_at: p.createdAt,
      reverted_at: p.revertedAt ?? null,
    }
  }
  if (table === 'settings') {
    return {
      ...base,
      key: payload.key,
      value: JSON.stringify(payload.value),
    }
  }
  return { ...base, ...payload }
}

// Convert a Supabase row back to a local IndexedDB row
function fromCloud(table: string, row: Record<string, unknown>): Record<string, unknown> {
  if (table === 'expenses') {
    return {
      id: toNumberOrUndefined(row.id),
      date: row.date,
      categoryId: toNumberOrUndefined(row.category_id),
      payeeId: toNumberOrUndefined(row.payee_id),
      description: row.description ?? '',
      amount: row.amount,
    }
  }
  if (table === 'categories') {
    return {
      id: toNumberOrUndefined(row.id),
      name: row.name,
      isArchived: row.is_archived,
      createdAt: row.created_at ?? new Date().toISOString(),
      archivedAt: row.archived_at ?? undefined,
      mergedIntoCategoryId: toNumberOrUndefined(row.merged_into_category_id),
    }
  }
  if (table === 'payees') {
    return {
      id: toNumberOrUndefined(row.id),
      name: row.name,
      isArchived: row.is_archived,
      createdAt: row.created_at ?? new Date().toISOString(),
      aliases: Array.isArray(row.aliases) ? row.aliases : [],
      archivedAt: row.archived_at ?? undefined,
      mergedIntoPayeeId: toNumberOrUndefined(row.merged_into_payee_id),
    }
  }
  if (table === 'fixed_expenses') {
    return {
      id: toNumberOrUndefined(row.id),
      name: row.name,
      amount: row.amount,
      isArchived: row.is_archived,
      archivedAt: row.archived_at ?? undefined,
    }
  }
  if (table === 'fixed_expense_snapshots') {
    return {
      id: toNumberOrUndefined(row.id),
      fixedExpenseId: toNumberOrUndefined(row.fixed_expense_id),
      nameSnapshot: row.name_snapshot,
      amountSnapshot: row.amount_snapshot,
      month: row.month,
      year: row.year,
      createdAt: row.created_at,
    }
  }
  if (table === 'income_snapshots') {
    return {
      id: toNumberOrUndefined(row.id),
      year: row.year,
      month: row.month,
      amountSnapshot: row.amount_snapshot,
      createdAt: row.created_at,
    }
  }
  if (table === 'savings_snapshots') {
    return {
      id: toNumberOrUndefined(row.id),
      year: row.year,
      month: row.month,
      rateSnapshot: row.rate_snapshot,
      createdAt: row.created_at,
    }
  }
  if (table === 'schedules') {
    const isActiveValue = row.is_active
    return {
      id: toNumberOrUndefined(row.id),
      type: row.type,
      targetId: toNumberOrUndefined(row.target_id) ?? null,
      effectiveYear: row.effective_year,
      effectiveMonth: row.effective_month,
      newValue: row.new_value,
      previousValue: row.previous_value ?? null,
      materializedAt: row.materialized_at ?? undefined,
      isActive: isActiveValue === true || Number(isActiveValue) === 1 ? 1 : 0,
      note: row.note ?? undefined,
      createdAt: row.created_at,
      day: row.day ?? undefined,
      categoryId: toNumberOrUndefined(row.category_id),
      payeeId: toNumberOrUndefined(row.payee_id),
    }
  }
  if (table === 'category_merge_history') {
    return {
      id: toNumberOrUndefined(row.id),
      sourceCategoryId: toNumberOrUndefined(row.source_category_id) ?? 0,
      targetCategoryId: toNumberOrUndefined(row.target_category_id) ?? 0,
      affectedExpenseIds: toNumberArray(row.affected_expense_ids),
      createdAt: row.created_at,
      revertedAt: row.reverted_at ?? null,
    }
  }
  if (table === 'payee_merge_history') {
    return {
      id: toNumberOrUndefined(row.id),
      sourcePayeeId: toNumberOrUndefined(row.source_payee_id) ?? 0,
      targetPayeeId: toNumberOrUndefined(row.target_payee_id) ?? 0,
      affectedExpenseIds: toNumberArray(row.affected_expense_ids),
      createdAt: row.created_at,
      revertedAt: row.reverted_at ?? null,
    }
  }
  if (table === 'settings') {
    return { key: row.key, value: JSON.parse(String(row.value)) }
  }
  return row
}

// ── Outgoing sync ─────────────────────────────────────────────────────────────
export async function flushSyncQueue(userId: string): Promise<void> {
  if (!supabase || !userId) return

  const queue = (await StorageService.getSyncQueue()) as SyncQueueItem[]
  if (queue.length === 0) return

  for (const item of queue) {
    const cloudTable = TABLE_MAP[item.table]
    if (!cloudTable) {
      await StorageService.removeSyncQueueItem(item.id as number)
      continue
    }

    try {
      const row = toCloud(item.table, item.payload, userId)
      if (item.operation === 'delete') {
        const payload = item.payload as Record<string, unknown>
        await supabase.from(cloudTable).delete().eq('id', String(payload.id)).eq('user_id', userId)
      } else {
        // insert or update → upsert
        if (item.table === 'settings') {
          await supabase.from(cloudTable).upsert(row, { onConflict: 'user_id,key' })
        } else {
          await supabase.from(cloudTable).upsert(row, { onConflict: 'id' })
        }
      }
      await StorageService.removeSyncQueueItem(item.id as number)
    } catch (err) {
      console.warn('Sync flush error:', err)
      break // stop on first error; retry next time
    }
  }
}

// ── Incoming sync ─────────────────────────────────────────────────────────────
export async function pullFromSupabase(userId: string): Promise<void> {
  if (!supabase || !userId) return

  const [
    expRes,
    catRes,
    payRes,
    fixRes,
    snapRes,
    incomeSnapRes,
    savingsSnapRes,
    scheduleRes,
    categoryMergeRes,
    payeeMergeRes,
    setRes,
  ] = await Promise.all([
    supabase.from('expenses').select('*').eq('user_id', userId),
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('payees').select('*').eq('user_id', userId),
    supabase.from('fixed_expenses').select('*').eq('user_id', userId),
    supabase.from('fixed_expense_snapshots').select('*').eq('user_id', userId),
    supabase.from('income_snapshots').select('*').eq('user_id', userId),
    supabase.from('savings_snapshots').select('*').eq('user_id', userId),
    supabase.from('schedules').select('*').eq('user_id', userId),
    supabase.from('category_merge_history').select('*').eq('user_id', userId),
    supabase.from('payee_merge_history').select('*').eq('user_id', userId),
    supabase.from('settings').select('*').eq('user_id', userId),
  ])

  if (expRes.data?.length) {
    await StorageService.bulkUpsertExpenses(
      expRes.data.map(
        (r: unknown) => fromCloud('expenses', r as Record<string, unknown>) as unknown as Expense,
      ),
    )
  }
  if (catRes.data?.length) {
    await StorageService.bulkUpsertCategories(
      catRes.data.map(
        (r: unknown) =>
          fromCloud('categories', r as Record<string, unknown>) as unknown as Category,
      ),
    )
  }
  if (payRes.data?.length) {
    await StorageService.bulkUpsertPayees(
      payRes.data.map(
        (r: unknown) => fromCloud('payees', r as Record<string, unknown>) as unknown as Payee,
      ),
    )
  }
  if (fixRes.data?.length) {
    await StorageService.bulkUpsertFixedExpenses(
      fixRes.data.map(
        (r: unknown) =>
          fromCloud('fixed_expenses', r as Record<string, unknown>) as unknown as FixedExpense,
      ),
    )
  }
  if (snapRes.data?.length) {
    await StorageService.bulkUpsertSnapshots(
      snapRes.data.map(
        (r: unknown) =>
          fromCloud(
            'fixed_expense_snapshots',
            r as Record<string, unknown>,
          ) as unknown as FixedExpenseSnapshot,
      ),
    )
  }
  if (incomeSnapRes.data?.length) {
    await StorageService.bulkUpsertIncomeSnapshots(
      incomeSnapRes.data.map(
        (r: unknown) =>
          fromCloud('income_snapshots', r as Record<string, unknown>) as unknown as IncomeSnapshot,
      ),
    )
  }
  if (savingsSnapRes.data?.length) {
    await StorageService.bulkUpsertSavingsSnapshots(
      savingsSnapRes.data.map(
        (r: unknown) =>
          fromCloud(
            'savings_snapshots',
            r as Record<string, unknown>,
          ) as unknown as SavingsSnapshot,
      ),
    )
  }
  if (scheduleRes.data?.length) {
    await StorageService.db.schedules.bulkPut(
      scheduleRes.data.map(
        (r: unknown) => fromCloud('schedules', r as Record<string, unknown>) as unknown as Schedule,
      ),
    )
  }
  if (categoryMergeRes.data?.length) {
    await StorageService.db.categoryMergeHistory.bulkPut(
      categoryMergeRes.data.map(
        (r: unknown) =>
          fromCloud(
            'category_merge_history',
            r as Record<string, unknown>,
          ) as unknown as CategoryMergeHistory,
      ),
    )
  }
  if (payeeMergeRes.data?.length) {
    await StorageService.db.payeeMergeHistory.bulkPut(
      payeeMergeRes.data.map(
        (r: unknown) =>
          fromCloud(
            'payee_merge_history',
            r as Record<string, unknown>,
          ) as unknown as PayeeMergeHistory,
      ),
    )
  }
  if (setRes.data?.length) {
    for (const row of setRes.data) {
      const local = fromCloud('settings', row as Record<string, unknown>)
      await StorageService.db.settings.put({ key: String(local.key), value: local.value })
    }
  }
}

// ── Theme profile sync ────────────────────────────────────────────────────────
export async function syncThemeToProfile(userId: string, themeId: string): Promise<void> {
  if (!supabase || !userId) return
  try {
    await supabase
      .from('profiles')
      .upsert(
        { id: userId, selected_theme: themeId, updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      )
  } catch (err) {
    console.warn('Profile theme sync error:', err)
  }
}

export async function fetchThemeFromProfile(userId: string): Promise<string | null> {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('selected_theme')
      .eq('id', userId)
      .single()
    if (error) return null
    return ((data as Record<string, unknown> | null)?.selected_theme as string | null) ?? null
  } catch (err) {
    console.warn('Profile theme fetch error:', err)
    return null
  }
}

// ── Backup password sync ──────────────────────────────────────────────────────
export async function syncBackupPasswordToProfile(
  userId: string,
  backupPassword: string,
): Promise<void> {
  if (!supabase || !userId) return
  try {
    await supabase
      .from('profiles')
      .upsert(
        { id: userId, backup_password: backupPassword, updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      )
  } catch (err) {
    console.warn('Profile backup password sync error:', err)
  }
}

export async function fetchBackupPasswordFromProfile(userId: string): Promise<string | null> {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('backup_password')
      .eq('id', userId)
      .single()
    if (error) return null
    return ((data as Record<string, unknown> | null)?.backup_password as string | null) ?? null
  } catch (err) {
    console.warn('Profile backup password fetch error:', err)
    return null
  }
}

// ── Initial migration: push all local data to Supabase once ──────────────────
export async function migrateLocalToSupabase(userId: string): Promise<void> {
  if (!supabase || !userId) return

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

  const client = supabase
  const upsert = async (
    table: string,
    rows: Record<string, unknown>[],
    onConflict = 'id',
  ): Promise<void> => {
    if (rows.length) {
      await client.from(table).upsert(rows, { onConflict })
    }
  }

  await Promise.all([
    upsert(
      'expenses',
      expenses.map((r) => toCloud('expenses', r as unknown as Record<string, unknown>, userId)),
    ),
    upsert(
      'categories',
      categories.map((r) => toCloud('categories', r as unknown as Record<string, unknown>, userId)),
    ),
    upsert(
      'payees',
      payees.map((r) => toCloud('payees', r as unknown as Record<string, unknown>, userId)),
    ),
    upsert(
      'fixed_expenses',
      fixedExpenses.map((r) =>
        toCloud('fixedExpenses', r as unknown as Record<string, unknown>, userId),
      ),
    ),
    upsert(
      'fixed_expense_snapshots',
      fixedExpenseSnapshots.map((r) =>
        toCloud('fixedExpenseSnapshots', r as unknown as Record<string, unknown>, userId),
      ),
    ),
    upsert(
      'income_snapshots',
      incomeSnapshots.map((r) =>
        toCloud('incomeSnapshots', r as unknown as Record<string, unknown>, userId),
      ),
    ),
    upsert(
      'savings_snapshots',
      savingsSnapshots.map((r) =>
        toCloud('savingsSnapshots', r as unknown as Record<string, unknown>, userId),
      ),
    ),
    upsert(
      'schedules',
      schedules.map((r) => toCloud('schedules', r as unknown as Record<string, unknown>, userId)),
    ),
    upsert(
      'category_merge_history',
      categoryMergeHistory.map((r) =>
        toCloud('categoryMergeHistory', r as unknown as Record<string, unknown>, userId),
      ),
    ),
    upsert(
      'payee_merge_history',
      payeeMergeHistory.map((r) =>
        toCloud('payeeMergeHistory', r as unknown as Record<string, unknown>, userId),
      ),
    ),
    upsert(
      'settings',
      settings.map((r) => toCloud('settings', r as unknown as Record<string, unknown>, userId)),
      'user_id,key',
    ),
  ])
}
