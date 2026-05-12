import type { AuthError, User } from '@supabase/supabase-js'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { StorageService } from '../services/storageService'
import { runRecoveryDiagnostics, type RecoveryReport, type RecoveryStatus } from '../services/recoveryService'
import { supabase } from '../services/supabase'
import { isSyncPaused, pauseSync, resumeSync } from '../services/syncRuntime'
import {
  clearUserCloudData,
  flushSyncQueue,
  migrateLocalToSupabase,
  pullFromSupabase,
} from '../services/syncService'
import type { SyncStatus } from '../types'
import { debugLog, debugWarn } from '../utils/debug'

const PERIODIC_PULL_INTERVAL_MS = 5 * 60 * 1000
const FRESHNESS_SYNC_THRESHOLD_MS = 2 * 60 * 1000
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

interface AuthContextValue {
  user: User | null
  loading: boolean
  syncStatus: SyncStatus
  hasSynced: boolean
  syncCount: number
  recoveryStatus: RecoveryStatus | 'recovering'
  recoveryReport: RecoveryReport | null
  runRecoveryCheck: () => Promise<void>
  rebuildCloudFromLocal: () => Promise<void>
  syncNow: () => Promise<void>
  triggerSync: () => void
  signOut: () => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncCount, setSyncCount] = useState(0)

  // hasSynced is true after the first successful sync
  const [hasSynced, setHasSynced] = useState(false)
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus | 'recovering'>('healthy')
  const [recoveryReport, setRecoveryReport] = useState<RecoveryReport | null>(null)
  const [authEvent, setAuthEvent] = useState<string | null>(null)
  const syncingRef = useRef(false)
  const activeSyncPromiseRef = useRef<Promise<void> | null>(null)
  const followUpSyncRequestedRef = useRef(false)
  const lastSuccessfulSyncAtRef = useRef<number>(0)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastStartupSyncUserRef = useRef<string | null>(null)

  const withTimeout = useCallback(function <T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    })

    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer)
    })
  }, [])

  const scheduleRetry = useCallback((callback: () => void) => {
    if (retryTimerRef.current) return
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null
      callback()
    }, 30000)
  }, [])

  const shouldRunFreshnessSync = useCallback((force = false) => {
    if (force) return true
    return Date.now() - lastSuccessfulSyncAtRef.current >= FRESHNESS_SYNC_THRESHOLD_MS
  }, [])

  const runRecoveryCheck = useCallback(async () => {
    const report = await runRecoveryDiagnostics(user?.id)
    setRecoveryReport(report)
    setRecoveryStatus(report.status)
    if (report.status === 'rebuild_cloud_required' || report.status === 'local_repair_required') {
      pauseSync('recovery')
    } else {
      resumeSync('recovery')
    }
  }, [user?.id])

  const rebuildCloudFromLocal = useCallback(async () => {
    if (!user?.id) return
    setRecoveryStatus('recovering')
    pauseSync('recovery')
    setSyncStatus('syncing')
    try {
      await withTimeout(clearUserCloudData(user.id), 30000)
      await withTimeout(migrateLocalToSupabase(user.id), 45000)
      await runRecoveryCheck()
      setSyncStatus('idle')
    } catch (error) {
      setSyncStatus('error')
      setRecoveryStatus('rebuild_cloud_required')
      throw error
    }
  }, [runRecoveryCheck, user?.id, withTimeout])

  const flushQueuedChanges = useCallback(
    async (userId: string): Promise<boolean> => {
      if (isSyncPaused()) return false
      const queue = await StorageService.getSyncQueue()
      if (queue.length === 0) {
        setSyncStatus('idle')
        return false
      }

      await withTimeout(flushSyncQueue(userId), 15000)
      return true
    },
    [withTimeout],
  )

  const runSyncNow = useCallback(
    async (userId: string, options: QueueSyncOptions) => {
      if (!supabase || !userId || isSyncPaused()) return
      if (syncingRef.current) return
      syncingRef.current = true
      setSyncStatus('syncing')
      debugLog('[sync] running', options.reason, options.mode ?? 'pull-and-flush')

      try {
        if (options.mode === 'flush-only') {
          await flushQueuedChanges(userId)
        } else if (options.mode === 'full-upload-after-pull') {
          await withTimeout(pullFromSupabase(userId), 30000)
          await withTimeout(migrateLocalToSupabase(userId), 45000)
          await flushQueuedChanges(userId)
        } else {
          await withTimeout(pullFromSupabase(userId), 30000)
          await flushQueuedChanges(userId)
        }

        await runRecoveryCheck()
        lastSuccessfulSyncAtRef.current = Date.now()
        setHasSynced(true)
        setSyncCount((c) => c + 1)
        setSyncStatus('idle')
        debugLog('[sync] complete', options.reason)
      } catch (error) {
        setSyncStatus('error')
        debugWarn('[sync] failed, will retry in 30s', options.reason)
        throw error
      } finally {
        syncingRef.current = false
      }
    },
    [flushQueuedChanges, runRecoveryCheck, withTimeout],
  )

  const queueSync = useCallback(
    async (options: QueueSyncOptions): Promise<void> => {
      if (!supabase || !user?.id || isSyncPaused()) return
      if (!options.force && !shouldRunFreshnessSync(options.reason === 'periodic')) return
      debugLog('[sync] queued', options.reason, options.mode ?? 'pull-and-flush')

      if (activeSyncPromiseRef.current) {
        followUpSyncRequestedRef.current = true
        debugLog('[sync] follow-up requested', options.reason)
        return activeSyncPromiseRef.current
      }

      const run = async () => {
        do {
          followUpSyncRequestedRef.current = false
          await runSyncNow(user.id, options)
        } while (followUpSyncRequestedRef.current && !isSyncPaused())
      }

      activeSyncPromiseRef.current = run().finally(() => {
        activeSyncPromiseRef.current = null
      })

      return activeSyncPromiseRef.current.catch((error) => {
        scheduleRetry(() => {
          if (supabase && user?.id) void queueSync({ reason: 'retry', mode: 'pull-and-flush', force: true })
        })
        throw error
      })
    },
    [runSyncNow, shouldRunFreshnessSync, scheduleRetry, user?.id],
  )

  const syncNow = useCallback(
    () => queueSync({ reason: 'manual', mode: 'pull-and-flush', force: true }),
    [queueSync],
  )

  // ─── Auth initialization — runs once on mount ──────────────────────────
  useEffect(() => {
    let mounted = true

    if (!supabase) {
      setLoading(false)
      return
    }

    async function initializeAuth() {
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession(), 10000)

        if (error) {
          console.error('[auth] Failed to restore Supabase session:', error)
        }

        if (!mounted) return

        debugLog('[auth] getSession result', {
          hasSession: Boolean(data.session),
          userId: data.session?.user?.id,
          error,
        })

        setUser(data.session?.user ?? null)
      } catch (error) {
        console.error('[auth] initialization failed:', error)

        if (!mounted) return

        setUser(null)
      } finally {
        if (mounted) {
          setLoading(false)
          debugLog('[auth] loading false')
        }
      }
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep this callback synchronous — no awaits, no supabase calls
      const nextUser = session?.user ?? null
      if (!nextUser) lastStartupSyncUserRef.current = null
      setUser(nextUser)
      setLoading(false)
      setAuthEvent(event)
      debugLog('[auth] state change', event, Boolean(session))
    })

    return () => {
      mounted = false
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withTimeout])

  // ─── Signed-in follow-up loading (outside onAuthStateChange) ───────────
  useEffect(() => {
    if (!user?.id) return
    if (isSyncPaused()) return
    // Prevent concurrent sync runs (e.g. Strict Mode double-invoke, rapid re-renders)
    if (syncingRef.current) {
      return
    }

    if (lastStartupSyncUserRef.current === user.id) return
    lastStartupSyncUserRef.current = user.id

    let cancelled = false

    async function loadSignedInData() {
      const isSignIn = authEvent === 'SIGNED_IN'

      try {
        if (isSignIn) {
          debugLog('[auth] SIGNED_IN — pulling cloud data first, then migrating local data')
          setSyncStatus('syncing')
          await queueSync({ reason: 'sign-in', mode: 'full-upload-after-pull', force: true })
          if (!cancelled) {
            setSyncStatus('idle')
          }
        } else {
          await queueSync({ reason: 'startup', mode: 'pull-and-flush', force: true })
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[auth] Failed to sync after sign-in:', error)
          setSyncStatus('error')
          lastStartupSyncUserRef.current = null
        }
      } finally {
        if (cancelled) {
          lastStartupSyncUserRef.current = null
        }
      }
    }

    loadSignedInData()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, queueSync])

  useEffect(() => {
    if (!user?.id || !supabase) return

    const maybePull = () => {
      if (document.visibilityState !== 'visible') return
      if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) return
      if (!shouldRunFreshnessSync()) return
      void queueSync({ reason: 'visible', mode: 'pull-and-flush' })
    }

    const intervalId = window.setInterval(maybePull, PERIODIC_PULL_INTERVAL_MS)
    window.addEventListener('focus', maybePull)
    window.addEventListener('online', maybePull)
    document.addEventListener('visibilitychange', maybePull)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', maybePull)
      window.removeEventListener('online', maybePull)
      document.removeEventListener('visibilitychange', maybePull)
    }
  }, [queueSync, shouldRunFreshnessSync, user?.id])

  useEffect(() => {
    if (authEvent !== 'TOKEN_REFRESHED') return
    void queueSync({ reason: 'token-refresh', mode: 'pull-and-flush', force: true })
  }, [authEvent, queueSync])

  const triggerSync = useCallback(() => {
    if (!supabase || !user || isSyncPaused()) return
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    flushTimerRef.current = setTimeout(async () => {
      try {
        await queueSync({ reason: 'local-change', mode: 'flush-only' })
      } catch {
        setSyncStatus('error')
        scheduleRetry(() => {
          if (supabase && user) triggerSync()
        })
      } finally {
        flushTimerRef.current = null
      }
    }, LOCAL_CHANGE_SYNC_DEBOUNCE_MS)
  }, [queueSync, scheduleRetry, user])

  const signOut = async () => {
    if (!supabase) return { error: null as AuthError | null }
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        syncStatus,
        hasSynced,
        syncCount,
        recoveryStatus,
        recoveryReport,
        runRecoveryCheck,
        rebuildCloudFromLocal,
        syncNow,
        triggerSync,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
