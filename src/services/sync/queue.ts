import type { Category, FixedExpense, Payee, SyncQueueItem } from '../../types'
import { StorageService } from '../storageService'
import { supabase } from '../supabase'
import {
  CSV_IMPORT_QUEUE_REASON,
  CSV_REPLACE_QUEUE_REASON,
  FULL_SYNC_QUEUE_REASON,
  FULL_SYNC_QUEUE_TABLE,
  isSyncPaused,
} from '../syncRuntime'
import { LOCAL_ONLY_SETTING_KEYS, TABLE_MAP } from './constants'
import { toCloud, toLocalCloudMap } from './conversion'
import { runFullSyncUpload } from './fullUpload'
import {
  assertNoSupabaseError,
  assertSyncRunActive,
  ensureCloudIdsForSync,
  upsertRowsInBatches,
} from './supabaseUtils'
import type { CompactedSyncQueueItem, SyncRunGuardOptions } from './types'

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

export function compactSyncQueueItems(queue: SyncQueueItem[]): CompactedSyncQueueItem[] {
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

export async function flushSyncQueue(userId: string, options?: SyncRunGuardOptions): Promise<void> {
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
    const replaceTables = fullSyncItems.find((item) => Array.isArray(item.payload.replaceTables))
      ?.payload.replaceTables as string[] | undefined
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

  const [categories, payees, fixedExpenses] = await Promise.all([
    StorageService.getCategories() as Promise<Category[]>,
    StorageService.getPayees() as Promise<Payee[]>,
    StorageService.getFixedExpenses() as Promise<FixedExpense[]>,
  ])
  const maps = {
    categoryIdToCloudId: toLocalCloudMap(categories),
    payeeIdToCloudId: toLocalCloudMap(payees),
    fixedExpenseIdToCloudId: toLocalCloudMap(fixedExpenses),
  }

  const deleteItemsByCloudTable = new Map<string, Array<{ itemIds: number[]; cloudId: string }>>()
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
        const result = await supabase
          .from(cloudTable)
          .delete()
          .eq('id', item.cloudId)
          .eq('user_id', userId)
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
