import type { SyncQueueItem } from '../types'
import db from './db/schema'
import { FULL_SYNC_QUEUE_TABLE, pauseSync, resumeSync } from './syncRuntime'

interface QueueImportSyncMarkerOptions {
  clearTables?: string[]
  clearReasons?: string[]
  preserveDeletesOnly?: boolean
}

interface ImportSyncMarkerPayload {
  [key: string]: unknown
  reason: string
  replace?: boolean
  replaceTables?: string[]
}

interface RunLocalImportOptions {
  pauseReason: string
  runLocalWrite: () => Promise<void>
  onRefreshAll?: () => Promise<void> | void
  onStatus: (status: string) => void
  triggerSync?: () => void
  hasCloudSync?: boolean
  importingStatus?: string
  importedLocalStatus?: string
  importedCloudStatus?: string
}

export async function queueImportSyncMarker(
  payload: ImportSyncMarkerPayload,
  {
    clearTables = [],
    clearReasons = [],
    preserveDeletesOnly = false,
  }: QueueImportSyncMarkerOptions = {},
): Promise<void> {
  await db.transaction('rw', db.syncQueue, async () => {
    const existingQueue = await db.syncQueue.toArray()
    const preserved = existingQueue.filter((item) => {
      if (preserveDeletesOnly) {
        return item.operation === 'delete'
      }

      if (clearTables.includes(item.table)) {
        return false
      }

      if (
        item.table === FULL_SYNC_QUEUE_TABLE &&
        clearReasons.includes(String(item.payload.reason))
      ) {
        return false
      }

      return true
    })

    await db.syncQueue.clear()
    if (preserved.length > 0) {
      await db.syncQueue.bulkAdd(preserved.map(({ id: _id, ...rest }: SyncQueueItem) => rest))
    }

    await db.syncQueue.add({
      table: FULL_SYNC_QUEUE_TABLE,
      operation: 'upsert',
      payload,
      timestamp: Date.now(),
    })
  })
}

export async function runLocalImport({
  pauseReason,
  runLocalWrite,
  onRefreshAll,
  onStatus,
  triggerSync,
  hasCloudSync = false,
  importingStatus = 'Importing locally…',
  importedLocalStatus = 'Import completed locally.',
  importedCloudStatus = 'Import completed locally. Cloud sync queued in the background.',
}: RunLocalImportOptions): Promise<void> {
  onStatus(importingStatus)
  pauseSync(pauseReason)
  try {
    await runLocalWrite()
  } finally {
    resumeSync(pauseReason)
  }

  await onRefreshAll?.()
  onStatus(hasCloudSync ? importedCloudStatus : importedLocalStatus)
  triggerSync?.()
}
