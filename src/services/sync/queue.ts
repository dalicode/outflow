import type { SyncQueueItem } from '../../types'
import { StorageService } from '../storageService'
import { supabase } from '../supabase'
import {
  CSV_IMPORT_QUEUE_REASON,
  CSV_REPLACE_QUEUE_REASON,
  FULL_SYNC_QUEUE_REASON,
  FULL_SYNC_QUEUE_TABLE,
  isSyncPaused,
} from '../syncRuntime'
import { runFullSyncUpload, migrateLocalToSupabase } from './fullUpload'
import { assertSyncRunActive } from './supabaseUtils'
import type { SyncRunGuardOptions } from './types'

export async function flushSyncQueue(userId: string, options?: SyncRunGuardOptions): Promise<void> {
  if (!supabase || !userId || isSyncPaused()) return

  assertSyncRunActive(options?.shouldContinue)
  const queue = (await StorageService.getSyncQueue()) as SyncQueueItem[]
  if (queue.length > 0) {
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

      await runFullSyncUpload(userId, shouldReplaceCloud || Boolean(replaceTables), replaceTables, {
        shouldContinue: options?.shouldContinue,
      })
      assertSyncRunActive(options?.shouldContinue)

      for (const item of fullSyncItems) {
        await StorageService.removeSyncQueueItem(item.id as number)
      }
    }
  }

  assertSyncRunActive(options?.shouldContinue)
  await migrateLocalToSupabase(userId, {
    shouldContinue: options?.shouldContinue,
  })
}
