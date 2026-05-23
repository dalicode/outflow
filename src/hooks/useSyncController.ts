import { useCallback, useEffect, useRef, useState } from 'react'
import { StorageService } from '../services/storageService'
import { isSyncPaused } from '../services/syncRuntime'
import { flushSyncQueue, pullFromSupabase } from '../services/syncService'
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
  | 'historical-data'
  | 'manual'
  | 'focus'
  | 'visible'
  | 'online'
  | 'token-refresh'
  | 'periodic'
  | 'retry'
  | 'queued-follow-up'

type SyncMode =
  | 'upload-only'
  | 'pull-then-upload'
  | 'upload-then-pull'
  | 'pull-only'
  | 'full-repair'

interface QueueSyncOptions {
  reason: SyncReason
  mode?: SyncMode
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
  pullAppliedCount: number
  queueSync: (options: QueueSyncOptions) => Promise<void>
  syncNow: () => Promise<void>
  syncLocalThenPull: () => Promise<void>
  syncLocalChanges: () => Promise<void>
  triggerSync: () => void
  shouldRunFreshnessSync: (force?: boolean) => boolean
  clearSyncTimers: () => void
  setExternalSyncStatus: (status: SyncStatus) => void
}

function shouldApplyFreshnessGate(reason: SyncReason): boolean {
  return (
    reason === 'focus' ||
    reason === 'visible' ||
    reason === 'periodic' ||
    reason === 'token-refresh'
  )
}

function shouldApplyRecentPullCooldown(reason: SyncReason): boolean {
  return (
    reason === 'focus' ||
    reason === 'visible' ||
    reason === 'periodic' ||
    reason === 'token-refresh'
  )
}

function modeIncludesPull(mode: SyncMode): boolean {
  return mode !== 'upload-only'
}

function modeIncludesUpload(mode: SyncMode): boolean {
  return mode !== 'pull-only'
}

function mergeQueuedOptions(
  existing: QueueSyncOptions | null,
  incoming: QueueSyncOptions,
): QueueSyncOptions {
  if (!existing) return incoming

  const existingMode = existing.mode ?? 'pull-then-upload'
  const incomingMode = incoming.mode ?? 'pull-then-upload'

  const mergedMode = (() => {
    if (existingMode === 'full-repair' || incomingMode === 'full-repair') return 'full-repair'
    if (existingMode === incomingMode) return incomingMode

    const needsPull = modeIncludesPull(existingMode) || modeIncludesPull(incomingMode)
    const needsUpload = modeIncludesUpload(existingMode) || modeIncludesUpload(incomingMode)

    if (needsPull && needsUpload) return 'upload-then-pull'
    if (needsPull) return 'pull-only'
    return 'upload-only'
  })()

  return {
    reason: incoming.reason,
    mode: mergedMode,
    force: Boolean(existing.force || incoming.force),
  }
}

