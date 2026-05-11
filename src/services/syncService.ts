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
import db from './db/schema'
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
interface ToCloudMaps {
  categoryIdToCloudId?: Map<number, string>
  payeeIdToCloudId?: Map<number, string>
  fixedExpenseIdToCloudId?: Map<number, string>
  categoryCloudIdToMergeTarget?: Map<string, string>
  payeeCloudIdToMergeTarget?: Map<string, string>
}

function toCloud(
  table: string,
  payload: Record<string, unknown>,
  userId: string,
  maps?: ToCloudMaps,
): Record<string, unknown> {
  const now = new Date().toISOString()
  const base = { user_id: userId, updated_at: now }

  function cat(id: number | undefined | null) {
    if (id == null) return null
    return maps?.categoryIdToCloudId?.get(id) ?? String(id)
  }
  function pay(id: number | undefined | null) {
    if (id == null) return null
    return maps?.payeeIdToCloudId?.get(id) ?? String(id)
  }

  if (table === 'expenses') {
    const p = payload as unknown as Expense
    return {
      ...base,
      id: p.cloudId ?? String(p.id),
      date: p.date,
      category_id: cat(p.categoryId),
      payee_id: pay(p.payeeId),
      description: p.description ?? '',
      amount: p.amount,
    }
  }
  if (table === 'categories') {
    const p = payload as unknown as Category
    return {
      ...base,
      id: p.cloudId ?? String(p.id),
      name: p.name,
      is_archived: p.isArchived ?? false,
      archived_at: p.archivedAt ?? null,
      merged_into_category_id: cat(p.mergedIntoCategoryId),
    }
  }
  if (table === 'payees') {
    const p = payload as unknown as Payee
    return {
      ...base,
      id: p.cloudId ?? String(p.id),
      name: p.name,
      is_archived: p.isArchived ?? false,
      archived_at: p.archivedAt ?? null,
      merged_into_payee_id: pay(p.mergedIntoPayeeId),
    }
  }
  if (table === 'fixedExpenses') {
    const p = payload as unknown as FixedExpense
    return {
      ...base,
      id: p.cloudId ?? String(p.id),
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
      id: p.cloudId ?? String(p.id),
      fixed_expense_id: maps?.fixedExpenseIdToCloudId?.get(p.fixedExpenseId) ?? String(p.fixedExpenseId),
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
      id: p.cloudId ?? String(p.id ?? `${p.year}-${p.month}`),
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
      id: p.cloudId ?? String(p.id ?? `${p.year}-${p.month}`),
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
      id: p.cloudId ?? String(p.id),
      type: p.type,
      target_id: maps?.fixedExpenseIdToCloudId?.get(p.targetId as number) ?? String(p.targetId),
      effective_year: p.effectiveYear,
      effective_month: p.effectiveMonth,
      new_value: p.newValue,
      previous_value: p.previousValue ?? null,
      materialized_at: p.materializedAt ?? null,
      is_active: p.isActive,
      note: p.note ?? null,
      day: p.day ?? null,
      category_id: cat(p.categoryId),
      payee_id: pay(p.payeeId),
    }
  }
  if (table === 'categoryMergeHistory') {
    const p = payload as unknown as CategoryMergeHistory
    return {
      ...base,
      id: p.cloudId ?? String(p.id ?? `${p.sourceCategoryId}-${p.targetCategoryId}-${p.createdAt}`),
      source_category_id: cat(p.sourceCategoryId),
      target_category_id: cat(p.targetCategoryId),
      affected_expense_ids: p.affectedExpenseIds,
      created_at: p.createdAt,
      reverted_at: p.revertedAt ?? null,
    }
  }
  if (table === 'payeeMergeHistory') {
    const p = payload as unknown as PayeeMergeHistory
    return {
      ...base,
      id: p.cloudId ?? String(p.id ?? `${p.sourcePayeeId}-${p.targetPayeeId}-${p.createdAt}`),
      source_payee_id: pay(p.sourcePayeeId),
      target_payee_id: pay(p.targetPayeeId),
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
interface FromCloudMaps {
  cloudIdToCategoryId?: Map<string, number>
  cloudIdToPayeeId?: Map<string, number>
  cloudIdToFixedExpenseId?: Map<string, number>
}

function fromCloud(
  table: string,
  row: Record<string, unknown>,
  maps?: FromCloudMaps,
): Record<string, unknown> {
  const cid = String(row.id)

  function resolveCat(cloudId: unknown) {
    if (cloudId == null) return undefined
    return maps?.cloudIdToCategoryId?.get(String(cloudId))
  }
  function resolvePay(cloudId: unknown) {
    if (cloudId == null) return undefined
    return maps?.cloudIdToPayeeId?.get(String(cloudId))
  }
  function resolveFixed(cloudId: unknown) {
    if (cloudId == null) return undefined
    return maps?.cloudIdToFixedExpenseId?.get(String(cloudId))
  }

  if (table === 'expenses') {
    return {
      cloudId: cid,
      date: row.date,
      categoryId: resolveCat(row.category_id),
      payeeId: resolvePay(row.payee_id),
      description: row.description ?? '',
      amount: row.amount,
      updatedAt: row.updated_at as string | undefined,
    }
  }
  if (table === 'categories') {
    return {
      cloudId: cid,
      name: row.name,
      isArchived: row.is_archived,
      createdAt: row.created_at ?? new Date().toISOString(),
      updatedAt: row.updated_at as string | undefined,
      archivedAt: row.archived_at ?? undefined,
      mergedIntoCategoryId: resolveCat(row.merged_into_category_id),
    }
  }
  if (table === 'payees') {
    return {
      cloudId: cid,
      name: row.name,
      isArchived: row.is_archived,
      createdAt: row.created_at ?? new Date().toISOString(),
      updatedAt: row.updated_at as string | undefined,
      aliases: Array.isArray(row.aliases) ? row.aliases : [],
      archivedAt: row.archived_at ?? undefined,
      mergedIntoPayeeId: resolvePay(row.merged_into_payee_id),
    }
  }
  if (table === 'fixed_expenses') {
    return {
      cloudId: cid,
      name: row.name,
      amount: row.amount,
      isArchived: row.is_archived,
      updatedAt: row.updated_at as string | undefined,
      archivedAt: row.archived_at ?? undefined,
    }
  }
  if (table === 'fixed_expense_snapshots') {
    return {
      cloudId: cid,
      fixedExpenseId: resolveFixed(row.fixed_expense_id) ?? toNumberOrUndefined(row.fixed_expense_id),
      nameSnapshot: row.name_snapshot,
      amountSnapshot: row.amount_snapshot,
      month: row.month,
      year: row.year,
      updatedAt: row.updated_at as string | undefined,
      createdAt: row.created_at as string | undefined,
    }
  }
  if (table === 'income_snapshots') {
    return {
      cloudId: cid,
      year: row.year,
      month: row.month,
      amountSnapshot: row.amount_snapshot,
      updatedAt: row.updated_at as string | undefined,
      createdAt: row.created_at as string | undefined,
    }
  }
  if (table === 'savings_snapshots') {
    return {
      cloudId: cid,
      year: row.year,
      month: row.month,
      rateSnapshot: row.rate_snapshot,
      updatedAt: row.updated_at as string | undefined,
      createdAt: row.created_at as string | undefined,
    }
  }
  if (table === 'schedules') {
    const isActiveValue = row.is_active
    return {
      cloudId: cid,
      type: row.type,
      targetId: resolveFixed(row.target_id) ?? toNumberOrUndefined(row.target_id) ?? null,
      effectiveYear: row.effective_year,
      effectiveMonth: row.effective_month,
      newValue: row.new_value,
      previousValue: row.previous_value ?? null,
      materializedAt: row.materialized_at ?? undefined,
      isActive: isActiveValue === true || Number(isActiveValue) === 1 ? 1 : 0,
      note: row.note ?? undefined,
      updatedAt: row.updated_at as string | undefined,
      createdAt: row.created_at as string | undefined,
      day: row.day ?? undefined,
      categoryId: resolveCat(row.category_id),
      payeeId: resolvePay(row.payee_id),
    }
  }
  if (table === 'category_merge_history') {
    return {
      cloudId: cid,
      sourceCategoryId: resolveCat(row.source_category_id) ?? 0,
      targetCategoryId: resolveCat(row.target_category_id) ?? 0,
      affectedExpenseIds: toNumberArray(row.affected_expense_ids),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string | undefined,
      revertedAt: row.reverted_at ?? null,
    }
  }
  if (table === 'payee_merge_history') {
    return {
      cloudId: cid,
      sourcePayeeId: resolvePay(row.source_payee_id) ?? 0,
      targetPayeeId: resolvePay(row.target_payee_id) ?? 0,
      affectedExpenseIds: toNumberArray(row.affected_expense_ids),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string | undefined,
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

  // Build FK maps so cloud records use UUIDs for foreign keys, not numeric strings
  const [categories, payees, fixedExpenses] = await Promise.all([
    StorageService.getCategories() as Promise<Category[]>,
    StorageService.getPayees() as Promise<Payee[]>,
    StorageService.getFixedExpenses() as Promise<FixedExpense[]>,
  ])
  const maps: ToCloudMaps = {
    categoryIdToCloudId: new Map(categories.filter((c) => c.cloudId).map((c) => [c.id!, c.cloudId!])),
    payeeIdToCloudId: new Map(payees.filter((p) => p.cloudId).map((p) => [p.id!, p.cloudId!])),
    fixedExpenseIdToCloudId: new Map(fixedExpenses.filter((f) => f.cloudId).map((f) => [f.id!, f.cloudId!])),
  }

  for (const item of queue) {
    const cloudTable = TABLE_MAP[item.table]
    if (!cloudTable) {
      await StorageService.removeSyncQueueItem(item.id as number)
      continue
    }

    try {
      const row = toCloud(item.table, item.payload, userId, maps)
      if (item.operation === 'delete') {
        const payload = item.payload as Record<string, unknown>
        const cloudId = (payload.cloudId as string) || String(payload.id)
        await supabase.from(cloudTable).delete().eq('id', cloudId).eq('user_id', userId)
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

// ── Merge helper ──────────────────────────────────────────────────────────────
async function mergeByCloudId(
  tableName: string,
  cloudRows: Record<string, unknown>[],
): Promise<void> {
  if (cloudRows.length === 0) return
  const table = db.table<unknown, number>(tableName)
  const existing = (await table.toArray()) as Array<Record<string, unknown>>
  const localByCloudId = new Map(
    existing.filter((r) => r.cloudId).map((r) => [r.cloudId as string, r]),
  )
  for (const row of cloudRows) {
    const cid = row.cloudId as string | undefined
    if (cid && localByCloudId.has(cid)) {
      const local = localByCloudId.get(cid)!
      const cloudTime = new Date((row.updatedAt as string) || 0).getTime()
      const localTime = new Date((local.updatedAt as string) || 0).getTime()
      if (cloudTime > localTime) {
        await table.update(local.id as number, row)
      }
    } else {
      await table.add(row)
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

  // Build FK resolution maps from categories and payees (cloudId → local numeric ID)
  const existingCats = await db.categories.toArray()
  const existingPayees = await db.payees.toArray()
  const existingFixed = await db.fixedExpenses.toArray()
  const catMap: FromCloudMaps = {
    cloudIdToCategoryId: new Map(existingCats.filter(c => c.cloudId).map(c => [c.cloudId!, c.id!])),
  }
  const payeeMap: FromCloudMaps = {
    cloudIdToPayeeId: new Map(existingPayees.filter(p => p.cloudId).map(p => [p.cloudId!, p.id!])),
  }
  const fixedMap: FromCloudMaps = {
    cloudIdToFixedExpenseId: new Map(existingFixed.filter(f => f.cloudId).map(f => [f.cloudId!, f.id!])),
  }
  const combinedMaps: FromCloudMaps = { ...catMap, ...payeeMap, ...fixedMap }

  // Merge each table by cloudId with timestamp comparison
  if (catRes.data?.length) {
    const rows = catRes.data.map(
      (r: unknown) => fromCloud('categories', r as Record<string, unknown>, combinedMaps),
    )
    await mergeByCloudId('categories', rows)
  }
  if (payRes.data?.length) {
    const rows = payRes.data.map(
      (r: unknown) => fromCloud('payees', r as Record<string, unknown>, combinedMaps),
    )
    await mergeByCloudId('payees', rows)
  }

  // After merging cats/payees, rebuild maps to include newly inserted cloudIds
  if (catRes.data?.length || payRes.data?.length) {
    const updatedCats = await db.categories.toArray()
    const updatedPays = await db.payees.toArray()
    updatedCats.forEach((c) => { if (c.cloudId && c.id) catMap.cloudIdToCategoryId?.set(c.cloudId, c.id) })
    updatedPays.forEach((p) => { if (p.cloudId && p.id) payeeMap.cloudIdToPayeeId?.set(p.cloudId, p.id) })
  }

  if (expRes.data?.length) {
    const rows = expRes.data.map(
      (r: unknown) => fromCloud('expenses', r as Record<string, unknown>, { ...catMap, ...payeeMap, ...fixedMap }),
    )
    await mergeByCloudId('expenses', rows)
  }
  if (fixRes.data?.length) {
    const rows = fixRes.data.map(
      (r: unknown) => fromCloud('fixed_expenses', r as Record<string, unknown>, combinedMaps),
    )
    await mergeByCloudId('fixedExpenses', rows)
  }

  // Rebuild fixed map after merging fixed expenses
  if (fixRes.data?.length) {
    const updatedFixed = await db.fixedExpenses.toArray()
    updatedFixed.forEach((f) => { if (f.cloudId && f.id) fixedMap.cloudIdToFixedExpenseId?.set(f.cloudId, f.id) })
  }
  const finalMaps: FromCloudMaps = { ...catMap, ...payeeMap, ...fixedMap }

  if (snapRes.data?.length) {
    const rows = snapRes.data.map(
      (r: unknown) => fromCloud('fixed_expense_snapshots', r as Record<string, unknown>, finalMaps),
    )
    await mergeByCloudId('fixedExpenseSnapshots', rows)
  }
  if (incomeSnapRes.data?.length) {
    const rows = incomeSnapRes.data.map(
      (r: unknown) => fromCloud('income_snapshots', r as Record<string, unknown>, finalMaps),
    )
    await mergeByCloudId('incomeSnapshots', rows)
  }
  if (savingsSnapRes.data?.length) {
    const rows = savingsSnapRes.data.map(
      (r: unknown) => fromCloud('savings_snapshots', r as Record<string, unknown>, finalMaps),
    )
    await mergeByCloudId('savingsSnapshots', rows)
  }
  if (scheduleRes.data?.length) {
    const rows = scheduleRes.data.map(
      (r: unknown) => fromCloud('schedules', r as Record<string, unknown>, finalMaps),
    )
    await mergeByCloudId('schedules', rows)
  }
  if (categoryMergeRes.data?.length) {
    const rows = categoryMergeRes.data.map(
      (r: unknown) => fromCloud('category_merge_history', r as Record<string, unknown>, finalMaps),
    )
    await mergeByCloudId('categoryMergeHistory', rows)
  }
  if (payeeMergeRes.data?.length) {
    const rows = payeeMergeRes.data.map(
      (r: unknown) => fromCloud('payee_merge_history', r as Record<string, unknown>, finalMaps),
    )
    await mergeByCloudId('payeeMergeHistory', rows)
  }
  if (setRes.data?.length) {
    for (const row of setRes.data) {
      const local = fromCloud('settings', row as Record<string, unknown>)
      await db.settings.put({ key: String(local.key), value: local.value })
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

  // Build FK reference maps (local numeric ID → cloudId)
  const categoryIdToCloudId = new Map(
    categories.filter((c) => c.cloudId).map((c) => [c.id!, c.cloudId!]),
  )
  const payeeIdToCloudId = new Map(
    payees.filter((p) => p.cloudId).map((p) => [p.id!, p.cloudId!]),
  )
  const fixedExpenseIdToCloudId = new Map(
    fixedExpenses.filter((f) => f.cloudId).map((f) => [f.id!, f.cloudId!]),
  )
  const maps: ToCloudMaps = { categoryIdToCloudId, payeeIdToCloudId, fixedExpenseIdToCloudId }

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
      expenses.map((r) => toCloud('expenses', r as unknown as Record<string, unknown>, userId, maps)),
    ),
    upsert(
      'categories',
      categories.map((r) => toCloud('categories', r as unknown as Record<string, unknown>, userId, maps)),
    ),
    upsert(
      'payees',
      payees.map((r) => toCloud('payees', r as unknown as Record<string, unknown>, userId, maps)),
    ),
    upsert(
      'fixed_expenses',
      fixedExpenses.map((r) =>
        toCloud('fixedExpenses', r as unknown as Record<string, unknown>, userId, maps),
      ),
    ),
    upsert(
      'fixed_expense_snapshots',
      fixedExpenseSnapshots.map((r) =>
        toCloud('fixedExpenseSnapshots', r as unknown as Record<string, unknown>, userId, maps),
      ),
    ),
    upsert(
      'income_snapshots',
      incomeSnapshots.map((r) =>
        toCloud('incomeSnapshots', r as unknown as Record<string, unknown>, userId, maps),
      ),
    ),
    upsert(
      'savings_snapshots',
      savingsSnapshots.map((r) =>
        toCloud('savingsSnapshots', r as unknown as Record<string, unknown>, userId, maps),
      ),
    ),
    upsert(
      'schedules',
      schedules.map((r) => toCloud('schedules', r as unknown as Record<string, unknown>, userId, maps)),
    ),
    upsert(
      'category_merge_history',
      categoryMergeHistory.map((r) =>
        toCloud('categoryMergeHistory', r as unknown as Record<string, unknown>, userId, maps),
      ),
    ),
    upsert(
      'payee_merge_history',
      payeeMergeHistory.map((r) =>
        toCloud('payeeMergeHistory', r as unknown as Record<string, unknown>, userId, maps),
      ),
    ),
    upsert(
      'settings',
      settings.map((r) => toCloud('settings', r as unknown as Record<string, unknown>, userId, maps)),
      'user_id,key',
    ),
  ])
}
