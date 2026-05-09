import type { SyncQueueItem } from '../../types'
import db from '../db/schema'

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  return db.syncQueue.orderBy('timestamp').toArray()
}

export function removeSyncQueueItem(id: number): Promise<void> {
  return db.syncQueue.delete(id)
}

export function clearSyncQueue(): Promise<void> {
  return db.syncQueue.clear()
}
