import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('Supabase env vars missing — cloud sync disabled.')
}

// null when env vars absent so the rest of the app can guard with `if (supabase)`
export const supabase = url && key ? createClient(url, key) : null
