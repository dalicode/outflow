import type { AuthError, User } from '@supabase/supabase-js'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import { flushSyncQueue, migrateLocalToSupabase, pullFromSupabase } from '../services/syncService'
import type { SyncStatus } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  syncStatus: SyncStatus
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

  const runSync = useCallback(async (userId: string) => {
    if (!supabase || !userId) return
    setSyncStatus('syncing')
    try {
      await pullFromSupabase(userId)
      await flushSyncQueue(userId)
      setSyncStatus('idle')
    } catch {
      setSyncStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        setLoading(false)
        if (session?.user) runSync(session.user.id)
      })
      .catch((err: Error) => {
        console.warn('Auth session error:', err)
        setUser(null)
        setLoading(false)
      })

    let subscription = { unsubscribe: () => {} }
    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (event === 'SIGNED_IN' && u) {
          await migrateLocalToSupabase(u.id)
          await runSync(u.id)
        }
      })
      subscription = data.subscription
    } catch (err) {
      console.warn('Auth state change subscription error:', err)
    }

    return () => {
      subscription.unsubscribe()
    }
  }, [runSync])

  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerSync = useCallback(() => {
    if (!supabase || !user) return
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    setSyncStatus('syncing')
    flushTimerRef.current = setTimeout(async () => {
      try {
        await flushSyncQueue(user.id)
        setSyncStatus('idle')
      } catch {
        setSyncStatus('error')
      }
    }, 2000)
  }, [user])

  const signOut = async () => {
    if (!supabase) return { error: null as AuthError | null }
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, syncStatus, triggerSync, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
