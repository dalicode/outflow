import type {
  Category,
  Expense,
  ExpenseTag,
  ExpenseSplit,
  FixedExpense,
  Payee,
  RecordSyncStatus,
  SyncedSettingRow,
  Tag,
} from '../../types'
import { markRecordFailed, markRecordPending, markRecordSynced } from '../../utils/syncMetadata'
import db from '../db/schema'
import { StorageService } from '../storageService'
import { supabase } from '../supabase'
import { isSyncPaused } from '../syncRuntime'
import { toCloud, toLocalCloudMap } from './conversion'
import { FULL_SYNC_DELETE_ORDER, FULL_SYNC_ORDER, LOCAL_ONLY_SETTING_KEYS } from './constants'
import { deduplicateByName } from './integrity'
import {
  assertNoSupabaseError,
  assertSyncRunActive,
  getIsoTimestampMs,
  upsertRowsInBatches,
} from './supabaseUtils'
import type { SyncRunGuardOptions, ToCloudMaps } from './types'

type SyncableRow = {
  id?: number
  key?: string
  localId?: string | null
  cloudId?: string | null
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
  syncStatus?: RecordSyncStatus
  lastSyncedAt?: string | null
  syncError?: string | null
  deviceId?: string | null
}

type UploadTableKey = (typeof FULL_SYNC_ORDER)[number]

type UploadEntry<T extends SyncableRow> = {
  row: T
  cloudRow: Record<string, unknown>
}

type UploadTableConfig<T extends SyncableRow> = {
  cloudTable: UploadTableKey
  mapperTable: string
  getRows: () => Promise<T[]>
  localTableName: string
  getPrimaryKey: (row: T) => number | string | null
  conflictTarget: string
  includeLegacyBridge: boolean
  shouldUploadRow?: (row: T) => boolean
}

type FreshnessFilteredEntries<T extends SyncableRow> = {
  staleCloudRowsDetected: boolean
  uploadEntries: UploadEntry<T>[]
}

type NameLikeRow = SyncableRow & {
  name?: string
  normalizedName?: string | null
}

function didLocalRowChangeDuringUpload(
  currentRow: SyncableRow | undefined,
  uploadedRow: SyncableRow,
): boolean {
  if (!currentRow) return false

  return (
    currentRow.updatedAt !== uploadedRow.updatedAt || currentRow.deletedAt !== uploadedRow.deletedAt
  )
}

function isPendingOrFailed(status: RecordSyncStatus | undefined): boolean {
  return status === 'pending' || status === 'failed'
}

function getReadableError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message
  if (typeof error === 'string' && error.trim().length > 0) return error
  return 'Sync upload failed'
}

function isTransientSyncError(error: unknown): boolean {
  const message = getReadableError(error).toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error') ||
    message.includes('network request failed') ||
    message.includes('load failed') ||
    message.includes('the network connection was lost') ||
    message.includes('network timeout') ||
    message.includes('timeout')
  )
}

function getCloudId(row: SyncableRow): string | undefined {
  if (typeof row.cloudId === 'string' && row.cloudId.length > 0) return row.cloudId
  return undefined
}

function getLocalId(row: SyncableRow): string | undefined {
  if (typeof row.localId === 'string' && row.localId.length > 0) return row.localId
  return undefined
}

function buildReturnedRowsByLocalId(
  rows: Record<string, unknown>[],
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const localId = row.local_id
    if (typeof localId === 'string' && localId.length > 0) {
      map.set(localId, row)
    }
  }
  return map
}

function buildReturnedRowsBySettingsKey(
  rows: Record<string, unknown>[],
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const key = row.key
    if (typeof key === 'string' && key.length > 0) {
      map.set(key, row)
    }
  }
  return map
}

