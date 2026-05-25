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
  expenseIdToCloudId?: Map<number, string>
  categoryIdToCloudId?: Map<number, string>
  payeeIdToCloudId?: Map<number, string>
  tagIdToCloudId?: Map<number, string>
  fixedExpenseIdToCloudId?: Map<number, string>
  expenseSplitIdToCloudId?: Map<number, string>
}

export interface FromCloudMaps {
  cloudIdToExpenseId?: Map<string, number>
  cloudIdToCategoryId?: Map<string, number>
  cloudIdToPayeeId?: Map<string, number>
  cloudIdToTagId?: Map<string, number>
  cloudIdToFixedExpenseId?: Map<string, number>
  cloudIdToExpenseSplitId?: Map<string, number>
}
