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
import {
  CSV_IMPORT_QUEUE_REASON,
  CSV_REPLACE_QUEUE_REASON,
  FULL_SYNC_QUEUE_REASON,
  FULL_SYNC_QUEUE_TABLE,
  isSyncPaused,
} from './syncRuntime'
import { debugLog, debugWarn } from '../utils/debug'

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

const SYNC_BATCH_SIZE = 250
const LOCAL_ONLY_SETTING_KEYS = new Set(['localPrivacyModeEnabled'])
const FULL_SYNC_ORDER = [
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

const FULL_SYNC_DELETE_ORDER = [
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

const UPSERT_CONFLICT_MAP: Partial<Record<string, string>> = {
  settings: 'user_id,key',
  income_snapshots: 'user_id,year,month',
  savings_snapshots: 'user_id,year,month',
  fixed_expense_snapshots: 'user_id,fixed_expense_id,year,month',
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

const CLOUD_ID_TABLES = [
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

interface SupabaseResult {
  error?: { message?: string; code?: string; details?: string } | null
}

interface CompactedSyncQueueItem {
  itemIds: number[]
  latestTimestamp: number
  table: string
  operation: SyncQueueItem['operation']
  payload: Record<string, unknown>
}

interface SyncRunGuardOptions {
  shouldContinue?: () => boolean
}

const CLOUD_FETCH_PAGE_SIZE = 1000
const STALE_SYNC_RUN_MESSAGE = 'Sync run superseded'

function assertNoSupabaseError(result: SupabaseResult, context: string): void {
  if (!result.error) return
  const detail = [result.error.message, result.error.code, result.error.details]
    .filter(Boolean)
    .join(' ')
  throw new Error(`${context} failed${detail ? `: ${detail}` : ''}`)
}

function assertSyncRunActive(shouldContinue?: () => boolean): void {
  if (shouldContinue && !shouldContinue()) {
    throw new Error(STALE_SYNC_RUN_MESSAGE)
  }
}

async function fetchAllRowsForUser(
  table: string,
  userId: string,
): Promise<Record<string, unknown>[]> {
  if (!supabase) return []

  const rows: Record<string, unknown>[] = []
  let from = 0

  while (true) {
    const to = from + CLOUD_FETCH_PAGE_SIZE - 1
    const result = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, to)
    assertNoSupabaseError(result, `Fetch ${table} rows ${from}-${to}`)

    const page = (result.data ?? []) as Record<string, unknown>[]
    if (page.length === 0) break
    rows.push(...page)

    if (page.length < CLOUD_FETCH_PAGE_SIZE) break
    from += CLOUD_FETCH_PAGE_SIZE
  }

  return rows
}

function chunkArray<T>(items: T[], size: number): T[][]
{
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function ensureCloudIdsForSync(): Promise<void> {
  const now = new Date().toISOString()

  for (const tableName of CLOUD_ID_TABLES) {
    const table = db.table<Record<string, unknown>, number>(tableName)
    const rows = await table.toArray()

    for (const row of rows) {
      const updates: Record<string, unknown> = {}
      if (!row.cloudId) updates.cloudId = crypto.randomUUID()
      if (!row.updatedAt) updates.updatedAt = (row.createdAt as string | undefined) ?? now

      if (Object.keys(updates).length > 0) {
        await table.update(row.id as number, updates)
      }
    }
  }
}

async function upsertRowsInBatches(
  table: string,
  rows: Record<string, unknown>[],
  onConflict = UPSERT_CONFLICT_MAP[table] ?? 'id',
  options?: SyncRunGuardOptions,
): Promise<void> {
  if (!supabase || rows.length === 0) return

  const dedupedRows = dedupeRowsByConflictKey(rows, onConflict)

  const batches = chunkArray(dedupedRows, SYNC_BATCH_SIZE)
  for (let index = 0; index < batches.length; index += 1) {
    assertSyncRunActive(options?.shouldContinue)
    const result = await supabase.from(table).upsert(batches[index], { onConflict })
    assertNoSupabaseError(
      result,
      `Upsert ${table} batch ${index + 1}/${batches.length}`,
    )
  }
}

function parseConflictColumns(onConflict: string): string[] {
  return onConflict
    .split(',')
    .map((column) => column.trim())
    .filter((column) => column.length > 0)
}

function getConflictKey(
  row: Record<string, unknown>,
  columns: string[],
): string | null {
  const values: string[] = []
  for (const column of columns) {
    const value = row[column]
    if (value == null) return null
    values.push(String(value))
  }
  return values.join('||')
}

function getUpdatedAtMs(row: Record<string, unknown>): number {
  const value = row.updated_at
  if (typeof value !== 'string' || value.length === 0) return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function dedupeRowsByConflictKey(
  rows: Record<string, unknown>[],
  onConflict: string,
): Record<string, unknown>[] {
  const columns = parseConflictColumns(onConflict)
  if (columns.length === 0) return rows

  const deduped = new Map<string, Record<string, unknown>>()
  const passthrough: Record<string, unknown>[] = []

  for (const row of rows) {
    const key = getConflictKey(row, columns)
    if (!key) {
      passthrough.push(row)
      continue
    }

    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, row)
      continue
    }

    if (getUpdatedAtMs(row) >= getUpdatedAtMs(existing)) {
      deduped.set(key, row)
    }
  }

  return [...deduped.values(), ...passthrough]
}

function getIsoTimestampMs(value: unknown): number {
  if (typeof value !== 'string' || value.length === 0) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getSyncQueueIdentityKey(item: SyncQueueItem): string | null {
  if (item.table === FULL_SYNC_QUEUE_TABLE) return null

  const payload = item.payload as Record<string, unknown>
  const cloudId = payload.cloudId
  if (cloudId != null && String(cloudId).length > 0) {
    return `${item.table}:cloud:${String(cloudId)}`
  }

  if (item.table === 'settings') {
    const key = payload.key
    if (key != null && String(key).length > 0) {
      return `${item.table}:key:${String(key)}`
    }
  }

  const localId = payload.id
  if (localId != null && String(localId).length > 0) {
    return `${item.table}:id:${String(localId)}`
  }

  return null
}

function compactSyncQueueItems(queue: SyncQueueItem[]): CompactedSyncQueueItem[] {
  const compactedByIdentity = new Map<string, CompactedSyncQueueItem>()
  const passthrough: CompactedSyncQueueItem[] = []

  for (const item of queue) {
    const identityKey = getSyncQueueIdentityKey(item)
    const compactedItem: CompactedSyncQueueItem = {
      itemIds: [item.id as number],
      latestTimestamp: item.timestamp,
      table: item.table,
      operation: item.operation,
      payload: item.payload as Record<string, unknown>,
    }

    if (!identityKey) {
      passthrough.push(compactedItem)
      continue
    }

    const existing = compactedByIdentity.get(identityKey)
    if (!existing) {
      compactedByIdentity.set(identityKey, compactedItem)
      continue
    }

    const shouldReplace =
      item.timestamp > existing.latestTimestamp ||
      (item.timestamp === existing.latestTimestamp &&
        ((item.id as number) > Math.max(...existing.itemIds) || existing.operation !== 'delete'))

    const mergedIds = [...existing.itemIds, item.id as number]
    if (shouldReplace) {
      compactedByIdentity.set(identityKey, {
        itemIds: mergedIds,
        latestTimestamp: item.timestamp,
        table: item.table,
        operation: item.operation,
        payload: item.payload as Record<string, unknown>,
      })
    } else {
      existing.itemIds = mergedIds
    }
  }

  return [...compactedByIdentity.values(), ...passthrough].sort((a, b) => {
    if (a.latestTimestamp !== b.latestTimestamp) return a.latestTimestamp - b.latestTimestamp
    return Math.min(...a.itemIds) - Math.min(...b.itemIds)
  })
}

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

async function runFullSyncUpload(
  userId: string,
  replaceCloud = false,
  replaceTables?: readonly string[],
): Promise<void> {
  if (replaceCloud) {
    await replaceSupabaseData(userId, replaceTables)
  }
  await migrateLocalToSupabase(userId)
}

// Convert a local row to a Supabase-shaped row (snake_case + user_id)
interface ToCloudMaps {
  categoryIdToCloudId?: Map<number, string>
  payeeIdToCloudId?: Map<number, string>
  fixedExpenseIdToCloudId?: Map<number, string>
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
  function categoryCloudId(p: Category) {
    if (p.cloudId) return p.cloudId
    if (p.id != null) return maps?.categoryIdToCloudId?.get(p.id) ?? String(p.id)
    return crypto.randomUUID()
  }
  function payeeCloudId(p: Payee) {
    if (p.cloudId) return p.cloudId
    if (p.id != null) return maps?.payeeIdToCloudId?.get(p.id) ?? String(p.id)
    return crypto.randomUUID()
  }
  function fixedExpenseCloudId(p: FixedExpense) {
    if (p.cloudId) return p.cloudId
    if (p.id != null) return maps?.fixedExpenseIdToCloudId?.get(p.id) ?? String(p.id)
    return crypto.randomUUID()
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
      id: categoryCloudId(p),
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
      id: payeeCloudId(p),
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
      id: fixedExpenseCloudId(p),
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
      fixed_expense_id:
        maps?.fixedExpenseIdToCloudId?.get(p.fixedExpenseId) ?? String(p.fixedExpenseId),
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

async function resolveLocalCategoryId(
  cloudCategoryId: unknown,
  maps: FromCloudMaps,
): Promise<number | undefined> {
  if (cloudCategoryId != null) {
    const str = String(cloudCategoryId)
    const byCloud = maps.cloudIdToCategoryId?.get(str)
    if (byCloud !== undefined) return byCloud
    const numId = toNumberOrUndefined(cloudCategoryId)
    if (numId !== undefined) return numId
  }

  return undefined
}

async function resolveLocalPayeeId(
  cloudPayeeId: unknown,
  maps: FromCloudMaps,
): Promise<number | undefined> {
  if (cloudPayeeId != null) {
    const str = String(cloudPayeeId)
    const byCloud = maps.cloudIdToPayeeId?.get(str)
    if (byCloud !== undefined) return byCloud
    const numId = toNumberOrUndefined(cloudPayeeId)
    if (numId !== undefined) return numId
  }

  return undefined
}

function fromCloud(
  table: string,
  row: Record<string, unknown>,
  maps?: FromCloudMaps,
): Record<string, unknown> {
  const cid = String(row.id)

  function resolveCat(cloudId: unknown) {
    if (cloudId == null) return undefined
    const str = String(cloudId)
    const byCloud = maps?.cloudIdToCategoryId?.get(str)
    if (byCloud !== undefined) return byCloud
    // Only fall back to numeric ID for legacy data (small integers, not UUIDs)
    if (/^\d+$/.test(str) && Number(str) < 100000) {
      const numId = toNumberOrUndefined(cloudId)
      if (numId !== undefined) return numId
    }
    return undefined
  }
  function resolvePay(cloudId: unknown) {
    if (cloudId == null) return undefined
    const str = String(cloudId)
    const byCloud = maps?.cloudIdToPayeeId?.get(str)
    if (byCloud !== undefined) return byCloud
    // Only fall back to numeric ID for legacy data (small integers, not UUIDs)
    if (/^\d+$/.test(str) && Number(str) < 100000) {
      const numId = toNumberOrUndefined(cloudId)
      if (numId !== undefined) return numId
    }
    return undefined
  }
  function resolveFixed(cloudId: unknown) {
    if (cloudId == null) return undefined
    const str = String(cloudId)
    const byCloud = maps?.cloudIdToFixedExpenseId?.get(str)
    if (byCloud !== undefined) return byCloud
    // Only fall back to numeric ID for legacy data (small integers, not UUIDs)
    if (/^\d+$/.test(str) && Number(str) < 100000) {
      const numId = toNumberOrUndefined(cloudId)
      if (numId !== undefined) return numId
    }
    return undefined
  }

  if (table === 'expenses') {
    return {
      cloudId: cid,
      date: row.date,
      cloudCategoryId: row.category_id != null ? String(row.category_id) : undefined,
      categoryId: resolveCat(row.category_id),
      cloudPayeeId: row.payee_id != null ? String(row.payee_id) : undefined,
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
      fixedExpenseId:
        resolveFixed(row.fixed_expense_id) ?? toNumberOrUndefined(row.fixed_expense_id),
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
    return {
      key: row.key,
      value: JSON.parse(String(row.value)),
      updatedAt: row.updated_at as string | undefined,
    }
  }
  return row
}

// ── Outgoing sync ─────────────────────────────────────────────────────────────
export async function flushSyncQueue(
  userId: string,
  options?: SyncRunGuardOptions,
): Promise<void> {
  if (!supabase || !userId || isSyncPaused()) return

  await ensureCloudIdsForSync()
  assertSyncRunActive(options?.shouldContinue)

  const queue = (await StorageService.getSyncQueue()) as SyncQueueItem[]
  if (queue.length === 0) return

  const fullSyncItems = queue.filter(
    (item) =>
      item.table === FULL_SYNC_QUEUE_TABLE &&
      (item.payload.reason === FULL_SYNC_QUEUE_REASON ||
        item.payload.reason === CSV_IMPORT_QUEUE_REASON ||
        item.payload.reason === CSV_REPLACE_QUEUE_REASON),
  )
  if (fullSyncItems.length > 0) {
    const shouldReplaceCloud = fullSyncItems.some((item) => item.payload.replace === true)
    const replaceTables =
      fullSyncItems.find((item) => Array.isArray(item.payload.replaceTables))?.payload
        .replaceTables as string[] | undefined
    await runFullSyncUpload(userId, shouldReplaceCloud || Boolean(replaceTables), replaceTables)
    assertSyncRunActive(options?.shouldContinue)
    for (const item of fullSyncItems) {
      await StorageService.removeSyncQueueItem(item.id as number)
    }
  }

  const remainingQueue = (await StorageService.getSyncQueue()) as SyncQueueItem[]
  if (remainingQueue.length === 0) return
  assertSyncRunActive(options?.shouldContinue)
  const compactedQueue = compactSyncQueueItems(remainingQueue)

  // Build FK maps so cloud records use UUIDs for foreign keys, not numeric strings
  const [categories, payees, fixedExpenses] = await Promise.all([
    StorageService.getCategories() as Promise<Category[]>,
    StorageService.getPayees() as Promise<Payee[]>,
    StorageService.getFixedExpenses() as Promise<FixedExpense[]>,
  ])
  const maps: ToCloudMaps = {
    categoryIdToCloudId: new Map(
      categories.filter((c) => c.cloudId).map((c) => [c.id!, c.cloudId!]),
    ),
    payeeIdToCloudId: new Map(payees.filter((p) => p.cloudId).map((p) => [p.id!, p.cloudId!])),
    fixedExpenseIdToCloudId: new Map(
      fixedExpenses.filter((f) => f.cloudId).map((f) => [f.id!, f.cloudId!]),
    ),
  }

  const deleteItemsByCloudTable = new Map<
    string,
    Array<{ itemIds: number[]; cloudId: string }>
  >()
  const upsertItemsByCloudTable = new Map<
    string,
    Array<{ itemIds: number[]; row: Record<string, unknown> }>
  >()

  for (const item of compactedQueue) {
    assertSyncRunActive(options?.shouldContinue)
    if (item.table === 'settings' && LOCAL_ONLY_SETTING_KEYS.has(String(item.payload.key))) {
      for (const itemId of item.itemIds) {
        await StorageService.removeSyncQueueItem(itemId)
      }
      continue
    }
    const cloudTable = TABLE_MAP[item.table]
    if (!cloudTable) {
      for (const itemId of item.itemIds) {
        await StorageService.removeSyncQueueItem(itemId)
      }
      continue
    }

    try {
      const row = toCloud(item.table, item.payload, userId, maps)
      if (item.operation === 'delete') {
        const payload = item.payload as Record<string, unknown>
        const cloudId = (payload.cloudId as string) || String(payload.id)
        const existingDeleteItems = deleteItemsByCloudTable.get(cloudTable) ?? []
        existingDeleteItems.push({ itemIds: item.itemIds, cloudId })
        deleteItemsByCloudTable.set(cloudTable, existingDeleteItems)
      } else {
        const existingUpsertItems = upsertItemsByCloudTable.get(cloudTable) ?? []
        existingUpsertItems.push({ itemIds: item.itemIds, row })
        upsertItemsByCloudTable.set(cloudTable, existingUpsertItems)
      }
    } catch (err) {
      console.warn('Sync flush error:', err)
      throw err
    }
  }

  for (const [cloudTable, items] of upsertItemsByCloudTable) {
    const rows = items.map((item) => item.row)
    try {
      await upsertRowsInBatches(cloudTable, rows, undefined, options)
      assertSyncRunActive(options?.shouldContinue)
      for (const item of items) {
        for (const itemId of item.itemIds) {
          await StorageService.removeSyncQueueItem(itemId)
        }
      }
    } catch (err) {
      console.warn('Sync flush error:', err)
      throw err
    }
  }

  for (const [cloudTable, items] of deleteItemsByCloudTable) {
    for (const item of items) {
      try {
        assertSyncRunActive(options?.shouldContinue)
        const result = await supabase.from(cloudTable).delete().eq('id', item.cloudId).eq('user_id', userId)
        assertNoSupabaseError(result, `Delete ${cloudTable}`)
        assertSyncRunActive(options?.shouldContinue)
        for (const itemId of item.itemIds) {
          await StorageService.removeSyncQueueItem(itemId)
        }
      } catch (err) {
        console.warn('Sync flush error:', err)
        throw err
      }
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
      // Name-based dedup for categories and payees: prevent duplicates by name
      const rowName = (row.name as string)?.trim().toLowerCase()
      if (rowName && (tableName === 'categories' || tableName === 'payees')) {
        const existingByName = existing.find(
          (r) => r.name && String(r.name).trim().toLowerCase() === rowName,
        )
        if (existingByName) {
          // Update local record with cloud data (including cloudId for future matches)
          await table.update(existingByName.id as number, row)
          continue
        }
      }
      await table.add(row)
    }
  }
}

// ── Incoming sync ─────────────────────────────────────────────────────────────
export async function pullFromSupabase(userId: string): Promise<void> {
  if (!supabase || !userId) return

  const [
    expRows,
    catRows,
    payRows,
    fixRows,
    snapRows,
    incomeSnapRows,
    savingsSnapRows,
    scheduleRows,
    categoryMergeRows,
    payeeMergeRows,
    setRows,
  ] = await Promise.all([
    fetchAllRowsForUser('expenses', userId),
    fetchAllRowsForUser('categories', userId),
    fetchAllRowsForUser('payees', userId),
    fetchAllRowsForUser('fixed_expenses', userId),
    fetchAllRowsForUser('fixed_expense_snapshots', userId),
    fetchAllRowsForUser('income_snapshots', userId),
    fetchAllRowsForUser('savings_snapshots', userId),
    fetchAllRowsForUser('schedules', userId),
    fetchAllRowsForUser('category_merge_history', userId),
    fetchAllRowsForUser('payee_merge_history', userId),
    fetchAllRowsForUser('settings', userId),
  ])

  // Build FK resolution maps from categories and payees (cloudId → local numeric ID)
  const existingCats = await db.categories.toArray()
  const existingPayees = await db.payees.toArray()
  const existingFixed = await db.fixedExpenses.toArray()
  const catMap: FromCloudMaps = {
    cloudIdToCategoryId: new Map(
      existingCats.filter((c) => c.cloudId).map((c) => [c.cloudId!, c.id!]),
    ),
  }
  const payeeMap: FromCloudMaps = {
    cloudIdToPayeeId: new Map(
      existingPayees.filter((p) => p.cloudId).map((p) => [p.cloudId!, p.id!]),
    ),
  }
  const fixedMap: FromCloudMaps = {
    cloudIdToFixedExpenseId: new Map(
      existingFixed.filter((f) => f.cloudId).map((f) => [f.cloudId!, f.id!]),
    ),
  }
  const combinedMaps: FromCloudMaps = { ...catMap, ...payeeMap, ...fixedMap }

  // Merge each table by cloudId with timestamp comparison
  if (catRows.length) {
    const rows = catRows.map((r: unknown) =>
      fromCloud('categories', r as Record<string, unknown>, combinedMaps),
    )
    await mergeByCloudId('categories', rows)
  }
  if (payRows.length) {
    const rows = payRows.map((r: unknown) =>
      fromCloud('payees', r as Record<string, unknown>, combinedMaps),
    )
    await mergeByCloudId('payees', rows)
  }

  // After merging cats/payees, rebuild maps to include newly inserted cloudIds
  if (catRows.length || payRows.length) {
    const updatedCats = await db.categories.toArray()
    const updatedPays = await db.payees.toArray()
    updatedCats.forEach((c) => {
      if (c.cloudId && c.id) catMap.cloudIdToCategoryId?.set(c.cloudId, c.id)
    })
    updatedPays.forEach((p) => {
      if (p.cloudId && p.id) payeeMap.cloudIdToPayeeId?.set(p.cloudId, p.id)
    })

  }

  const expenseResolutionMaps: FromCloudMaps = {
    cloudIdToCategoryId: catMap.cloudIdToCategoryId,
    cloudIdToPayeeId: payeeMap.cloudIdToPayeeId,
  }
  debugLog(
    '[sync] resolution maps — cloudId->cat:',
    catMap.cloudIdToCategoryId?.size ?? 0,
    'cloudId->pay:',
    payeeMap.cloudIdToPayeeId?.size ?? 0,
  )

  if (expRows.length) {
    debugLog('[sync] resolving', expRows.length, 'cloud expenses')
    const unresolvedCats = new Set<string>()
    const unresolvedPayees = new Set<string>()
    let resolvedViaInitialMap = 0
    let resolvedViaFallback = 0
    const resolvedRows = await Promise.all(
      expRows.map(async (r: unknown) => {
        const raw = r as Record<string, unknown>
        const local = fromCloud('expenses', raw, { ...catMap, ...payeeMap })

        // Re-resolve categoryId with async fallback + auto-create
        let categoryId = local.categoryId as number | undefined
        if (categoryId !== undefined) {
          resolvedViaInitialMap++
        } else {
          const resolved = await resolveLocalCategoryId(
            local.cloudCategoryId,
            expenseResolutionMaps,
          )
          if (resolved !== undefined) {
            categoryId = resolved
            resolvedViaFallback++
          } else {
            unresolvedCats.add(String(local.cloudCategoryId ?? 'unknown'))
          }
        }
        // Re-resolve payeeId with async fallback + auto-create
        let payeeId = local.payeeId as number | undefined
        if (payeeId !== undefined) {
          // already resolved
        } else if (local.cloudPayeeId != null) {
          const resolved = await resolveLocalPayeeId(
            local.cloudPayeeId,
            expenseResolutionMaps,
          )
          if (resolved !== undefined) {
            payeeId = resolved
          } else {
            unresolvedPayees.add(String(local.cloudPayeeId ?? 'unknown'))
          }
        }
        return { ...local, categoryId, payeeId }
      }),
    )
    debugLog(
      '[sync] expense resolution: initial map match:',
      resolvedViaInitialMap,
      'fallback/auto-create:',
      resolvedViaFallback,
      'unresolved cats:',
      [...unresolvedCats],
      'unresolved payees:',
      [...unresolvedPayees],
    )
    await mergeByCloudId('expenses', resolvedRows)
  }
  if (fixRows.length) {
    const rows = fixRows.map((r: unknown) =>
      fromCloud('fixed_expenses', r as Record<string, unknown>, combinedMaps),
    )
    await mergeByCloudId('fixedExpenses', rows)
  }

  // Rebuild fixed map after merging fixed expenses
  if (fixRows.length) {
    const updatedFixed = await db.fixedExpenses.toArray()
    updatedFixed.forEach((f) => {
      if (f.cloudId && f.id) fixedMap.cloudIdToFixedExpenseId?.set(f.cloudId, f.id)
    })
  }
  const finalMaps: FromCloudMaps = { ...catMap, ...payeeMap, ...fixedMap }

  if (snapRows.length) {
    const rows = snapRows.map((r: unknown) =>
      fromCloud('fixed_expense_snapshots', r as Record<string, unknown>, finalMaps),
    )
    await mergeByCloudId('fixedExpenseSnapshots', rows)
  }
  if (incomeSnapRows.length) {
    const rows = incomeSnapRows.map((r: unknown) =>
      fromCloud('income_snapshots', r as Record<string, unknown>, finalMaps),
    )
    await mergeByCloudId('incomeSnapshots', rows)
  }
  if (savingsSnapRows.length) {
    const rows = savingsSnapRows.map((r: unknown) =>
      fromCloud('savings_snapshots', r as Record<string, unknown>, finalMaps),
    )
    await mergeByCloudId('savingsSnapshots', rows)
  }
  if (scheduleRows.length) {
    const rows = scheduleRows.map((r: unknown) =>
      fromCloud('schedules', r as Record<string, unknown>, finalMaps),
    )
    await mergeByCloudId('schedules', rows)
  }
  if (categoryMergeRows.length) {
    const rows = categoryMergeRows.map((r: unknown) =>
      fromCloud('category_merge_history', r as Record<string, unknown>, finalMaps),
    )
    await mergeByCloudId('categoryMergeHistory', rows)
  }
  if (payeeMergeRows.length) {
    const rows = payeeMergeRows.map((r: unknown) =>
      fromCloud('payee_merge_history', r as Record<string, unknown>, finalMaps),
    )
    await mergeByCloudId('payeeMergeHistory', rows)
  }
  if (setRows.length) {
    const pendingSettingsKeys = new Set<string>()
    const pendingQueue =
      'syncQueue' in db && db.syncQueue
        ? await db.syncQueue.where('table').equals('settings').toArray()
        : []
    for (const item of pendingQueue) {
      if (item.operation === 'delete') continue
      const key = String((item.payload as Record<string, unknown>)?.key ?? '')
      if (key) pendingSettingsKeys.add(key)
    }

    for (const row of setRows) {
      const local = fromCloud('settings', row as Record<string, unknown>)
      const key = String(local.key)
      // If local has a pending outgoing update for this key, keep local as source of truth
      // to avoid pull-before-flush reverting in-memory and persisted settings.
      if (pendingSettingsKeys.has(key)) continue
      const existing = await db.settings.get(key)
      const localTime = getIsoTimestampMs(existing?.updatedAt)
      const cloudTime = getIsoTimestampMs(local.updatedAt)
      if (existing && localTime > cloudTime) continue
      await db.settings.put({
        key,
        value: local.value,
        updatedAt:
          typeof local.updatedAt === 'string' && local.updatedAt.length > 0
            ? local.updatedAt
            : new Date().toISOString(),
      })
    }
  }

  // Deduplicate categories and payees that have the same name
  await deduplicateByName(db.table('categories'), 'categoryId')
  await deduplicateByName(db.table('payees'), 'payeeId')

  // ─── Post-sync integrity check ──────────────────────────────────────────
  await verifySyncIntegrity()
}

async function verifySyncIntegrity(): Promise<void> {
  const [cats, pays, exps] = await Promise.all([
    db.categories.toArray(),
    db.payees.toArray(),
    db.expenses.toArray(),
  ])
  const validCatIds = new Set(cats.filter((c) => c.id != null).map((c) => c.id!))
  const validPayeeIds = new Set(pays.filter((p) => p.id != null).map((p) => p.id!))

  let brokenCats = 0
  let brokenPayees = 0
  for (const e of exps) {
    if (e.categoryId != null && !validCatIds.has(e.categoryId)) {
      brokenCats++
      if (brokenCats <= 3) {
        console.warn(
          '[integrity] expense',
          e.id,
          'references missing categoryId:',
          e.categoryId,
          'cloudId:',
          e.cloudId,
        )
      }
    }
    if (e.payeeId != null && !validPayeeIds.has(e.payeeId)) {
      brokenPayees++
      if (brokenPayees <= 3) {
        console.warn(
          '[integrity] expense',
          e.id,
          'references missing payeeId:',
          e.payeeId,
          'cloudId:',
          e.cloudId,
        )
      }
    }
  }
  if (brokenCats > 0) {
    debugWarn('[integrity] total expenses with broken category link:', brokenCats)
  }
  if (brokenPayees > 0) {
    debugWarn('[integrity] total expenses with broken payee link:', brokenPayees)
  }
  debugLog(
    '[integrity] checked',
    exps.length,
    'expenses,',
    cats.length,
    'categories —',
    brokenCats,
    'broken,',
    brokenPayees,
    'broken payees',
  )
}

// ── Dedup helper: merge duplicate records by name, keep newest ─────────────────
async function deduplicateByName(
  table: {
    toArray: () => Promise<Array<Record<string, unknown>>>
    delete: (id: number) => Promise<void>
    update: (id: number, changes: Record<string, unknown>) => Promise<number>
  },
  fkField: 'categoryId' | 'payeeId',
): Promise<void> {
  const rows = await table.toArray()
  const groups = new Map<string, Array<Record<string, unknown>>>()

  for (const row of rows) {
    const key = (row.name as string)?.trim().toLowerCase()
    if (!key) continue
    const group = groups.get(key) || []
    group.push(row)
    groups.set(key, group)
  }

  for (const [, group] of groups) {
    if (group.length <= 1) continue
    // Keep the newest record
    group.sort((a, b) => {
      const aTime = new Date((a.updatedAt as string) || 0).getTime()
      const bTime = new Date((b.updatedAt as string) || 0).getTime()
      return bTime - aTime
    })
    const [keep, ...dupes] = group
    for (const dup of dupes) {
      const oldId = dup.id as number
      const newId = keep.id as number

      // Reassign expenses referencing the duplicate to the kept record
      if (fkField === 'categoryId') {
        await db.expenses.where('categoryId').equals(oldId).modify({ categoryId: newId })
      } else {
        await db.expenses.where('payeeId').equals(oldId).modify({ payeeId: newId })
      }

      // Fix any sync queue items that reference the deleted ID
      const queueItems = await db.syncQueue.toArray()
      const toUpdate = queueItems.filter(
        (item) => item.table === 'expenses' && (item.payload[fkField] as number) === oldId,
      )
      for (const item of toUpdate) {
        await db.syncQueue.update(item.id as number, {
          payload: { ...item.payload, [fkField]: newId },
        })
      }

      // Also fix schedule expense materialization references
      if (fkField === 'categoryId') {
        const schedules = await db.schedules.where('categoryId').equals(oldId).toArray()
        for (const s of schedules) {
          await db.schedules.update(s.id as number, { categoryId: newId })
        }
      }

      await table.delete(oldId)
    }
  }
}

// ── Initial migration: push all local data to Supabase once ──────────────────
export async function migrateLocalToSupabase(
  userId: string,
  options: { ignorePause?: boolean } = {},
): Promise<void> {
  if (!supabase || !userId || (!options.ignorePause && isSyncPaused())) return

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

  // Build FK reference maps (local numeric ID → cloudId)
  const categoryIdToCloudId = new Map(
    categories.filter((c) => c.cloudId).map((c) => [c.id!, c.cloudId!]),
  )
  const payeeIdToCloudId = new Map(payees.filter((p) => p.cloudId).map((p) => [p.id!, p.cloudId!]))
  const fixedExpenseIdToCloudId = new Map(
    fixedExpenses.filter((f) => f.cloudId).map((f) => [f.id!, f.cloudId!]),
  )
  const maps: ToCloudMaps = {
    categoryIdToCloudId,
    payeeIdToCloudId,
    fixedExpenseIdToCloudId,
  }

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