function normalizeRowName(row: {
  name?: unknown
  normalizedName?: unknown
  normalized_name?: unknown
}): string | null {
  const normalizedName =
    typeof row.normalizedName === 'string' ? row.normalizedName : row.normalized_name
  if (typeof normalizedName === 'string' && normalizedName.trim().length > 0) {
    return normalizedName.trim().toLowerCase()
  }

  const name = row.name
  if (typeof name !== 'string' || name.trim().length === 0) return null
  return name.trim().replace(/\s+/gu, ' ').toLowerCase()
}

function buildReturnedRowsByNormalizedName(
  rows: Record<string, unknown>[],
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const normalizedName = normalizeRowName(row)
    if (normalizedName) {
      map.set(normalizedName, row)
    }
  }
  return map
}

async function filterEntriesAgainstCloudFreshness<T extends SyncableRow>(
  config: UploadTableConfig<T>,
  entries: UploadEntry<T>[],
  userId: string,
  options?: SyncRunGuardOptions,
): Promise<FreshnessFilteredEntries<T>> {
  if (!supabase || entries.length === 0 || config.conflictTarget !== 'user_id,local_id') {
    return {
      staleCloudRowsDetected: false,
      uploadEntries: entries,
    }
  }

  const localIds = entries
    .map((entry) => getLocalId(entry.row))
    .filter((localId): localId is string => typeof localId === 'string' && localId.length > 0)

  if (localIds.length === 0) {
    return {
      staleCloudRowsDetected: false,
      uploadEntries: entries,
    }
  }

  const cloudRowsByLocalId = new Map<string, Record<string, unknown>>()
  const chunkSize = 100
  for (let index = 0; index < localIds.length; index += chunkSize) {
    assertSyncRunActive(options?.shouldContinue)
    const result = await supabase
      .from(config.cloudTable)
      .select('*')
      .eq('user_id', userId)
      .in('local_id', localIds.slice(index, index + chunkSize))
    assertNoSupabaseError(
      result,
      `Fetch existing ${config.cloudTable} rows for freshness check ${index / chunkSize + 1}`,
    )

    for (const row of (result.data ?? []) as Record<string, unknown>[]) {
      const localId = row.local_id
      if (typeof localId === 'string' && localId.length > 0) {
        cloudRowsByLocalId.set(localId, row)
      }
    }
  }

  let staleCloudRowsDetected = false
  const uploadEntries = entries.filter((entry) => {
    const localId = getLocalId(entry.row)
    if (!localId) return true

    const cloudRow = cloudRowsByLocalId.get(localId)
    if (!cloudRow) return true

    const cloudUpdatedAtMs = getIsoTimestampMs(cloudRow.updated_at)
    const localUpdatedAtMs = getIsoTimestampMs(entry.row.updatedAt)
    if (cloudUpdatedAtMs > localUpdatedAtMs) {
      staleCloudRowsDetected = true
      return false
    }

    return true
  })

  return {
    staleCloudRowsDetected,
    uploadEntries,
  }
}

async function markTableRowsFailed<T extends SyncableRow>(
  config: UploadTableConfig<T>,
  entries: UploadEntry<T>[],
  syncError: string,
  keepPending: boolean,
  options?: SyncRunGuardOptions,
): Promise<void> {
  const table = db.table(config.localTableName)
  const failedAt = new Date().toISOString()
  for (const entry of entries) {
    assertSyncRunActive(options?.shouldContinue)
    const key = config.getPrimaryKey(entry.row)
    if (key == null) continue
    const currentRow = (await table.get(key)) as T | undefined
    if (didLocalRowChangeDuringUpload(currentRow, entry.row)) continue
    if (keepPending) {
      const pending = markRecordPending(entry.row, failedAt)
      await table.update(key, {
        syncStatus: pending.syncStatus,
        syncError: pending.syncError,
        deviceId: pending.deviceId ?? null,
        updatedAt: pending.updatedAt,
      } as Record<string, unknown>)
      continue
    }

    const failed = markRecordFailed(entry.row, syncError)
    await table.update(key, {
      syncStatus: failed.syncStatus,
      syncError: failed.syncError,
      deviceId: failed.deviceId ?? null,
    } as Record<string, unknown>)
  }
}

