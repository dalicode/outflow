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
import { supabase } from '../services/supabase'
import { flushSyncQueue, migrateLocalToSupabase, pullFromSupabase } from '../services/syncService'
import type { SyncStatus } from '../types'
import { debugLog, debugWarn } from '../utils/debug'

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

  const withTimeout = useCallback(function <T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
      ),
    ])
  }, [])

  const doPullAndFlush = useCallback(
    async (userId: string) => {
      if (!supabase || !userId || syncingRef.current) return
      syncingRef.current = true
      setSyncStatus('syncing')
      try {
        debugLog('[sync] pull + flush starting')
        await withTimeout(pullFromSupabase(userId), 30000)
        await withTimeout(flushSyncQueue(userId), 15000)
        setSyncStatus('idle')
        setHasSynced(true)
        setSyncCount((c) => c + 1)
        console.log('[sync] complete')
      } catch {
        setSyncStatus('error')
        console.warn('[sync] failed, will retry in 30s')
        setTimeout(() => {
          if (supabase && userId) doPullAndFlush(userId)
        }, 30000)
      } finally {
        syncingRef.current = false
      }
    },
    [withTimeout],
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
        const { data, error } = await supabase.auth.getSession()

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
      setUser(session?.user ?? null)
      setLoading(false)
      setAuthEvent(event)
      debugLog('[auth] state change', event, Boolean(session))
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Signed-in follow-up loading (outside onAuthStateChange) ───────────
  useEffect(() => {
    if (!user?.id) return
    // Prevent concurrent sync runs (e.g. Strict Mode double-invoke, rapid re-renders)
    if (syncingRef.current) return

    let cancelled = false

    async function loadSignedInData() {
      // On SIGNED_IN: push local data, then pull+flush
      // On page refresh (existing session): just pull+flush
      const isSignIn = authEvent === 'SIGNED_IN'

      try {
        if (isSignIn) {
          debugLog('[auth] SIGNED_IN — pulling cloud data first, then migrating local data')
          syncingRef.current = true
          await withTimeout(pullFromSupabase(user.id), 30000)
          await withTimeout(migrateLocalToSupabase(user.id), 30000)
          await withTimeout(flushSyncQueue(user.id), 15000)
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
        }
      } finally {
        syncingRef.current = false
      }
    }

    loadSignedInData()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authEvent, doPullAndFlush, withTimeout])

  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerSync = useCallback(() => {
    if (!supabase || !user) return
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    setSyncStatus('syncing')
    flushTimerRef.current = setTimeout(async () => {
      try {
        await withTimeout(flushSyncQueue(user.id), 15000)
        setSyncStatus('idle')
      } catch {
        setSyncStatus('error')
        if (!retryTimerRef.current) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null
            if (supabase && user) triggerSync()
          }, 30000)
        }
      }
    }, 500)
  }, [user, withTimeout])

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
