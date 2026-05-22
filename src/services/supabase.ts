import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fakeSupabase } from './fakeSupabase'

export type SupabaseLikeClient = SupabaseClient | typeof fakeSupabase

const url: string | undefined = import.meta.env.VITE_SUPABASE_URL
const key: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY
const shouldUseFakeSupabase = import.meta.env.DEV && import.meta.env.VITE_E2E_FAKE_SUPABASE === '1'

if (!url || !key) {
  console.warn('Supabase env vars missing — cloud sync disabled.')
}

// null when env vars absent so the rest of the app can guard with `if (supabase)`
export const supabase: SupabaseLikeClient | null =
  shouldUseFakeSupabase
    ? fakeSupabase
    : url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null
