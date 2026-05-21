import type { SyncQueueItem } from '../../types'

export interface SyncRunGuardOptions {
  shouldContinue?: () => boolean
}

export interface CompactedSyncQueueItem {
  itemIds: number[]
  latestTimestamp: number
  table: string
  operation: SyncQueueItem['operation']
  payload: Record<string, unknown>
}

export interface SupabaseResult {
  error?: { message?: string; code?: string; details?: string } | null
}

export interface ToCloudMaps {
  categoryIdToCloudId?: Map<number, string>
  payeeIdToCloudId?: Map<number, string>
  fixedExpenseIdToCloudId?: Map<number, string>
}

export interface FromCloudMaps {
  cloudIdToCategoryId?: Map<string, number>
  cloudIdToPayeeId?: Map<string, number>
  cloudIdToFixedExpenseId?: Map<string, number>
}
