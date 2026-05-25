import db from '../db/schema'
import { supabase } from '../supabase'
import { normalizeNameForSync } from '../../utils/syncMetadata'
import { markRecordPending } from '../../utils/syncMetadata'
import { debugLog } from '../../utils/debug'
import { fromCloud, fromCloudLocalMap } from './conversion'
import { SYNC_BATCH_SIZE } from './constants'
import { verifySyncIntegrity } from './integrity'
import { fetchAllRowsForUser, getIsoTimestampMs } from './supabaseUtils'
import type { FromCloudMaps } from './types'
import type { Expense, ExpenseSplit, SyncedSettingRow } from '../../types'

type SyncRow = Record<string, unknown> & {
  id?: number
  localId?: string
  cloudId?: string | null
  updatedAt?: string
  deletedAt?: string | null
  normalizedName?: string
  name?: string
}

type IdentityMergeOptions = {
  normalizedNameFallback?: boolean
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function buildIdentityMetadataPatch(localRow: SyncRow, incomingRow: SyncRow): Partial<SyncRow> {
  const patch: Partial<SyncRow> = {}

  if (
    (!localRow.cloudId || localRow.cloudId.length === 0) &&
    typeof incomingRow.cloudId === 'string' &&
    incomingRow.cloudId.length > 0
  ) {
    patch.cloudId = incomingRow.cloudId
  }

  if (
    (typeof localRow.localId !== 'string' || localRow.localId.length === 0) &&
    typeof incomingRow.localId === 'string' &&
    incomingRow.localId.length > 0
  ) {
    patch.localId = incomingRow.localId
  }

  return patch
}

function getRowUpdatedAtMs(row: Pick<SyncRow, 'updatedAt'>): number {
  return getIsoTimestampMs(row.updatedAt)
}

function getNormalizedName(row: SyncRow): string | null {
  if (typeof row.normalizedName === 'string' && row.normalizedName.length > 0) {
    return row.normalizedName
  }
  if (typeof row.name === 'string' && row.name.trim().length > 0) {
    return normalizeNameForSync(row.name)
  }
  return null
}

function buildNameIndex(rows: SyncRow[]): Map<string, SyncRow[]> {
  const byName = new Map<string, SyncRow[]>()
  for (const row of rows) {
    const normalizedName = getNormalizedName(row)
    if (!normalizedName) continue
    const group = byName.get(normalizedName) ?? []
    group.push(row)
    byName.set(normalizedName, group)
  }
  return byName
}

function findNormalizedMatch(rows: SyncRow[], normalizedName: string): SyncRow | undefined {
  const matches = rows.filter((row) => getNormalizedName(row) === normalizedName)
  if (matches.length === 0) return undefined
  return matches.find((row) => row.deletedAt == null) ?? matches[0]
}

function reindexRow(
  row: SyncRow,
  byLocalId: Map<string, SyncRow>,
  byCloudId: Map<string, SyncRow>,
  byNormalizedName?: Map<string, SyncRow[]>,
): void {
  const normalizedName = getNormalizedName(row)
  if (typeof row.localId === 'string' && row.localId.length > 0) {
    byLocalId.set(row.localId, row)
  }
  if (typeof row.cloudId === 'string' && row.cloudId.length > 0) {
    byCloudId.set(row.cloudId, row)
  }
  if (!byNormalizedName || !normalizedName) return

  const nextGroup = (byNormalizedName.get(normalizedName) ?? []).filter(
    (existing) => existing !== row,
  )
  nextGroup.push(row)
  byNormalizedName.set(normalizedName, nextGroup)
}

async function mergeRows(
  tableName: string,
  cloudRows: Record<string, unknown>[],
  options: IdentityMergeOptions = {},
): Promise<void> {
  if (cloudRows.length === 0) return

  const table = db.table<unknown, number>(tableName)
  const existing = (await table.toArray()) as SyncRow[]
  const byLocalId = new Map(
    existing
      .filter((row): row is SyncRow & { localId: string } => typeof row.localId === 'string')
      .map((row) => [row.localId, row]),
  )
  const byCloudId = new Map(
    existing
      .filter(
        (row): row is SyncRow & { cloudId: string } =>
          typeof row.cloudId === 'string' && row.cloudId.length > 0,
      )
      .map((row) => [row.cloudId, row]),
  )
  const byNormalizedName = options.normalizedNameFallback ? buildNameIndex(existing) : undefined
  const pendingUpdates = new Map<number, SyncRow>()
  const pendingInserts: SyncRow[] = []
  let tempId = -1

  for (const incoming of cloudRows as SyncRow[]) {
    const normalizedName = getNormalizedName(incoming)
    const localMatch =
      (typeof incoming.localId === 'string' ? byLocalId.get(incoming.localId) : undefined) ??
      (typeof incoming.cloudId === 'string' ? byCloudId.get(incoming.cloudId) : undefined) ??
      (options.normalizedNameFallback && normalizedName && byNormalizedName
        ? findNormalizedMatch(byNormalizedName.get(normalizedName) ?? [], normalizedName)
        : undefined)

    if (localMatch) {
      if (getRowUpdatedAtMs(incoming) > getRowUpdatedAtMs(localMatch)) {
        const resolvedId =
          typeof localMatch.id === 'number' && localMatch.id > 0 ? localMatch.id : localMatch.id
        const nextRow = { ...localMatch, ...incoming, id: resolvedId }
        Object.assign(localMatch, nextRow)
        reindexRow(localMatch, byLocalId, byCloudId, byNormalizedName)
        if (typeof localMatch.id === 'number' && localMatch.id > 0) {
          pendingUpdates.set(localMatch.id, { ...localMatch })
        }
      } else {
        const identityPatch = buildIdentityMetadataPatch(localMatch, incoming)
        if (Object.keys(identityPatch).length > 0) {
          Object.assign(localMatch, identityPatch)
          reindexRow(localMatch, byLocalId, byCloudId, byNormalizedName)
          if (typeof localMatch.id === 'number' && localMatch.id > 0) {
            pendingUpdates.set(localMatch.id, { ...localMatch })
          }
        }
      }
      continue
    }

    const pendingRow = { ...incoming, id: tempId }
    tempId -= 1
    pendingInserts.push(pendingRow)
    reindexRow(pendingRow, byLocalId, byCloudId, byNormalizedName)
  }

  if (pendingUpdates.size > 0) {
    for (const batch of chunkArray(Array.from(pendingUpdates.values()), SYNC_BATCH_SIZE)) {
      await table.bulkPut(batch)
    }
  }

  if (pendingInserts.length > 0) {
    const rowsToInsert = pendingInserts.map(({ id: _id, ...row }) => row)
    for (const batch of chunkArray(rowsToInsert, SYNC_BATCH_SIZE)) {
      await table.bulkAdd(batch)
    }
  }
}

function buildRelationshipMaps(
  expenses: SyncRow[],
  categories: SyncRow[],
  payees: SyncRow[],
  tags: SyncRow[],
  fixedExpenses: SyncRow[],
  expenseSplits: SyncRow[],
): FromCloudMaps {
  return {
    cloudIdToExpenseId: fromCloudLocalMap(expenses),
    cloudIdToCategoryId: fromCloudLocalMap(categories),
    cloudIdToPayeeId: fromCloudLocalMap(payees),
    cloudIdToTagId: fromCloudLocalMap(tags),
    cloudIdToFixedExpenseId: fromCloudLocalMap(fixedExpenses),
    cloudIdToExpenseSplitId: fromCloudLocalMap(expenseSplits),
  }
}

function buildActiveNameToIdMap(rows: SyncRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    if (row.deletedAt != null || row.id == null) continue
    const normalizedName = getNormalizedName(row)
    if (!normalizedName || map.has(normalizedName)) continue
    map.set(normalizedName, row.id)
  }
  return map
}

