/**
 * SyncEngine — offline-first sync between IndexedDB and Supabase.
 *
 * Outgoing: drains the syncQueue, pushing each op to Supabase.
 * Incoming: on login / reconnect, fetches all user rows and merges
 *           into IndexedDB using last-write-wins (updated_at).
 */
import { supabase } from './supabase'
import { StorageService } from './storageService'

// Map local table names → Supabase table names
const TABLE_MAP = {
  expenses: 'expenses',
  categories: 'categories',
  fixedExpenses: 'fixed_expenses',
  fixedExpenseSnapshots: 'fixed_expense_snapshots',
  settings: 'settings',
}

// Convert a local row to a Supabase-shaped row (snake_case + user_id)
function toCloud(table, payload, userId) {
  const now = new Date().toISOString()
  const base = { user_id: userId, updated_at: now }

  if (table === 'expenses') {
    return {
      ...base,
      id: String(payload.id),
      date: payload.date,
      category_id: payload.categoryId != null ? String(payload.categoryId) : null,
      category: payload.category ?? '',
      description: payload.description ?? '',
      amount: payload.amount,
    }
  }
  if (table === 'categories') {
    return {
      ...base,
      id: String(payload.id),
      name: payload.name,
      is_archived: payload.isArchived ?? false,
      is_deleted: payload.isDeleted ?? false,
    }
  }
  if (table === 'fixedExpenses') {
    return {
      ...base,
      id: String(payload.id),
      name: payload.name,
      amount: payload.amount,
    }
  }
  if (table === 'fixedExpenseSnapshots') {
    return {
      ...base,
      id: String(payload.id),
      fixed_expense_id: String(payload.fixedExpenseId),
      name_snapshot: payload.nameSnapshot,
      amount_snapshot: payload.amountSnapshot,
      month: payload.month,
      year: payload.year,
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
function fromCloud(table, row) {
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
      isDeleted: row.is_deleted,
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
    return { key: row.key, value: JSON.parse(row.value) }
  }
  return row
}

// ── Outgoing sync ─────────────────────────────────────────────────────────────
export async function flushSyncQueue(userId) {
  if (!supabase || !userId) return

  const queue = await StorageService.getSyncQueue()
  if (queue.length === 0) return

  for (const item of queue) {
    const cloudTable = TABLE_MAP[item.table]
    if (!cloudTable) { await StorageService.removeSyncQueueItem(item.id); continue }

    try {
      if (item.operation === 'delete') {
        await supabase.from(cloudTable).delete().eq('id', String(item.payload.id)).eq('user_id', userId)
      } else {
        // insert or update → upsert
        const row = toCloud(item.table, item.payload, userId)
        await supabase.from(cloudTable).upsert(row, { onConflict: 'id' })
      }
      await StorageService.removeSyncQueueItem(item.id)
    } catch (err) {
      console.warn('Sync flush error:', err)
      break // stop on first error; retry next time
    }
  }
}

// ── Incoming sync ─────────────────────────────────────────────────────────────
export async function pullFromSupabase(userId) {
  if (!supabase || !userId) return

  const [expRes, catRes, fixRes, snapRes, setRes] = await Promise.all([
    supabase.from('expenses').select('*').eq('user_id', userId),
    supabase.from('categories').select('*').eq('user_id', userId),
    supabase.from('fixed_expenses').select('*').eq('user_id', userId),
    supabase.from('fixed_expense_snapshots').select('*').eq('user_id', userId),
    supabase.from('settings').select('*').eq('user_id', userId),
  ])

  if (expRes.data?.length) {
    await StorageService.bulkUpsertExpenses(expRes.data.map((r) => fromCloud('expenses', r)))
  }
  if (catRes.data?.length) {
    await StorageService.bulkUpsertCategories(catRes.data.map((r) => fromCloud('categories', r)))
  }
  if (fixRes.data?.length) {
    await StorageService.bulkUpsertFixedExpenses(fixRes.data.map((r) => fromCloud('fixed_expenses', r)))
  }
  if (snapRes.data?.length) {
    await StorageService.bulkUpsertSnapshots(snapRes.data.map((r) => fromCloud('fixed_expense_snapshots', r)))
  }
  if (setRes.data?.length) {
    for (const row of setRes.data) {
      const local = fromCloud('settings', row)
      await StorageService.setSetting(local.key, local.value)
    }
  }
}

// ── Theme profile sync ────────────────────────────────────────────────────────
export async function syncThemeToProfile(userId, themeId) {
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

export async function fetchThemeFromProfile(userId) {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase.from('profiles').select('selected_theme').eq('id', userId).single()
    if (error) return null
    return data?.selected_theme ?? null
  } catch (err) {
    console.warn('Profile theme fetch error:', err)
    return null
  }
}

// ── Initial migration: push all local data to Supabase once ──────────────────
export async function migrateLocalToSupabase(userId) {
  if (!supabase || !userId) return

  const [expenses, categories, fixedExpenses] = await Promise.all([
    StorageService.getAll(),
    StorageService.getCategories(),
    StorageService.getFixedExpenses(),
  ])

  const upsert = (table, rows) =>
    rows.length ? supabase.from(table).upsert(rows, { onConflict: 'id' }) : Promise.resolve()

  await Promise.all([
    upsert('expenses', expenses.map((r) => toCloud('expenses', r, userId))),
    upsert('categories', categories.map((r) => toCloud('categories', r, userId))),
    upsert('fixed_expenses', fixedExpenses.map((r) => toCloud('fixedExpenses', r, userId))),
  ])
}