export function useSyncController({
  userId,
  runRecoveryCheck,
}: UseSyncControllerParams): UseSyncControllerResult {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncCount, setSyncCount] = useState(0)
  const [pullAppliedCount, setPullAppliedCount] = useState(0)
  const [hasSynced, setHasSynced] = useState(false)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [failedSyncCount, setFailedSyncCount] = useState(0)
  const [isBrowserOnline, setIsBrowserOnline] = useState(() => {
    if (typeof navigator === 'undefined' || !('onLine' in navigator)) return true
    return navigator.onLine
  })

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

  const updateAggregateSyncStatus = useCallback(
    (counts: { pending: number; failed: number }) => {
      if (syncingRef.current) {
        setSyncStatus('syncing')
        return
      }

      if (!isBrowserOnline) {
        setSyncStatus('offline')
        return
      }

      if (counts.failed > 0) {
        setSyncStatus('error')
        return
      }

      setSyncStatus('idle')
    },
    [isBrowserOnline],
  )

  const refreshAggregateSyncState = useCallback(async (): Promise<{
    pending: number
    failed: number
  }> => {
    if (!userId || isSyncPaused()) {
      const emptyCounts = { pending: 0, failed: 0 }
      setPendingSyncCount(0)
      setFailedSyncCount(0)
      updateAggregateSyncStatus(emptyCounts)
      return emptyCounts
    }

    const counts = await StorageService.getSyncMetadataCounts()
    setPendingSyncCount(counts.pending)
    setFailedSyncCount(counts.failed)
    updateAggregateSyncStatus(counts)
    return counts
  }, [updateAggregateSyncStatus, userId])

  const getHasPendingLocalChanges = useCallback(async (): Promise<boolean> => {
    if (isSyncPaused()) return false
    return StorageService.hasPendingSyncMetadata()
  }, [])

  const resolveSyncMode = useCallback(
    async (options: QueueSyncOptions): Promise<SyncMode> => {
      if (options.mode) return options.mode

      const needsPendingCheck =
        options.reason === 'focus' ||
        options.reason === 'visible' ||
        options.reason === 'periodic' ||
        options.reason === 'token-refresh' ||
        options.reason === 'retry' ||
        options.reason === 'queued-follow-up'
      const hasPendingLocalChanges = needsPendingCheck ? await getHasPendingLocalChanges() : false

      switch (options.reason) {
        case 'startup':
        case 'sign-in':
          return 'pull-then-upload'
        case 'manual':
        case 'historical-data':
        case 'online':
          return 'upload-then-pull'
        case 'focus':
        case 'visible':
        case 'periodic':
        case 'token-refresh':
        case 'retry':
        case 'queued-follow-up':
          return hasPendingLocalChanges ? 'upload-then-pull' : 'pull-only'
        case 'local-change':
          return 'upload-only'
        default:
          return 'pull-then-upload'
      }
    },
    [getHasPendingLocalChanges],
  )

  const flushQueuedChanges = useCallback(
    async (id: string, generation: number): Promise<boolean> => {
      if (isSyncPaused()) return false
      const hadPendingChanges = await getHasPendingLocalChanges()

      await withTimeout(
        flushSyncQueue(id, {
          shouldContinue: () => isCurrentSyncRun(generation),
        }),
        15000,
      )
      return hadPendingChanges
    },
    [getHasPendingLocalChanges, isCurrentSyncRun],
  )

  const runSyncNow = useCallback(
    async (id: string, options: QueueSyncOptions, generation: number) => {
      if (isSyncPaused()) return
      if (syncingRef.current) return
      syncingRef.current = true
      if (isCurrentSyncRun(generation)) {
        setSyncStatus('syncing')
      }
      const mode = options.mode ?? 'pull-then-upload'
      debugLog('[sync] running', options.reason, mode)

      try {
        if (mode === 'upload-only') {
          await flushQueuedChanges(id, generation)
        } else if (mode === 'upload-then-pull') {
          await flushQueuedChanges(id, generation)
          await withTimeout(pullFromSupabase(id), 30000)
          if (isCurrentSyncRun(generation)) {
            setPullAppliedCount((c) => c + 1)
          }
        } else if (mode === 'pull-only') {
          await withTimeout(pullFromSupabase(id), 30000)
          if (isCurrentSyncRun(generation)) {
            setPullAppliedCount((c) => c + 1)
          }
        } else if (mode === 'full-repair') {
          await withTimeout(pullFromSupabase(id), 30000)
          if (isCurrentSyncRun(generation)) {
            setPullAppliedCount((c) => c + 1)
          }
          await flushQueuedChanges(id, generation)
        } else {
          await withTimeout(pullFromSupabase(id), 30000)
          if (isCurrentSyncRun(generation)) {
            setPullAppliedCount((c) => c + 1)
          }
          await flushQueuedChanges(id, generation)
        }

        if (isCurrentSyncRun(generation)) {
          await runRecoveryCheck()
          lastSuccessfulSyncAtRef.current = Date.now()
          setHasSynced(true)
          setSyncCount((c) => c + 1)
          await refreshAggregateSyncState()
          debugLog('[sync] complete', options.reason)
        }
      } catch (error) {
        if (isCurrentSyncRun(generation)) {
          await refreshAggregateSyncState()
          debugWarn('[sync] failed, will retry in 30s', options.reason)
        }
        throw error
      } finally {
        syncingRef.current = false
        if (isCurrentSyncRun(generation)) {
          await refreshAggregateSyncState()
        }
      }
    },
    [flushQueuedChanges, isCurrentSyncRun, refreshAggregateSyncState, runRecoveryCheck],
  )

  const queueSync = useCallback(
    async (options: QueueSyncOptions): Promise<void> => {
      if (!userId || isSyncPaused()) return
      const resolvedMode = await resolveSyncMode(options)
      const shouldPull = modeIncludesPull(resolvedMode)

      if (shouldPull && !shouldRunRecentPullSync(options.force, options.reason)) {
        return
      }
      if (
        shouldPull &&
        !options.force &&
        shouldApplyFreshnessGate(options.reason) &&
        !shouldRunFreshnessSync()
      ) {
        return
      }

      const guardedOptions = { ...options, mode: resolvedMode }
      debugLog('[sync] queued', guardedOptions.reason, guardedOptions.mode)

      if (activeSyncPromiseRef.current) {
        followUpSyncRequestedRef.current = true
        pendingFollowUpOptionsRef.current = mergeQueuedOptions(
          pendingFollowUpOptionsRef.current,
          guardedOptions,
        )
        debugLog('[sync] follow-up requested', guardedOptions.reason)
        return activeSyncPromiseRef.current
      }

      const run = async () => {
        const generation = syncRunGenerationRef.current + 1
        syncRunGenerationRef.current = generation
        let nextOptions: QueueSyncOptions | null = guardedOptions

        do {
          followUpSyncRequestedRef.current = false
          pendingFollowUpOptionsRef.current = null
          await runSyncNow(userId, nextOptions, generation)
          nextOptions = followUpSyncRequestedRef.current
            ? (pendingFollowUpOptionsRef.current ?? {
                reason: 'queued-follow-up',
                mode: 'upload-then-pull',
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
          if (userId) void queueSync({ reason: 'retry', mode: 'upload-then-pull', force: true })
        })
        throw error
      })
    },
    [
      runSyncNow,
      resolveSyncMode,
      scheduleRetry,
      shouldRunFreshnessSync,
      shouldRunRecentPullSync,
      userId,
    ],
  )

  const syncNow = useCallback(
    () => queueSync({ reason: 'manual', mode: 'upload-then-pull', force: true }),
    [queueSync],
  )

  const syncLocalThenPull = useCallback(
    () => queueSync({ reason: 'historical-data', mode: 'upload-then-pull', force: true }),
    [queueSync],
  )

  const syncLocalChanges = useCallback(
    () => queueSync({ reason: 'local-change', mode: 'upload-only', force: true }),
    [queueSync],
  )

  const triggerSync = useCallback(() => {
    if (!userId || isSyncPaused()) return
    void refreshAggregateSyncState()
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    flushTimerRef.current = setTimeout(() => {
      void queueSync({ reason: 'local-change', mode: 'upload-only' })
    }, LOCAL_CHANGE_SYNC_DEBOUNCE_MS)
  }, [queueSync, refreshAggregateSyncState, userId])

  useEffect(() => {
    if (!userId) return

    const maybePull = async (
      reason: Extract<SyncReason, 'focus' | 'online' | 'periodic' | 'visible'>,
    ) => {
      if (document.visibilityState !== 'visible') return
      if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) return
      if (reason !== 'online' && !shouldRunFreshnessSync()) return
      void queueSync({ reason })
    }

    const handleFocus = () => maybePull('focus')
    const handleOnline = () => {
      setIsBrowserOnline(true)
      void maybePull('online')
    }
    const handleOffline = () => {
      setIsBrowserOnline(false)
    }
    const handleVisibilityChange = () => maybePull('visible')
    const intervalId = window.setInterval(() => maybePull('periodic'), PERIODIC_PULL_INTERVAL_MS)

    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [queueSync, shouldRunFreshnessSync, userId])

  useEffect(() => {
    void refreshAggregateSyncState()
  }, [refreshAggregateSyncState])

  useEffect(() => {
    updateAggregateSyncStatus({ pending: pendingSyncCount, failed: failedSyncCount })
  }, [failedSyncCount, pendingSyncCount, updateAggregateSyncStatus])

  return {
    syncStatus,
    hasSynced,
    syncCount,
    pullAppliedCount,
    queueSync,
    syncNow,
    syncLocalThenPull,
    syncLocalChanges,
    triggerSync,
    shouldRunFreshnessSync,
    clearSyncTimers,
    setExternalSyncStatus,
  }
}

export type {
  QueueSyncOptions,
  SyncMode,
  SyncReason,
  UseSyncControllerParams,
  UseSyncControllerResult,
}
