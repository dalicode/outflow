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

const SYNC_METADATA_TABLES = [
  'expenses',
  'categories',
  'payees',
  'fixedExpenses',
  'expenseSplits',
  'fixedExpenseSnapshots',
  'incomeSnapshots',
  'savingsSnapshots',
  'schedules',
  'settings',
  'categoryMergeHistory',
  'payeeMergeHistory',
] as const

export interface SyncMetadataCounts {
  pending: number
  failed: number
}

export async function hasPendingSyncMetadata(): Promise<boolean> {
  for (const tableName of SYNC_METADATA_TABLES) {
    const hasPending = await db
      .table(tableName)
      .filter((row) => row.syncStatus === 'pending' || row.syncStatus === 'failed')
      .limit(1)
      .count()
    if (hasPending > 0) return true
  }

  return false
}

export async function getSyncMetadataCounts(): Promise<SyncMetadataCounts> {
  let pending = 0
  let failed = 0

  for (const tableName of SYNC_METADATA_TABLES) {
    pending += await db
      .table(tableName)
      .filter((row) => row.syncStatus === 'pending')
      .count()
    failed += await db
      .table(tableName)
      .filter((row) => row.syncStatus === 'failed')
      .count()
  }

  return { pending, failed }
}