function resolveExpenseRelationships(
  row: Record<string, unknown>,
  maps: FromCloudMaps,
  categoryNameToId: Map<string, number>,
  payeeNameToId: Map<string, number>,
): Record<string, unknown> {
  const expense = fromCloud('expenses', row, maps)
  let categoryId = typeof expense.categoryId === 'number' ? expense.categoryId : undefined
  if (
    categoryId == null &&
    typeof expense.categoryNameSnapshot === 'string' &&
    expense.categoryNameSnapshot.trim().length > 0
  ) {
    categoryId = categoryNameToId.get(normalizeNameForSync(expense.categoryNameSnapshot))
  }

  let payeeId = typeof expense.payeeId === 'number' ? expense.payeeId : undefined
  if (
    payeeId == null &&
    typeof expense.payeeNameSnapshot === 'string' &&
    expense.payeeNameSnapshot.trim().length > 0
  ) {
    payeeId = payeeNameToId.get(normalizeNameForSync(expense.payeeNameSnapshot))
  }

  return {
    ...expense,
    categoryId,
    payeeId,
  }
}

async function reconcileSplitChildFields(splits: ExpenseSplit[]): Promise<void> {
  const activeSplits = splits.filter(
    (split): split is ExpenseSplit & { id: number } =>
      split.deletedAt == null && typeof split.id === 'number',
  )
  if (activeSplits.length === 0) return

  const now = new Date().toISOString()

  for (const split of activeSplits) {
    const children = (await db.expenses.where('splitId').equals(split.id).toArray()).filter(
      (expense): expense is Expense & { id: number } =>
        expense.deletedAt == null && typeof expense.id === 'number',
    )
    for (const child of children) {
      const needsUpdate = child.date !== split.date
      if (!needsUpdate) continue

      const pendingChild = markRecordPending(
        {
          ...child,
          date: split.date,
        },
        now,
      )
      await db.expenses.put({
        ...pendingChild,
        id: child.id,
      })
    }
  }
}

