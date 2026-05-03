/**
 * SyncEngine — offline-first sync between IndexedDB and Supabase.
 *
 * Outgoing: drains the syncQueue, pushing each op to Supabase.
 * Incoming: on login / reconnect, fetches all user rows and merges
 *           into IndexedDB using last-write-wins (updated_at).
 */
import { supabase } from './supabase'
import { StorageService } from './storageService'
import { Expense, Category, FixedExpense, FixedExpenseSnapshot, SyncQueueItem } from '../types'

// Map local table names → Supabase table names
const TABLE_MAP: Record<string, string> = {
  expenses: 'expenses',
  categories: 'categories',
  fixedExpenses: 'fixed_expenses',
  fixedExpenseSnapshots: 'fixed_expense_snapshots',
  settings: 'settings',
}

// Convert a local row to a Supabase-shaped row (snake_case + user_id)
function toCloud(table: string, payload: Record<string, unknown>, userId: string): Record<string, unknown> {
  const now = new Date().toISOString()
  const base = { user_id: userId, updated_at: now }

  if (table === 'expenses') {
    const p = payload as unknown as Expense
    return {
      ...base,
      id: String(p.id),
      date: p.date,
      category_id: p.categoryId != null ? String(p.categoryId) : null,
      category: p.category ?? '',
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
    }
  }
  if (table === 'fixedExpenses') {
    const p = payload as unknown as FixedExpense
    return {
      ...base,
      id: String(p.id),
      name: p.name,
      amount: p.amount,
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
      id: row.id,
      date: row.date,
      categoryId: row.category_id,
      category: row.category ?? '',
      description: row.description ?? '',
      amount: row.amount,
    }
  }
  if (table === 'categories') {
    return {
      id: row.id,
      name: row.name,
      isArchived: row.is_archived,
      createdAt: row.created_at ?? new Date().toISOString(),
    }
  }
  if (table === 'fixed_expenses') {
    return { id: row.id, name: row.name, amount: row.amount }
  }
  if (table === 'fixed_expense_snapshots') {
    return {
      id: row.id,
      fixedExpenseId: row.fixed_expense_id,
      nameSnapshot: row.name_snapshot,
      amountSnapshot: row.amount_snapshot,
      month: row.month,
      year: row.year,
      createdAt: row.created_at,
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

  const queue = await StorageService.getSyncQueue() as SyncQueueItem[]
  if (queue.length === 0) return

  for (const item of queue) {
    const cloudTable = TABLE_MAP[item.table]
    if (!cloudTable) { await StorageService.removeSyncQueueItem(item.id as number); continue }

    try {
      if (item.operation === 'delete') {
        const payload = item.payload as Record<string, unknown>
        await supabase.from(cloudTable).delete().eq('id', String(payload.id)).eq('user_id', userId)
      } else {
        // insert or update → upsert
        const row = toCloud(item.table, item.payload, userId)
        await supabase.from(cloudTable).upsert(row, { onConflict: 'id' })
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

  const [expRes, catRes, fixRes, snapRes, setRes] = await Promise.all([
    supabase.from('expenses').select('*').eq('user_id', userId),
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('fixed_expenses').select('*').eq('user_id', userId),
    supabase.from('fixed_expense_snapshots').select('*').eq('user_id', userId),
    supabase.from('settings').select('*').eq('user_id', userId),
  ])

  if (expRes.data?.length) {
    await StorageService.bulkUpsertExpenses(expRes.data.map((r: unknown) => fromCloud('expenses', r as Record<string, unknown>) as unknown as Expense))
  }
  if (catRes.data?.length) {
    await StorageService.bulkUpsertCategories(catRes.data.map((r: unknown) => fromCloud('categories', r as Record<string, unknown>) as unknown as Category))
  }
  if (fixRes.data?.length) {
    await StorageService.bulkUpsertFixedExpenses(fixRes.data.map((r: unknown) => fromCloud('fixed_expenses', r as Record<string, unknown>) as unknown as FixedExpense))
  }
  if (snapRes.data?.length) {
    await StorageService.bulkUpsertSnapshots(snapRes.data.map((r: unknown) => fromCloud('fixed_expense_snapshots', r as Record<string, unknown>) as unknown as FixedExpenseSnapshot))
  }
  if (setRes.data?.length) {
    for (const row of setRes.data) {
      const local = fromCloud('settings', row as Record<string, unknown>)
      await StorageService.setSetting(String(local.key), local.value)
    }
  }
}

// ── Theme profile sync ────────────────────────────────────────────────────────
export async function syncThemeToProfile(userId: string, themeId: string): Promise<void> {
  if (!supabase || !userId) return
  try {
    await supabase.from('profiles').upsert(
      { id: userId, selected_theme: themeId, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
  } catch (err) {
    console.warn('Profile theme sync error:', err)
  }
}

export async function fetchThemeFromProfile(userId: string): Promise<string | null> {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase.from('profiles').select('selected_theme').eq('id', userId).single()
    if (error) return null
    return (data as Record<string, unknown> | null)?.selected_theme as string | null ?? null
  } catch (err) {
    console.warn('Profile theme fetch error:', err)
    return null
  }
}

// ── Backup password sync ──────────────────────────────────────────────────────
export async function syncBackupPasswordToProfile(userId: string, backupPassword: string): Promise<void> {
  if (!supabase || !userId) return
  try {
    await supabase.from('profiles').upsert(
      { id: userId, backup_password: backupPassword, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
  } catch (err) {
    console.warn('Profile backup password sync error:', err)
  }
}

export async function fetchBackupPasswordFromProfile(userId: string): Promise<string | null> {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase.from('profiles').select('backup_password').eq('id', userId).single()
    if (error) return null
    return (data as Record<string, unknown> | null)?.backup_password as string | null ?? null
  } catch (err) {
    console.warn('Profile backup password fetch error:', err)
    return null
  }
}

// ── Initial migration: push all local data to Supabase once ──────────────────
export async function migrateLocalToSupabase(userId: string): Promise<void> {
  if (!supabase || !userId) return

  const [expenses, categories, fixedExpenses] = await Promise.all([
    StorageService.getAll() as Promise<Expense[]>,
    StorageService.getCategories() as Promise<Category[]>,
    StorageService.getFixedExpenses() as Promise<FixedExpense[]>,
  ])

  const client = supabase
  const upsert = async (table: string, rows: Record<string, unknown>[]): Promise<void> => {
    if (rows.length) {
      await client.from(table).upsert(rows, { onConflict: 'id' })
    }
  }

  await Promise.all([
    upsert('expenses', expenses.map((r) => toCloud('expenses', r as unknown as Record<string, unknown>, userId))),
    upsert('categories', categories.map((r) => toCloud('categories', r as unknown as Record<string, unknown>, userId))),
    upsert('fixed_expenses', fixedExpenses.map((r) => toCloud('fixedExpenses', r as unknown as Record<string, unknown>, userId))),
  ])
}
