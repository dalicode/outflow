import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const REQUIRED_KEYS = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const

const USER_SYNC_TABLES = [
  'expenses',
  'category_merge_history',
  'payee_merge_history',
  'schedules',
  'fixed_expense_snapshots',
  'income_snapshots',
  'savings_snapshots',
  'fixed_expenses',
  'categories',
  'payees',
  'settings',
] as const

export interface LiveSupabaseTestUser {
  id: string
  email: string
  password: string
}

function requireEnv(name: (typeof REQUIRED_KEYS)[number]): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`[live-supabase-admin] Missing required env var: ${name}`)
  }
  return value
}

function getAdminClient(): SupabaseClient {
  const url = requireEnv('VITE_SUPABASE_URL')
  const serviceRole = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function uniqueTag(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function createLiveSupabaseUser(): Promise<LiveSupabaseTestUser> {
  const admin = getAdminClient()
  const tag = uniqueTag()
  const email = `outflow-e2e-${tag}@example.com`
  const password = `OutflowE2E!${tag}`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`[live-supabase-admin] Failed to create user: ${error?.message ?? 'unknown'}`)
  }

  return { id: data.user.id, email, password }
}

export async function deleteLiveSupabaseUser(userId: string): Promise<void> {
  const admin = getAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error && !error.message.toLowerCase().includes('not found')) {
    throw new Error(`[live-supabase-admin] Failed to delete user: ${error.message}`)
  }
}

export async function clearLiveSupabaseUserDataByAdmin(userId: string): Promise<void> {
  const admin = getAdminClient()

  for (const table of USER_SYNC_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', userId)
    if (error) {
      throw new Error(`[live-supabase-admin] Failed to clear ${table}: ${error.message}`)
    }
  }
}
