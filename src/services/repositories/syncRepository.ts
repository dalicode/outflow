import type { SyncMetadataCounts, SyncMetadataDiagnostics, SyncQueueItem } from '../../types'
import db from '../db/schema'
import { LOCAL_ONLY_SETTING_KEYS } from '../sync/constants'

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
  'tags',
  'expenseTags',
  'fixedExpenses',
  'expenseSplits',
  'fixedExpenseSnapshots',
  'incomeSnapshots',
  'savingsSnapshots',
  'schedules',
  'settings',
  'categoryMergeHistory',
  'payeeMergeHistory',
  'tagMergeHistory',
] as const

function shouldCountSyncMetadataRow(tableName: string, row: { key?: unknown }): boolean {
  if (tableName !== 'settings') return true
  return !LOCAL_ONLY_SETTING_KEYS.has(String(row.key))
}

export async function hasPendingSyncMetadata(): Promise<boolean> {
  for (const tableName of SYNC_METADATA_TABLES) {
    const hasPending = await db
      .table(tableName)
      .filter(
        (row) =>
          shouldCountSyncMetadataRow(tableName, row) &&
          (row.syncStatus === 'pending' || row.syncStatus === 'failed'),
      )
      .limit(1)
      .count()
    if (hasPending > 0) return true
  }

  return false
}

export async function getSyncMetadataCounts(): Promise<SyncMetadataCounts> {
  const diagnostics = await getSyncMetadataDiagnostics()
  return {
    pending: diagnostics.pending,
    failed: diagnostics.failed,
  }
}

export async function getSyncMetadataDiagnostics(): Promise<SyncMetadataDiagnostics> {
  let pending = 0
  let failed = 0
  const byTable: SyncMetadataDiagnostics['byTable'] = []

  for (const tableName of SYNC_METADATA_TABLES) {
    const tablePending = await db
      .table(tableName)
      .filter((row) => shouldCountSyncMetadataRow(tableName, row) && row.syncStatus === 'pending')
      .count()
    const tableFailed = await db
      .table(tableName)
      .filter((row) => shouldCountSyncMetadataRow(tableName, row) && row.syncStatus === 'failed')
      .count()
    pending += tablePending
    failed += tableFailed

    if (tablePending > 0 || tableFailed > 0) {
      byTable.push({
        table: tableName,
        pending: tablePending,
        failed: tableFailed,
      })
    }
  }

  return { pending, failed, byTable }
}
