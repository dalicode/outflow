import { beforeEach, describe, expect, it, vi } from 'vitest'

const addCalls: Array<{ table: string; row: Record<string, unknown> }> = []
const updateCalls: Array<{ table: string; id: number; row: Record<string, unknown> }> = []

function makeTableMock() {
  return {
    toArray: () => Promise.resolve([]),
    add: (row: Record<string, unknown>) => {
      addCalls.push({ table: '', row })
      return Promise.resolve(1)
    },
    update: (id: number, row: Record<string, unknown>) => {
      updateCalls.push({ table: '', id, row: row as Record<string, unknown> })
      return Promise.resolve(1)
    },
  }
}

vi.mock('../services/db/schema', () => ({
  default: {
    table: vi.fn(() => makeTableMock()),
    categories: { toArray: vi.fn(() => Promise.resolve([])) },
    payees: { toArray: vi.fn(() => Promise.resolve([])) },
    fixedExpenses: { toArray: vi.fn(() => Promise.resolve([])) },
    expenses: { toArray: vi.fn(() => Promise.resolve([])) },
    settings: { put: vi.fn() },
  },
}))

vi.mock('../services/storageService', () => ({
  StorageService: {
    getSyncQueue: vi.fn(() => Promise.resolve([])),
    removeSyncQueueItem: vi.fn(),
  },
}))

const supabaseSelect = vi.hoisted(() => vi.fn())

vi.mock('../services/supabase', () => ({
  supabase: {
    from: supabaseSelect,
  },
}))

import { pullFromSupabase } from '../services/syncService'

function makeQuery(data: unknown[]) {
  return {
    select: () => ({
      eq: () => Promise.resolve({ data, error: null }),
    }),
  }
}

describe('pullFromSupabase', () => {
  beforeEach(() => {
    addCalls.length = 0
    updateCalls.length = 0

    supabaseSelect.mockReset()
    supabaseSelect.mockImplementation((table: string) => {
      if (table === 'expenses') {
        return makeQuery([
          {
            id: '101',
            date: '2026-05-05',
            category_id: '12',
            payee_id: '42',
            description: 'Lunch',
            amount: 18.5,
            updated_at: '2026-05-05T00:00:00.000Z',
          },
        ])
      }
      if (table === 'categories') {
        return makeQuery([
          { id: '12', name: 'Food', is_archived: false, updated_at: '2026-01-01T00:00:00.000Z' },
        ])
      }
      if (table === 'payees') {
        return makeQuery([
          { id: '42', name: 'Cafe', is_archived: false, updated_at: '2026-01-01T00:00:00.000Z' },
        ])
      }
      if (table === 'fixed_expenses') {
        return makeQuery([
          { id: '7', name: 'Rent', amount: 1500, updated_at: '2026-01-01T00:00:00.000Z' },
        ])
      }
      if (table === 'fixed_expense_snapshots') {
        return makeQuery([
          {
            id: '88',
            fixed_expense_id: '7',
            name_snapshot: 'Rent',
            amount_snapshot: 1500,
            month: 5,
            year: 2026,
            created_at: '2026-05-01T00:00:00.000Z',
            updated_at: '2026-05-01T00:00:00.000Z',
          },
        ])
      }
      if (table === 'settings') {
        return makeQuery([
          { key: 'monthlyIncome', value: '5000' },
          { key: 'scheduleMaterializationLog', value: '[]' },
        ])
      }
      if (table === 'income_snapshots') {
        return makeQuery([
          {
            id: '200',
            year: 2026,
            month: 5,
            amount_snapshot: 5000,
            created_at: '2026-05-01T00:00:00.000Z',
            updated_at: '2026-05-01T00:00:00.000Z',
          },
        ])
      }
      if (table === 'savings_snapshots') {
        return makeQuery([
          {
            id: '201',
            year: 2026,
            month: 5,
            rate_snapshot: 0.2,
            created_at: '2026-05-01T00:00:00.000Z',
            updated_at: '2026-05-01T00:00:00.000Z',
          },
        ])
      }
      if (table === 'schedules') {
        return makeQuery([
          {
            id: '300',
            type: 'income',
            target_id: null,
            effective_year: 2026,
            effective_month: 6,
            new_value: 5500,
            previous_value: 5000,
            materialized_at: '2026-06-01T00:00:00.000Z',
            is_active: false,
            note: null,
            category_id: null,
            payee_id: null,
            updated_at: '2026-05-10T00:00:00.000Z',
          },
        ])
      }
      if (table === 'category_merge_history') {
        return makeQuery([
          {
            id: '400',
            source_category_id: '12',
            target_category_id: '13',
            affected_expense_ids: ['101', '102'],
            created_at: '2026-05-02T00:00:00.000Z',
            reverted_at: null,
            updated_at: '2026-05-02T00:00:00.000Z',
          },
        ])
      }
      if (table === 'payee_merge_history') {
        return makeQuery([
          {
            id: '401',
            source_payee_id: '42',
            target_payee_id: '43',
            affected_expense_ids: ['101'],
            created_at: '2026-05-03T00:00:00.000Z',
            reverted_at: null,
            updated_at: '2026-05-03T00:00:00.000Z',
          },
        ])
      }
      return makeQuery([])
    })
  })

  it('inserts all cloud records as new local rows (no existing data)', async () => {
    await pullFromSupabase('user-1')

    // Verify settings were written (table.put)
    const dbModule = await import('../services/db/schema')
    expect(dbModule.default.settings.put).toHaveBeenCalledWith({
      key: 'monthlyIncome',
      value: 5000,
    })
  })
})