async function markTableRowsSynced<T extends SyncableRow>(
  config: UploadTableConfig<T>,
  entries: UploadEntry<T>[],
  returnedRows: Record<string, unknown>[],
  options?: SyncRunGuardOptions,
): Promise<void> {
  const table = db.table(config.localTableName)
  const syncedAt = new Date().toISOString()
  const byLocalId = buildReturnedRowsByLocalId(returnedRows)
  const bySettingsKey = buildReturnedRowsBySettingsKey(returnedRows)
  const byNormalizedName = buildReturnedRowsByNormalizedName(returnedRows)

  for (const entry of entries) {
    assertSyncRunActive(options?.shouldContinue)
    const key = config.getPrimaryKey(entry.row)
    if (key == null) continue
    const currentRow = (await table.get(key)) as T | undefined
    if (didLocalRowChangeDuringUpload(currentRow, entry.row)) continue

    const localId = getLocalId(entry.row)
    const returned =
      config.cloudTable === 'settings'
        ? bySettingsKey.get(String((entry.row as unknown as SyncedSettingRow).key))
        : localId
          ? byLocalId.get(localId)
          : undefined
    const returnedByName =
      (config.cloudTable === 'categories' || config.cloudTable === 'payees') && entry.row != null
        ? byNormalizedName.get(normalizeRowName(entry.row as NameLikeRow) ?? '')
        : undefined
    const matchedReturned = returned ?? returnedByName

    const cloudIdFromReturn = matchedReturned?.id
    const cloudId =
      typeof cloudIdFromReturn === 'string' && cloudIdFromReturn.length > 0
        ? cloudIdFromReturn
        : getCloudId(entry.row)
    const createdAtFromReturn = matchedReturned?.created_at
    const updatedAtFromReturn = matchedReturned?.updated_at
    const synced = markRecordSynced(
      entry.row,
      {
        cloudId: cloudId ?? null,
        createdAt:
          typeof createdAtFromReturn === 'string' && createdAtFromReturn.length > 0
            ? createdAtFromReturn
            : entry.row.createdAt,
        updatedAt:
          typeof updatedAtFromReturn === 'string' && updatedAtFromReturn.length > 0
            ? updatedAtFromReturn
            : entry.row.updatedAt,
      },
      syncedAt,
    )

    await table.update(key, {
      cloudId: synced.cloudId ?? null,
      createdAt: synced.createdAt ?? entry.row.createdAt ?? syncedAt,
      updatedAt: synced.updatedAt ?? entry.row.updatedAt ?? syncedAt,
      syncStatus: synced.syncStatus,
      lastSyncedAt: synced.lastSyncedAt,
      syncError: synced.syncError,
      deviceId: synced.deviceId ?? entry.row.deviceId ?? null,
    } as Record<string, unknown>)
    entry.row.cloudId = (synced.cloudId ?? null) as string | null
    entry.row.createdAt = synced.createdAt
    entry.row.updatedAt = synced.updatedAt
    entry.row.syncStatus = synced.syncStatus
    entry.row.lastSyncedAt = synced.lastSyncedAt
    entry.row.syncError = synced.syncError
  }
}

async function bridgeLegacyCloudLocalIds<T extends SyncableRow>(
  config: UploadTableConfig<T>,
  entries: UploadEntry<T>[],
  userId: string,
  maps: ToCloudMaps,
  options?: SyncRunGuardOptions,
): Promise<void> {
  assertSyncRunActive(options?.shouldContinue)
  if (!config.includeLegacyBridge) return
  const bridgeRows = entries
    .filter((entry) => {
      const cloudId = getCloudId(entry.row)
      const localId = getLocalId(entry.row)
      return cloudId != null && localId != null
    })
    .map((entry) => toCloud(config.mapperTable, entry.row as Record<string, unknown>, userId, maps))
  if (bridgeRows.length === 0) return
  await upsertRowsInBatches(config.cloudTable, bridgeRows, 'id', options)
}

