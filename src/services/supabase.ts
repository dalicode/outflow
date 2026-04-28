import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url: string | undefined = import.meta.env.VITE_SUPABASE_URL
const key: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('Supabase env vars missing — cloud sync disabled.')
}

// null when env vars absent so the rest of the app can guard with `if (supabase)`
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
