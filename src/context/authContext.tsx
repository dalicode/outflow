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
import { supabase } from '../services/supabase'
import { flushSyncQueue, migrateLocalToSupabase, pullFromSupabase } from '../services/syncService'
import type { SyncStatus } from '../types'
import { debugLog } from '../utils/debug'

interface AuthContextValue {
  user: User | null
  loading: boolean
  syncStatus: SyncStatus
  hasSynced: boolean
  syncCount: number
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
  const [authEvent, setAuthEvent] = useState<string | null>(null)
  const syncingRef = useRef(false)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncingWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  const flushQueuedChanges = useCallback(
    async (userId: string): Promise<boolean> => {
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

  const doPullAndFlush = useCallback(
    async (userId: string) => {
      if (!supabase || !userId || syncingRef.current) return
      syncingRef.current = true
      let pulled = false
      setSyncStatus('syncing')
      try {
        debugLog('[sync] pull + flush starting')
        await withTimeout(pullFromSupabase(userId), 30000)
        pulled = true
        await flushQueuedChanges(userId)
        setSyncStatus('idle')
        setHasSynced(true)
        setSyncCount((c) => c + 1)
        console.log('[sync] complete')
      } catch {
        if (pulled) setSyncCount((c) => c + 1)
        setSyncStatus('error')
        console.warn('[sync] failed, will retry in 30s')
        scheduleRetry(() => {
          if (supabase && userId) void doPullAndFlush(userId)
        })
      } finally {
        syncingRef.current = false
      }
    },
    [flushQueuedChanges, scheduleRetry, withTimeout],
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
      if (syncingWatchdogRef.current) {
        clearTimeout(syncingWatchdogRef.current)
        syncingWatchdogRef.current = null
      }
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

  useEffect(() => {
    if (syncingWatchdogRef.current) {
      clearTimeout(syncingWatchdogRef.current)
      syncingWatchdogRef.current = null
    }

    if (syncStatus !== 'syncing') return

    syncingWatchdogRef.current = setTimeout(() => {
      const hasPendingFlush = flushTimerRef.current != null
      const hasRetryScheduled = retryTimerRef.current != null
      const isActuallySyncing = syncingRef.current || hasPendingFlush

      if (!isActuallySyncing && !hasRetryScheduled) {
        setSyncStatus('idle')
      }
    }, 1000)

    return () => {
      if (syncingWatchdogRef.current) {
        clearTimeout(syncingWatchdogRef.current)
        syncingWatchdogRef.current = null
      }
    }
  }, [syncStatus])

  // ─── Signed-in follow-up loading (outside onAuthStateChange) ───────────
  useEffect(() => {
    if (!user?.id) return
    // Prevent concurrent sync runs (e.g. Strict Mode double-invoke, rapid re-renders)
    if (syncingRef.current) {
      return
    }

    if (lastStartupSyncUserRef.current === user.id) return
    lastStartupSyncUserRef.current = user.id

    let cancelled = false

    async function loadSignedInData() {
      // On SIGNED_IN: push local data, then pull+flush
      // On page refresh (existing session): just pull+flush
      const isSignIn = authEvent === 'SIGNED_IN'
      let pulled = false

      try {
        if (isSignIn) {
          debugLog('[auth] SIGNED_IN — pulling cloud data first, then migrating local data')
          syncingRef.current = true
          setSyncStatus('syncing')
          await withTimeout(pullFromSupabase(user.id), 30000)
          pulled = true
          await withTimeout(migrateLocalToSupabase(user.id), 30000)
          await flushQueuedChanges(user.id)
          if (!cancelled) {
            setSyncStatus('idle')
            setHasSynced(true)
            setSyncCount((c) => c + 1)
          }
        } else {
          await doPullAndFlush(user.id)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[auth] Failed to sync after sign-in:', error)
          if (pulled) setSyncCount((c) => c + 1)
          setSyncStatus('error')
          lastStartupSyncUserRef.current = null
          scheduleRetry(() => {
            if (supabase && user?.id) void doPullAndFlush(user.id)
          })
        }
      } finally {
        syncingRef.current = false
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
  }, [user?.id, authEvent, doPullAndFlush, flushQueuedChanges, withTimeout])

  const triggerSync = useCallback(() => {
    if (!supabase || !user) return
    if (syncingRef.current) return
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    flushTimerRef.current = setTimeout(async () => {
      try {
        setSyncStatus('syncing')
        await flushQueuedChanges(user.id)
        setSyncStatus('idle')
      } catch {
        setSyncStatus('error')
        scheduleRetry(() => {
          if (supabase && user) triggerSync()
        })
      } finally {
        flushTimerRef.current = null
      }
    }, 500)
  }, [flushQueuedChanges, scheduleRetry, user])

  const signOut = async () => {
    if (!supabase) return { error: null as AuthError | null }
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, syncStatus, hasSynced, syncCount, triggerSync, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}