async function deleteUserRowsForReplace(table: string, userId: string): Promise<void> {
  if (!supabase) return
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const deleteResult = await supabase.from(table).delete().eq('user_id', userId)

    if (!deleteResult.error) return

    const isDeadlock =
      typeof deleteResult.error === 'object' &&
      deleteResult.error != null &&
      'code' in deleteResult.error &&
      deleteResult.error.code === '40P01'
    if (!isDeadlock || attempt === maxAttempts) {
      assertNoSupabaseError(deleteResult, `Delete ${table} rows for replace`)
    }

    await new Promise((resolve) => globalThis.setTimeout(resolve, attempt * 100))
  }
}

async function replaceSupabaseData(
  userId: string,
  tables: readonly string[] = FULL_SYNC_DELETE_ORDER,
  options?: SyncRunGuardOptions,
): Promise<void> {
  for (const table of tables) {
    assertSyncRunActive(options?.shouldContinue)
    await deleteUserRowsForReplace(table, userId)
  }
}

export async function clearUserCloudData(userId: string): Promise<void> {
  if (!supabase || !userId) return
  await replaceSupabaseData(userId)
}

export async function migrateLocalToSupabase(
  userId: string,
  options: {
    ignorePause?: boolean
    forceUploadAll?: boolean
    includeTables?: readonly UploadTableKey[]
  } & SyncRunGuardOptions = {},
): Promise<boolean> {
  if (!supabase || !userId || (!options.ignorePause && isSyncPaused())) return false
  assertSyncRunActive(options.shouldContinue)

  await deduplicateByName(db.table('categories'), 'categoryId')
  assertSyncRunActive(options.shouldContinue)
  await deduplicateByName(db.table('payees'), 'payeeId')
  assertSyncRunActive(options.shouldContinue)

  const [
    allExpenses,
    allCategories,
    allPayees,
    allTags,
    allFixedExpenses,
    allSettings,
    allExpenseSplits,
    allFixedExpenseSnapshots,
    allIncomeSnapshots,
    allSavingsSnapshots,
    allSchedules,
    allCategoryMergeHistory,
    allPayeeMergeHistory,
    allExpenseTags,
  ] = await Promise.all([
    StorageService.getAllExpenses() as Promise<Expense[]>,
    StorageService.getAllCategories() as Promise<Category[]>,
    StorageService.getAllPayees() as Promise<Payee[]>,
    (typeof StorageService.getAllTags === 'function'
      ? (StorageService.getAllTags() as Promise<Tag[]>)
      : Promise.resolve([])),
    StorageService.getAllFixedExpenses() as Promise<FixedExpense[]>,
    StorageService.getAllSettingsRows(),
    StorageService.getAllExpenseSplits() as Promise<ExpenseSplit[]>,
    StorageService.getAllFixedExpenseSnapshots(),
    StorageService.getAllIncomeSnapshots(),
    StorageService.getAllSavingsSnapshots(),
    StorageService.getAllSchedules(),
    StorageService.db.categoryMergeHistory.toArray(),
    StorageService.db.payeeMergeHistory.toArray(),
    ('expenseTags' in StorageService.db
      ? (
          StorageService.db as unknown as {
            expenseTags: { toArray: () => Promise<ExpenseTag[]> }
          }
        ).expenseTags.toArray()
      : Promise.resolve([])) as Promise<ExpenseTag[]>,
  ])

  const maps: ToCloudMaps = {
    categoryIdToCloudId: toLocalCloudMap(allCategories),
    payeeIdToCloudId: toLocalCloudMap(allPayees),
    tagIdToCloudId: toLocalCloudMap(allTags),
    fixedExpenseIdToCloudId: toLocalCloudMap(allFixedExpenses),
    expenseSplitIdToCloudId: toLocalCloudMap(allExpenseSplits),
    expenseIdToCloudId: toLocalCloudMap(allExpenses),
  }

  const uploadConfigs: Array<UploadTableConfig<SyncableRow>> = [
    {
      cloudTable: 'categories',
      mapperTable: 'categories',
      getRows: async () => allCategories,
      localTableName: 'categories',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,name',
      includeLegacyBridge: true,
    },
    {
      cloudTable: 'payees',
      mapperTable: 'payees',
      getRows: async () => allPayees,
      localTableName: 'payees',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,name',
      includeLegacyBridge: true,
    },
    {
      cloudTable: 'tags',
      mapperTable: 'tags',
      getRows: async () => allTags,
      localTableName: 'tags',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,name',
      includeLegacyBridge: true,
    },
    {
      cloudTable: 'fixed_expenses',
      mapperTable: 'fixedExpenses',
      getRows: async () => allFixedExpenses,
      localTableName: 'fixedExpenses',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,local_id',
      includeLegacyBridge: true,
    },
    {
      cloudTable: 'expense_splits',
      mapperTable: 'expenseSplits',
      getRows: async () => allExpenseSplits,
      localTableName: 'expenseSplits',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,local_id',
      includeLegacyBridge: true,
    },
    {
      cloudTable: 'settings',
      mapperTable: 'settings',
      getRows: async () => allSettings,
      localTableName: 'settings',
      getPrimaryKey: (row) => (typeof row.key === 'string' ? row.key : null),
      conflictTarget: 'user_id,key',
      includeLegacyBridge: false,
      shouldUploadRow: (row) => !LOCAL_ONLY_SETTING_KEYS.has(String(row.key)),
    },
    {
      cloudTable: 'fixed_expense_snapshots',
      mapperTable: 'fixedExpenseSnapshots',
      getRows: async () => allFixedExpenseSnapshots,
      localTableName: 'fixedExpenseSnapshots',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,local_id',
      includeLegacyBridge: true,
    },
    {
      cloudTable: 'income_snapshots',
      mapperTable: 'incomeSnapshots',
      getRows: async () => allIncomeSnapshots,
      localTableName: 'incomeSnapshots',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,local_id',
      includeLegacyBridge: true,
    },
    {
      cloudTable: 'savings_snapshots',
      mapperTable: 'savingsSnapshots',
      getRows: async () => allSavingsSnapshots,
      localTableName: 'savingsSnapshots',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,local_id',
      includeLegacyBridge: true,
    },
    {
      cloudTable: 'schedules',
      mapperTable: 'schedules',
      getRows: async () => allSchedules,
      localTableName: 'schedules',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,local_id',
      includeLegacyBridge: true,
    },
    {
      cloudTable: 'category_merge_history',
      mapperTable: 'categoryMergeHistory',
      getRows: async () => allCategoryMergeHistory,
      localTableName: 'categoryMergeHistory',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,local_id',
      includeLegacyBridge: true,
    },
    {
      cloudTable: 'payee_merge_history',
      mapperTable: 'payeeMergeHistory',
      getRows: async () => allPayeeMergeHistory,
      localTableName: 'payeeMergeHistory',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,local_id',
      includeLegacyBridge: true,
    },
    {
      cloudTable: 'expenses',
      mapperTable: 'expenses',
      getRows: async () => allExpenses,
      localTableName: 'expenses',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,local_id',
      includeLegacyBridge: true,
    },
    {
      cloudTable: 'expense_tags',
      mapperTable: 'expenseTags',
      getRows: async () => allExpenseTags,
      localTableName: 'expenseTags',
      getPrimaryKey: (row) => (typeof row.id === 'number' ? row.id : null),
      conflictTarget: 'user_id,local_id',
      includeLegacyBridge: true,
    },
  ]

  const failures: string[] = []
  let staleCloudRowsDetected = false

  for (const config of uploadConfigs) {
    assertSyncRunActive(options.shouldContinue)
    if (options.includeTables && !options.includeTables.includes(config.cloudTable)) continue

    const rows = (await config.getRows()).filter((row) => {
      if (!options.forceUploadAll && !isPendingOrFailed(row.syncStatus)) return false
      if (!config.shouldUploadRow) return true
      return config.shouldUploadRow(row)
    })
    if (rows.length === 0) continue

    const entries: UploadEntry<SyncableRow>[] = rows.map((row) => ({
      row,
      cloudRow: toCloud(config.mapperTable, row as Record<string, unknown>, userId, maps),
    }))
    const freshnessFiltered = await filterEntriesAgainstCloudFreshness(
      config,
      entries,
      userId,
      options,
    )
    staleCloudRowsDetected = staleCloudRowsDetected || freshnessFiltered.staleCloudRowsDetected
    const entriesToUpload = freshnessFiltered.uploadEntries
    if (entriesToUpload.length === 0) continue

    try {
      await bridgeLegacyCloudLocalIds(config, entriesToUpload, userId, maps, options)
      const returnedRows = await upsertRowsInBatches(
        config.cloudTable,
        entriesToUpload.map((entry) => entry.cloudRow),
        config.conflictTarget,
        options,
      )
      await markTableRowsSynced(config, entriesToUpload, returnedRows, options)

      if (config.cloudTable === 'categories') {
        for (const entry of entriesToUpload) {
          const cloudId = getCloudId(entry.row)
          if (typeof entry.row.id === 'number' && cloudId) {
            maps.categoryIdToCloudId?.set(entry.row.id, cloudId)
          }
        }
      }
      if (config.cloudTable === 'payees') {
        for (const entry of entriesToUpload) {
          const cloudId = getCloudId(entry.row)
          if (typeof entry.row.id === 'number' && cloudId) {
            maps.payeeIdToCloudId?.set(entry.row.id, cloudId)
          }
        }
      }
      if (config.cloudTable === 'tags') {
        for (const entry of entriesToUpload) {
          const cloudId = getCloudId(entry.row)
          if (typeof entry.row.id === 'number' && cloudId) {
            maps.tagIdToCloudId?.set(entry.row.id, cloudId)
          }
        }
      }
      if (config.cloudTable === 'fixed_expenses') {
        for (const entry of entriesToUpload) {
          const cloudId = getCloudId(entry.row)
          if (typeof entry.row.id === 'number' && cloudId) {
            maps.fixedExpenseIdToCloudId?.set(entry.row.id, cloudId)
          }
        }
      }
      if (config.cloudTable === 'expense_splits') {
        for (const entry of entriesToUpload) {
          const cloudId = getCloudId(entry.row)
          if (typeof entry.row.id === 'number' && cloudId) {
            maps.expenseSplitIdToCloudId?.set(entry.row.id, cloudId)
          }
        }
      }
      if (config.cloudTable === 'expenses') {
        for (const entry of entriesToUpload) {
          const cloudId = getCloudId(entry.row)
          if (typeof entry.row.id === 'number' && cloudId) {
            maps.expenseIdToCloudId?.set(entry.row.id, cloudId)
          }
        }
      }
    } catch (error) {
      const message = getReadableError(error)
      await markTableRowsFailed(
        config,
        entriesToUpload,
        message,
        isTransientSyncError(error),
        options,
      )
      failures.push(`${config.cloudTable}: ${message}`)
    }
  }

  if (failures.length > 0) {
    throw new Error(`Sync upload failed for ${failures.join('; ')}`)
  }

  return staleCloudRowsDetected
}

export async function runFullSyncUpload(
  userId: string,
  replaceCloud = false,
  replaceTables?: readonly string[],
  options?: SyncRunGuardOptions,
): Promise<void> {
  const replaceUploadTables = replaceTables?.filter((table): table is UploadTableKey =>
    FULL_SYNC_ORDER.includes(table as UploadTableKey),
  )
  if (replaceCloud) {
    await replaceSupabaseData(userId, replaceTables, options)
  }
  await migrateLocalToSupabase(userId, {
    shouldContinue: options?.shouldContinue,
    forceUploadAll: replaceCloud,
    includeTables: replaceUploadTables,
  })
}
