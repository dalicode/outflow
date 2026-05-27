import type { User } from '@supabase/supabase-js'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useEffect } from 'react'
import { shouldInvalidateSyncRunOnAuthTransition } from '../context/authSessionHelpers'
import { debugLog } from '../lib/debug'
import { withTimeout } from '../lib/withTimeout'
import { supabase } from '../services/supabase'

interface UseAuthSessionLifecycleParams {
  currentUserRef: MutableRefObject<User | null>
  lastStartupSyncUserRef: MutableRefObject<string | null>
  clearSyncTimers: () => void
  invalidateSyncRun: () => void
  setUser: Dispatch<SetStateAction<User | null>>
  setLoading: Dispatch<SetStateAction<boolean>>
  setAuthEvent: Dispatch<SetStateAction<string | null>>
}

export function useAuthSessionLifecycle({
  currentUserRef,
  lastStartupSyncUserRef,
  clearSyncTimers,
  invalidateSyncRun,
  setUser,
  setLoading,
  setAuthEvent,
}: UseAuthSessionLifecycleParams): void {
  useEffect(() => {
    let mounted = true

    if (!supabase) {
      setLoading(false)
      return
    }

    const supabaseClient = supabase

    async function initializeAuth(): Promise<void> {
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

    void initializeAuth()

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event, session) => {
      // Keep this callback synchronous — no awaits, no supabase calls.
      const previousUserId = currentUserRef.current?.id ?? null
      const nextUser = session?.user ?? null
      const nextUserId = nextUser?.id ?? null

      if (shouldInvalidateSyncRunOnAuthTransition(previousUserId, nextUserId)) {
        invalidateSyncRun()
      }

      currentUserRef.current = nextUser
      if (!nextUser) lastStartupSyncUserRef.current = null
      setUser(nextUser)
      setLoading(false)
      setAuthEvent(event)
      debugLog('[auth] state change', event, Boolean(session))
    })

    return () => {
      mounted = false
      clearSyncTimers()
      subscription.unsubscribe()
    }
  }, [
    clearSyncTimers,
    currentUserRef,
    invalidateSyncRun,
    lastStartupSyncUserRef,
    setAuthEvent,
    setLoading,
    setUser,
  ])
}
