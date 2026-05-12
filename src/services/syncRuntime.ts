const pauseReasons = new Set<string>()

export const FULL_SYNC_QUEUE_TABLE = '__full_sync__'
export const FULL_SYNC_QUEUE_REASON = 'backup-import'
export const CSV_REPLACE_QUEUE_REASON = 'csv-import-replace'
export const CSV_IMPORT_QUEUE_REASON = 'csv-import'

export function pauseSync(reason: string): void {
  pauseReasons.add(reason)
}

export function resumeSync(reason: string): void {
  pauseReasons.delete(reason)
}

export function isSyncPaused(): boolean {
  return pauseReasons.size > 0
}

export function getSyncPauseReasons(): string[] {
  return [...pauseReasons]
}
