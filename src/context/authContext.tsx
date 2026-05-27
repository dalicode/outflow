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
import { isIgnorableStartupSyncError, resolveStartupSyncReason } from './authSessionHelpers'
import { useAuthSessionLifecycle } from '../hooks/useAuthSessionLifecycle'
import { useSyncController, type QueueSyncOptions } from '../hooks/useSyncController'
import {
  runRecoveryDiagnostics,
  type RecoveryReport,
  type RecoveryStatus,
} from '../services/recoveryService'
import { supabase } from '../services/supabase'
import { isSyncPaused, pauseSync, resumeSync } from '../services/syncRuntime'
import { STALE_SYNC_RUN_MESSAGE } from '../services/sync/constants'
import { clearUserCloudData, migrateLocalToSupabase } from '../services/syncService'
import type { SyncStatus } from '../types'
import { debugLog } from '../lib/debug'
import { withTimeout } from '../lib/withTimeout'

const shouldBypassRecoveryPause =
  import.meta.env.DEV && import.meta.env.VITE_E2E_FAKE_SUPABASE === '1'

interface AuthContextValue {
  user: User | null
  loading: boolean
  syncStatus: SyncStatus
  hasSynced: boolean
  syncCount: number
  pullAppliedCount: number
  recoveryStatus: RecoveryStatus | 'recovering'
  recoveryReport: RecoveryReport | null
  runRecoveryCheck: () => Promise<void>
  rebuildCloudFromLocal: () => Promise<void>
  syncNow: () => Promise<void>
  syncLocalThenPull: () => Promise<void>
  syncLocalChanges: () => Promise<void>
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
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus | 'recovering'>('healthy')
  const [recoveryReport, setRecoveryReport] = useState<RecoveryReport | null>(null)
  const [authEvent, setAuthEvent] = useState<string | null>(null)
  const authEventRef = useRef<string | null>(null)
  const currentUserRef = useRef<User | null>(null)
  const lastStartupSyncUserRef = useRef<string | null>(null)

  useEffect(() => {
    authEventRef.current = authEvent
  }, [authEvent])

  useEffect(() => {
    currentUserRef.current = user
  }, [user])

  const runRecoveryCheck = useCallback(async () => {
    const report = await runRecoveryDiagnostics(user?.id)
    setRecoveryReport(report)
    setRecoveryStatus(report.status)
    if (shouldBypassRecoveryPause) {
      resumeSync('recovery')
    } else if (
      report.status === 'rebuild_cloud_required' ||
      report.status === 'local_repair_required'
    ) {
      pauseSync('recovery')
    } else {
      resumeSync('recovery')
    }
  }, [user?.id])

  const {
    syncStatus,
    hasSynced,
    syncCount,
    pullAppliedCount,
    queueSync,
    syncNow,
    syncLocalThenPull,
    syncLocalChanges,
    triggerSync,
    clearSyncTimers,
    invalidateSyncRun,
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
      await withTimeout(
        migrateLocalToSupabase(user.id, { ignorePause: true, forceUploadAll: true }),
        45000,
      )
      await runRecoveryCheck()
      setExternalSyncStatus('idle')
    } catch (error) {
      setExternalSyncStatus('error')
      setRecoveryStatus('rebuild_cloud_required')
      throw error
    }
  }, [runRecoveryCheck, setExternalSyncStatus, user?.id])

  useAuthSessionLifecycle({
    currentUserRef,
    lastStartupSyncUserRef,
    clearSyncTimers,
    invalidateSyncRun,
    setUser,
    setLoading,
    setAuthEvent,
  })

  // ─── Signed-in startup trigger (outside onAuthStateChange) ───────────
  useEffect(() => {
    if (!user?.id) return
    if (isSyncPaused()) return
    if (lastStartupSyncUserRef.current === user.id) return
    lastStartupSyncUserRef.current = user.id

    let cancelled = false

    async function queueStartupSync() {
      const startupReason = resolveStartupSyncReason(authEventRef.current)
      const isSignIn = startupReason === 'sign-in'
      const options: QueueSyncOptions = { reason: startupReason, force: true }

      try {
        if (isSignIn) {
          debugLog('[auth] SIGNED_IN — running pull-then-upload startup sync')
        }
        await queueSync(options)
      } catch (error) {
        if (!cancelled) {
          if (
            isIgnorableStartupSyncError(
              error,
              typeof navigator !== 'undefined' && 'onLine' in navigator ? !navigator.onLine : false,
              STALE_SYNC_RUN_MESSAGE,
            )
          ) {
            debugLog('[auth] Ignoring startup sync interruption', error)
            return
          }
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
    void queueSync({ reason: 'token-refresh' })
  }, [authEvent, queueSync])

  const signOut = async () => {
    if (!supabase) return { error: null as AuthError | null }
    invalidateSyncRun()
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
        pullAppliedCount,
        recoveryStatus,
        recoveryReport,
        runRecoveryCheck,
        rebuildCloudFromLocal,
        syncNow,
        syncLocalThenPull,
        syncLocalChanges,
        triggerSync,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
