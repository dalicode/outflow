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
import { useSyncController, type QueueSyncOptions } from '../hooks/useSyncController'
import {
  runRecoveryDiagnostics,
  type RecoveryReport,
  type RecoveryStatus,
} from '../services/recoveryService'
import { supabase } from '../services/supabase'
import { isSyncPaused, pauseSync, resumeSync } from '../services/syncRuntime'
import { clearUserCloudData, migrateLocalToSupabase } from '../services/syncService'
import type { SyncStatus } from '../types'
import { debugLog } from '../utils/debug'
import { withTimeout } from '../utils/withTimeout'

interface AuthContextValue {
  user: User | null
  loading: boolean
  lastSignInAt: number | null
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
  const [lastSignInAt, setLastSignInAt] = useState<number | null>(null)
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus | 'recovering'>('healthy')
  const [recoveryReport, setRecoveryReport] = useState<RecoveryReport | null>(null)
  const [authEvent, setAuthEvent] = useState<string | null>(null)
  const authEventRef = useRef<string | null>(null)
  const lastStartupSyncUserRef = useRef<string | null>(null)

  useEffect(() => {
    authEventRef.current = authEvent
  }, [authEvent])

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

  const {
    syncStatus,
    hasSynced,
    syncCount,
    queueSync,
    syncNow,
    triggerSync,
    clearSyncTimers,
    setExternalSyncStatus,
  } = useSyncController({
    userId: supabase ? user?.id : undefined,
    runRecoveryCheck,
  })

  const rebuildCloudFromLocal = useCallback(async () => {
    if (!user?.id) return
    setRecoveryStatus('recovering')
    pauseSync('recovery')
    setExternalSyncStatus('syncing')
    try {
      await withTimeout(clearUserCloudData(user.id), 30000)
      await withTimeout(migrateLocalToSupabase(user.id, { ignorePause: true }), 45000)
      await runRecoveryCheck()
      setExternalSyncStatus('idle')
    } catch (error) {
      setExternalSyncStatus('error')
      setRecoveryStatus('rebuild_cloud_required')
      throw error
    }
  }, [runRecoveryCheck, setExternalSyncStatus, user?.id])

  // ─── Auth initialization — runs once on mount ──────────────────────────
  useEffect(() => {
    let mounted = true

    if (!supabase) {
      setLoading(false)
      return
    }

    const supabaseClient = supabase

    async function initializeAuth() {
      try {
        const { data, error } = await withTimeout(supabaseClient.auth.getSession(), 10000)

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
    } = supabaseClient.auth.onAuthStateChange((event, session) => {
      // Keep this callback synchronous — no awaits, no supabase calls
      const nextUser = session?.user ?? null
      if (!nextUser) lastStartupSyncUserRef.current = null
      setUser(nextUser)
      setLoading(false)
      setAuthEvent(event)
      if (event === 'SIGNED_IN' && nextUser) {
        setLastSignInAt(Date.now())
      }
      debugLog('[auth] state change', event, Boolean(session))
    })

    return () => {
      mounted = false
      clearSyncTimers()
      subscription.unsubscribe()
    }
  }, [clearSyncTimers])

  // ─── Signed-in startup trigger (outside onAuthStateChange) ───────────
  useEffect(() => {
    if (!user?.id) return
    if (isSyncPaused()) return
    if (lastStartupSyncUserRef.current === user.id) return
    lastStartupSyncUserRef.current = user.id

    let cancelled = false

    async function queueStartupSync() {
      const isSignIn = authEventRef.current === 'SIGNED_IN'
      const options: QueueSyncOptions = isSignIn
        ? { reason: 'sign-in', mode: 'full-upload-after-pull', force: true }
        : { reason: 'startup', mode: 'pull-and-flush', force: true }

      try {
        if (isSignIn) {
          debugLog('[auth] SIGNED_IN — pulling cloud data first, then migrating local data')
        }
        await queueSync(options)
      } catch (error) {
        if (!cancelled) {
          console.error('[auth] Failed to sync after sign-in:', error)
          setExternalSyncStatus('error')
          lastStartupSyncUserRef.current = null
        }
      } finally {
        if (cancelled) {
          lastStartupSyncUserRef.current = null
        }
      }
    }

    queueStartupSync()

    return () => {
      cancelled = true
    }
  }, [queueSync, setExternalSyncStatus, user?.id])

  useEffect(() => {
    if (authEvent !== 'TOKEN_REFRESHED') return
    void queueSync({ reason: 'token-refresh', mode: 'pull-and-flush' })
  }, [authEvent, queueSync])

  const signOut = async () => {
    if (!supabase) return { error: null as AuthError | null }
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        lastSignInAt,
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