async function mergeSettingsRows(rows: Record<string, unknown>[]): Promise<void> {
  const existingRows = await db.settings.toArray()
  const existingByKey = new Map(
    existingRows
      .filter((row): row is { key: string; updatedAt?: string; value: unknown } => !!row.key)
      .map((row) => [row.key, row]),
  )
  const rowsToPut: SyncedSettingRow[] = []

  for (const row of rows) {
    const incoming = fromCloud('settings', row) as SyncRow & { key: string; value: unknown }
    const existing = existingByKey.get(incoming.key)
    if (existing && getIsoTimestampMs(existing.updatedAt) > getIsoTimestampMs(incoming.updatedAt)) {
      continue
    }

    rowsToPut.push({
      ...existing,
      ...incoming,
      key: incoming.key,
      value: incoming.value,
      updatedAt:
        typeof incoming.updatedAt === 'string' && incoming.updatedAt.length > 0
          ? incoming.updatedAt
          : new Date().toISOString(),
    })
  }

  if (rowsToPut.length > 0) {
    for (const batch of chunkArray(rowsToPut, SYNC_BATCH_SIZE)) {
      await db.settings.bulkPut(batch)
    }
  }
}

async function fetchOptionalRowsForUser(table: string, userId: string): Promise<Record<string, unknown>[]> {
  try {
    return await fetchAllRowsForUser(table, userId)
  } catch {
    return []
  }
}

