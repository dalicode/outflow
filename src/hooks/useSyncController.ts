import { useCallback, useEffect, useRef, useState } from 'react'
import { StorageService } from '../services/storageService'
import { isSyncPaused } from '../services/syncRuntime'
import { flushSyncQueue, migrateLocalToSupabase, pullFromSupabase } from '../services/syncService'
import type { SyncStatus } from '../types'
import { debugLog, debugWarn } from '../utils/debug'
import { withTimeout } from '../utils/withTimeout'

const PERIODIC_PULL_INTERVAL_MS = 300 * 1000
const FRESHNESS_SYNC_THRESHOLD_MS = 30 * 1000
const RECENT_PULL_COOLDOWN_MS = 10 * 1000
const LOCAL_CHANGE_SYNC_DEBOUNCE_MS = 2000

type SyncReason =
  | 'startup'
  | 'sign-in'
  | 'local-change'
  | 'manual'
  | 'focus'
  | 'visible'
  | 'online'
  | 'token-refresh'
  | 'periodic'
  | 'retry'
  | 'queued-follow-up'

interface QueueSyncOptions {
  reason: SyncReason
  mode?: 'pull-and-flush' | 'flush-only' | 'full-upload-after-pull'
  force?: boolean
}

interface UseSyncControllerParams {
  userId?: string
  runRecoveryCheck: () => Promise<void>
}

interface UseSyncControllerResult {
  syncStatus: SyncStatus
  hasSynced: boolean
  syncCount: number
  queueSync: (options: QueueSyncOptions) => Promise<void>
  syncNow: () => Promise<void>
  triggerSync: () => void
  shouldRunFreshnessSync: (force?: boolean) => boolean
  clearSyncTimers: () => void
  setExternalSyncStatus: (status: SyncStatus) => void
}

function shouldApplyFreshnessGate(reason: SyncReason): boolean {
  return reason === 'focus' || reason === 'visible' || reason === 'periodic'
}

function shouldApplyRecentPullCooldown(reason: SyncReason): boolean {
  return (
    reason === 'focus' ||
    reason === 'visible' ||
    reason === 'periodic' ||
    reason === 'token-refresh'
  )
}

function getModeRank(mode: QueueSyncOptions['mode']): number {
  switch (mode) {
    case 'full-upload-after-pull':
      return 3
    case 'pull-and-flush':
    case undefined:
      return 2
    case 'flush-only':
      return 1
    default:
      return 0
  }
}

function mergeQueuedOptions(
  existing: QueueSyncOptions | null,
  incoming: QueueSyncOptions,
): QueueSyncOptions {
  if (!existing) return incoming

  const strongestMode =
    getModeRank(incoming.mode) >= getModeRank(existing.mode) ? incoming.mode : existing.mode

  return {
    reason: incoming.reason,
    mode: strongestMode,
    force: Boolean(existing.force || incoming.force),
  }
}

