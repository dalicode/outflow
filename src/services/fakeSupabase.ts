import type { AuthError, User } from '@supabase/supabase-js'

type FakeRow = Record<string, unknown>
type EqFilter = { column: string; value: unknown }
type InFilter = { column: string; values: unknown[] }
type OrderBy = { column: string; ascending: boolean }

type QueryPayload = {
  table: string
  operation: 'select' | 'upsert' | 'delete' | 'reset' | 'seed' | 'inspect'
  selectColumns?: string
  selectOptions?: { count?: 'exact'; head?: boolean }
  eqFilters?: EqFilter[]
  inFilters?: InFilter[]
  orderBy?: OrderBy
  range?: { from: number; to: number }
  upsertRows?: FakeRow[]
  onConflict?: string
}

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null }
type AuthChangeEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY'

type FakeSession = {
  user: User
}

type AuthListener = (event: AuthChangeEvent, session: FakeSession | null) => void

const FAKE_ENDPOINT = '/__fake_supabase__'
const DEV_FAKE_KEY = '__outflow_fake_supabase_auth__'

function readStoredSession(): FakeSession | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(DEV_FAKE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as FakeSession
  } catch {
    return null
  }
}

function writeStoredSession(session: FakeSession | null): void {
  if (typeof window === 'undefined') return
  if (!session) {
    window.localStorage.removeItem(DEV_FAKE_KEY)
    return
  }
  window.localStorage.setItem(DEV_FAKE_KEY, JSON.stringify(session))
}

function makeFakeUser(email: string): User {
  const normalizedEmail = email.trim().toLowerCase()
  return {
    id: `fake-user:${normalizedEmail}`,
    email,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  }
}

async function postQuery(payload: QueryPayload): Promise<QueryResult> {
  const response = await fetch(FAKE_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    return { data: null, error: { message: `Fake supabase request failed: ${response.status}` } }
  }
  return (await response.json()) as QueryResult
}

class FakeQueryBuilder {
  private readonly eqFilters: EqFilter[] = []
  private readonly inFilters: InFilter[] = []
  private orderBy: OrderBy | undefined
  private rangeArgs: { from: number; to: number } | undefined

  constructor(
    private readonly table: string,
    private readonly operation: 'select' | 'delete',
    private readonly selectColumns?: string,
    private readonly selectOptions?: { count?: 'exact'; head?: boolean },
  ) {}

  eq(column: string, value: unknown): FakeQueryBuilder {
    this.eqFilters.push({ column, value })
    return this
  }

  in(column: string, values: unknown[]): FakeQueryBuilder {
    this.inFilters.push({ column, values })
    return this
  }

  order(column: string, options?: { ascending?: boolean }): FakeQueryBuilder {
    this.orderBy = { column, ascending: options?.ascending !== false }
    return this
  }

  range(from: number, to: number): FakeQueryBuilder {
    this.rangeArgs = { from, to }
    return this
  }

  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable thenables.
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute(): Promise<QueryResult> {
    return postQuery({
      table: this.table,
      operation: this.operation,
      selectColumns: this.selectColumns,
      selectOptions: this.selectOptions,
      eqFilters: this.eqFilters,
      inFilters: this.inFilters,
      orderBy: this.orderBy,
      range: this.rangeArgs,
    })
  }
}

class FakeAuthApi {
  private session: FakeSession | null = readStoredSession()
  private listeners = new Set<AuthListener>()

  private emit(event: AuthChangeEvent): void {
    for (const listener of this.listeners) {
      listener(event, this.session)
    }
  }

  async getSession(): Promise<{ data: { session: FakeSession | null }; error: AuthError | null }> {
    return { data: { session: this.session }, error: null }
  }

  onAuthStateChange(callback: AuthListener): {
    data: { subscription: { unsubscribe: () => void } }
  } {
    this.listeners.add(callback)
    callback('INITIAL_SESSION', this.session)
    return {
      data: {
        subscription: {
          unsubscribe: () => this.listeners.delete(callback),
        },
      },
    }
  }

  async signInWithPassword({
    email,
  }: {
    email: string
    password: string
  }): Promise<{ data: { session: FakeSession; user: User }; error: null }> {
    this.session = { user: makeFakeUser(email) }
    writeStoredSession(this.session)
    this.emit('SIGNED_IN')
    return { data: { session: this.session, user: this.session.user }, error: null }
  }

  async signUp({
    email,
    password,
  }: {
    email: string
    password: string
  }): Promise<{ data: { session: FakeSession; user: User }; error: null }> {
    return this.signInWithPassword({ email, password })
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    this.session = null
    writeStoredSession(null)
    this.emit('SIGNED_OUT')
    return { error: null }
  }

  setSessionForTests(userId: string, email: string): void {
    this.session = { user: { ...makeFakeUser(email), id: userId } }
    writeStoredSession(this.session)
    this.emit('SIGNED_IN')
  }
}

class FakeSupabaseClient {
  auth = new FakeAuthApi()

  from(table: string): {
    select: (columns?: string, options?: { count?: 'exact'; head?: boolean }) => FakeQueryBuilder
    upsert: (rows: FakeRow[], options?: { onConflict?: string }) => Promise<QueryResult>
    delete: () => FakeQueryBuilder
  } {
    return {
      select: (columns = '*', options) => new FakeQueryBuilder(table, 'select', columns, options),
      upsert: (rows, options) =>
        postQuery({
          table,
          operation: 'upsert',
          upsertRows: rows,
          onConflict: options?.onConflict,
        }),
      delete: () => new FakeQueryBuilder(table, 'delete'),
    }
  }

  async resetFakeCloud(): Promise<void> {
    await postQuery({ table: '__all__', operation: 'reset' })
  }

  async seedFakeCloudExpenses(userId: string, expenses: FakeRow[]): Promise<void> {
    await postQuery({
      table: 'expenses',
      operation: 'seed',
      upsertRows: expenses.map((row) => ({ ...row, user_id: userId })),
    })
  }

  async inspectFakeCloudExpenses(userId: string): Promise<FakeRow[]> {
    const result = await postQuery({
      table: 'expenses',
      operation: 'inspect',
      eqFilters: [{ column: 'user_id', value: userId }],
    })
    return (result.data as FakeRow[]) ?? []
  }
}

export const fakeSupabase = new FakeSupabaseClient()