export async function pullFromSupabase(userId: string): Promise<void> {
  if (!supabase || !userId) return

  const [
    catRows,
    payRows,
    tagRows,
    fixRows,
    setRows,
    snapRows,
    incomeSnapRows,
    savingsSnapRows,
    scheduleRows,
    categoryMergeRows,
    payeeMergeRows,
    expenseSplitRows,
    expRows,
    expenseTagRows,
  ] = await Promise.all([
    fetchAllRowsForUser('categories', userId),
    fetchAllRowsForUser('payees', userId),
    fetchOptionalRowsForUser('tags', userId),
    fetchAllRowsForUser('fixed_expenses', userId),
    fetchAllRowsForUser('settings', userId),
    fetchAllRowsForUser('fixed_expense_snapshots', userId),
    fetchAllRowsForUser('income_snapshots', userId),
    fetchAllRowsForUser('savings_snapshots', userId),
    fetchAllRowsForUser('schedules', userId),
    fetchAllRowsForUser('category_merge_history', userId),
    fetchAllRowsForUser('payee_merge_history', userId),
    fetchAllRowsForUser('expense_splits', userId),
    fetchAllRowsForUser('expenses', userId),
    fetchOptionalRowsForUser('expense_tags', userId),
  ])

  if (catRows.length > 0) {
    await mergeRows(
      'categories',
      catRows.map((row) => fromCloud('categories', row)),
      { normalizedNameFallback: true },
    )
  }
  if (payRows.length > 0) {
    await mergeRows(
      'payees',
      payRows.map((row) => fromCloud('payees', row)),
      { normalizedNameFallback: true },
    )
  }
  if (tagRows.length > 0) {
    await mergeRows(
      'tags',
      tagRows.map((row) => fromCloud('tags', row)),
      { normalizedNameFallback: true },
    )
  }
  if (fixRows.length > 0) {
    await mergeRows(
      'fixedExpenses',
      fixRows.map((row) => fromCloud('fixed_expenses', row)),
    )
  }
  if (setRows.length > 0) {
    await mergeSettingsRows(setRows)
  }

  const categories = await db.categories.toArray()
  const payees = await db.payees.toArray()
  const fixedExpenses = await db.fixedExpenses.toArray()
  const tags =
    'tags' in db
      ? await (db as unknown as { tags: { toArray: () => Promise<SyncRow[]> } }).tags.toArray()
      : []
  const expenses = await db.expenses.toArray()
  const syncExpenses = expenses as unknown as SyncRow[]
  const syncCategories = categories as unknown as SyncRow[]
  const syncPayees = payees as unknown as SyncRow[]
  const syncTags = tags as unknown as SyncRow[]
  const syncFixedExpenses = fixedExpenses as unknown as SyncRow[]
  const baseIdentityMaps = buildRelationshipMaps(
    syncExpenses,
    syncCategories,
    syncPayees,
    syncTags,
    syncFixedExpenses,
    [],
  )
  if (expenseSplitRows.length > 0) {
    await mergeRows(
      'expenseSplits',
      expenseSplitRows.map((row) => fromCloud('expense_splits', row, baseIdentityMaps)),
    )
  }
  const expenseSplits = await db.expenseSplits.toArray()
  const syncExpenseSplits = expenseSplits as unknown as SyncRow[]
  const identityMaps = buildRelationshipMaps(
    syncExpenses,
    syncCategories,
    syncPayees,
    syncTags,
    syncFixedExpenses,
    syncExpenseSplits,
  )
  const categoryNameToId = buildActiveNameToIdMap(syncCategories)
  const payeeNameToId = buildActiveNameToIdMap(syncPayees)

  debugLog(
    '[sync] identity maps ready',
    'categories:',
    identityMaps.cloudIdToCategoryId?.size ?? 0,
    'payees:',
    identityMaps.cloudIdToPayeeId?.size ?? 0,
    'fixed:',
    identityMaps.cloudIdToFixedExpenseId?.size ?? 0,
    'tags:',
    identityMaps.cloudIdToTagId?.size ?? 0,
    'splits:',
    identityMaps.cloudIdToExpenseSplitId?.size ?? 0,
  )

  if (snapRows.length > 0) {
    await mergeRows(
      'fixedExpenseSnapshots',
      snapRows.map((row) => fromCloud('fixed_expense_snapshots', row, identityMaps)),
    )
  }
  if (incomeSnapRows.length > 0) {
    await mergeRows(
      'incomeSnapshots',
      incomeSnapRows.map((row) => fromCloud('income_snapshots', row, identityMaps)),
    )
  }
  if (savingsSnapRows.length > 0) {
    await mergeRows(
      'savingsSnapshots',
      savingsSnapRows.map((row) => fromCloud('savings_snapshots', row, identityMaps)),
    )
  }
  if (scheduleRows.length > 0) {
    await mergeRows(
      'schedules',
      scheduleRows.map((row) => fromCloud('schedules', row, identityMaps)),
    )
  }
  if (categoryMergeRows.length > 0) {
    await mergeRows(
      'categoryMergeHistory',
      categoryMergeRows.map((row) => fromCloud('category_merge_history', row, identityMaps)),
    )
  }
  if (payeeMergeRows.length > 0) {
    await mergeRows(
      'payeeMergeHistory',
      payeeMergeRows.map((row) => fromCloud('payee_merge_history', row, identityMaps)),
    )
  }
  if (expRows.length > 0) {
    await mergeRows(
      'expenses',
      expRows.map((row) =>
        resolveExpenseRelationships(row, identityMaps, categoryNameToId, payeeNameToId),
      ),
    )
  }
  if (expenseTagRows.length > 0) {
    await mergeRows(
      'expenseTags',
      expenseTagRows
        .map((row) => fromCloud('expense_tags', row, identityMaps))
        .filter(
          (row) => typeof row.expenseId === 'number' && typeof row.tagId === 'number',
        ),
    )
  }

  await reconcileSplitChildFields(expenseSplits)

  await verifySyncIntegrity()
}