export function useSyncController({
  userId,
  runRecoveryCheck,
}: UseSyncControllerParams): UseSyncControllerResult {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncCount, setSyncCount] = useState(0)
  const [hasSynced, setHasSynced] = useState(false)

  const syncingRef = useRef(false)
  const activeSyncPromiseRef = useRef<Promise<void> | null>(null)
  const followUpSyncRequestedRef = useRef(false)
  const pendingFollowUpOptionsRef = useRef<QueueSyncOptions | null>(null)
  const lastSuccessfulSyncAtRef = useRef<number>(0)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncRunGenerationRef = useRef(0)

  const isCurrentSyncRun = useCallback((generation: number) => {
    return syncRunGenerationRef.current === generation
  }, [])

  const scheduleRetry = useCallback((callback: () => void) => {
    if (retryTimerRef.current) return
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null
      callback()
    }, 30000)
  }, [])

  const clearSyncTimers = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  const shouldRunFreshnessSync = useCallback((force = false) => {
    if (force) return true
    return Date.now() - lastSuccessfulSyncAtRef.current >= FRESHNESS_SYNC_THRESHOLD_MS
  }, [])

  const shouldRunRecentPullSync = useCallback((force = false, reason?: SyncReason) => {
    if (force) return true
    if (!reason || !shouldApplyRecentPullCooldown(reason)) return true
    return Date.now() - lastSuccessfulSyncAtRef.current >= RECENT_PULL_COOLDOWN_MS
  }, [])

  const setExternalSyncStatus = useCallback((status: SyncStatus) => {
    setSyncStatus(status)
  }, [])

  const flushQueuedChanges = useCallback(
    async (id: string, generation: number): Promise<boolean> => {
      if (isSyncPaused()) return false
      const queue = await StorageService.getSyncQueue()
      if (queue.length === 0) {
        if (isCurrentSyncRun(generation)) {
          setSyncStatus('idle')
        }
        return false
      }

      await withTimeout(
        flushSyncQueue(id, {
          shouldContinue: () => isCurrentSyncRun(generation),
        }),
        15000,
      )
      return true
    },
    [isCurrentSyncRun],
  )

  const runSyncNow = useCallback(
    async (id: string, options: QueueSyncOptions, generation: number) => {
      if (isSyncPaused()) return
      if (syncingRef.current) return
      syncingRef.current = true
      if (isCurrentSyncRun(generation)) {
        setSyncStatus('syncing')
      }
      debugLog('[sync] running', options.reason, options.mode ?? 'pull-and-flush')

      try {
        if (options.mode === 'flush-only') {
          await flushQueuedChanges(id, generation)
        } else if (options.mode === 'full-upload-after-pull') {
          await withTimeout(pullFromSupabase(id), 30000)
          await withTimeout(migrateLocalToSupabase(id), 45000)
          await flushQueuedChanges(id, generation)
        } else {
          await withTimeout(pullFromSupabase(id), 30000)
          await flushQueuedChanges(id, generation)
        }

        if (isCurrentSyncRun(generation)) {
          await runRecoveryCheck()
          lastSuccessfulSyncAtRef.current = Date.now()
          setHasSynced(true)
          setSyncCount((c) => c + 1)
          setSyncStatus('idle')
          debugLog('[sync] complete', options.reason)
        }
      } catch (error) {
        if (isCurrentSyncRun(generation)) {
          setSyncStatus('error')
          debugWarn('[sync] failed, will retry in 30s', options.reason)
        }
        throw error
      } finally {
        syncingRef.current = false
      }
    },
    [flushQueuedChanges, isCurrentSyncRun, runRecoveryCheck],
  )

  const queueSync = useCallback(
    async (options: QueueSyncOptions): Promise<void> => {
      if (!userId || isSyncPaused()) return
      if (!shouldRunRecentPullSync(options.force, options.reason)) {
        return
      }
      if (!options.force && shouldApplyFreshnessGate(options.reason) && !shouldRunFreshnessSync()) {
        return
      }
      debugLog('[sync] queued', options.reason, options.mode ?? 'pull-and-flush')

      if (activeSyncPromiseRef.current) {
        followUpSyncRequestedRef.current = true
        pendingFollowUpOptionsRef.current = mergeQueuedOptions(
          pendingFollowUpOptionsRef.current,
          options,
        )
        debugLog('[sync] follow-up requested', options.reason)
        return activeSyncPromiseRef.current
      }

      const run = async () => {
        const generation = syncRunGenerationRef.current + 1
        syncRunGenerationRef.current = generation
        let nextOptions: QueueSyncOptions | null = options

        do {
          followUpSyncRequestedRef.current = false
          pendingFollowUpOptionsRef.current = null
          await runSyncNow(userId, nextOptions, generation)
          nextOptions = followUpSyncRequestedRef.current
            ? (pendingFollowUpOptionsRef.current ?? {
                reason: 'queued-follow-up',
                mode: 'pull-and-flush',
                force: true,
              })
            : null
        } while (nextOptions && !isSyncPaused())
      }

      activeSyncPromiseRef.current = run().finally(() => {
        activeSyncPromiseRef.current = null
      })

      return activeSyncPromiseRef.current.catch((error) => {
        scheduleRetry(() => {
          if (userId) void queueSync({ reason: 'retry', mode: 'pull-and-flush', force: true })
        })
        throw error
      })
    },
    [runSyncNow, scheduleRetry, shouldRunFreshnessSync, userId],
  )

  const syncNow = useCallback(
    () => queueSync({ reason: 'manual', mode: 'pull-and-flush', force: true }),
    [queueSync],
  )

  const triggerSync = useCallback(() => {
    if (!userId || isSyncPaused()) return
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    flushTimerRef.current = setTimeout(() => {
      void queueSync({ reason: 'local-change', mode: 'flush-only' })
    }, LOCAL_CHANGE_SYNC_DEBOUNCE_MS)
  }, [queueSync, userId])

  useEffect(() => {
    if (!userId) return

    const maybePull = (
      reason: Extract<SyncReason, 'focus' | 'online' | 'periodic' | 'visible'>,
    ) => {
      if (document.visibilityState !== 'visible') return
      if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) return
      if (reason !== 'online' && !shouldRunFreshnessSync()) return
      void queueSync({ reason, mode: 'pull-and-flush' })
    }

    const handleFocus = () => maybePull('focus')
    const handleOnline = () => maybePull('online')
    const handleVisibilityChange = () => maybePull('visible')
    const intervalId = window.setInterval(() => maybePull('periodic'), PERIODIC_PULL_INTERVAL_MS)

    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [queueSync, shouldRunFreshnessSync, userId])

  return {
    syncStatus,
    hasSynced,
    syncCount,
    queueSync,
    syncNow,
    triggerSync,
    shouldRunFreshnessSync,
    clearSyncTimers,
    setExternalSyncStatus,
  }
}

export type { QueueSyncOptions, SyncReason, UseSyncControllerParams, UseSyncControllerResult }
