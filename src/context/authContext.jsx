import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { flushSyncQueue, pullFromSupabase, migrateLocalToSupabase } from '../services/syncService'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// Sync status: 'idle' | 'syncing' | 'offline' | 'error'
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState('idle')

  const runSync = useCallback(async (userId) => {
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
    if (!supabase) { setLoading(false); return }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) runSync(session.user.id)
    }).catch((err) => {
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
          // First login: migrate any existing local data up
          await migrateLocalToSupabase(u.id)
          await runSync(u.id)
        }
      })
      subscription = data.subscription
    } catch (err) {
      console.warn('Auth state change subscription error:', err)
    }

    // Flush queue when coming back online
    const handleOnline = () => {
      if (user) runSync(user.id)
      else setSyncStatus('idle')
    }
    const handleOffline = () => setSyncStatus('offline')
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Debounced manual sync trigger (called after writes)
  let flushTimer = null
  const triggerSync = useCallback(() => {
    if (!supabase || !user) return
    clearTimeout(flushTimer)
    flushTimer = setTimeout(() => flushSyncQueue(user.id), 2000)
  }, [user])

  const signOut = () => supabase?.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, syncStatus, triggerSync, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
