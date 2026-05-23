import db from '../db/schema'
import { supabase } from '../supabase'
import {
  CLOUD_FETCH_PAGE_SIZE,
  CLOUD_ID_TABLES,
  STALE_SYNC_RUN_MESSAGE,
  SYNC_BATCH_SIZE,
  UPSERT_CONFLICT_MAP,
} from './constants'
import type { SupabaseResult, SyncRunGuardOptions } from './types'

export function assertNoSupabaseError(result: SupabaseResult, context: string): void {
  if (!result.error) return
  const detail = [result.error.message, result.error.code, result.error.details]
    .filter(Boolean)
    .join(' ')
  throw new Error(`${context} failed${detail ? `: ${detail}` : ''}`)
}

export function assertSyncRunActive(shouldContinue?: () => boolean): void {
  if (shouldContinue && !shouldContinue()) {
    throw new Error(STALE_SYNC_RUN_MESSAGE)
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function parseConflictColumns(onConflict: string): string[] {
  return onConflict
    .split(',')
    .map((column) => column.trim())
    .filter((column) => column.length > 0)
}

function getConflictKey(row: Record<string, unknown>, columns: string[]): string | null {
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

export function dedupeRowsByConflictKey(
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

export function getIsoTimestampMs(value: unknown): number {
  if (typeof value !== 'string' || value.length === 0) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function fetchAllRowsForUser(
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

export async function ensureCloudIdsForSync(): Promise<void> {
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

export async function upsertRowsInBatches(
  table: string,
  rows: Record<string, unknown>[],
  onConflict = UPSERT_CONFLICT_MAP[table] ?? 'id',
  options?: SyncRunGuardOptions,
): Promise<Record<string, unknown>[]> {
  if (!supabase || rows.length === 0) return []

  const dedupedRows = dedupeRowsByConflictKey(rows, onConflict)
  const returnedRows: Record<string, unknown>[] = []

  const batches = chunkArray(dedupedRows, SYNC_BATCH_SIZE)
  for (let index = 0; index < batches.length; index += 1) {
    assertSyncRunActive(options?.shouldContinue)
    const upsertQuery = supabase.from(table).upsert(batches[index], { onConflict }) as
      | Promise<SupabaseResult & { data?: unknown }>
      | { select?: (columns?: string) => Promise<SupabaseResult & { data?: unknown }> }
    const result =
      typeof (upsertQuery as { select?: unknown }).select === 'function'
        ? await (
            upsertQuery as {
              select: (columns?: string) => Promise<SupabaseResult & { data?: unknown }>
            }
          ).select('*')
        : await (upsertQuery as Promise<SupabaseResult & { data?: unknown }>)
    assertNoSupabaseError(result, `Upsert ${table} batch ${index + 1}/${batches.length}`)
    const data = result.data
    if (Array.isArray(data)) {
      returnedRows.push(...(data as Record<string, unknown>[]))
    }
  }

  return returnedRows
}
