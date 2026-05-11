import { beforeEach, describe, expect, it, vi } from 'vitest'

// Use vi.hoisted so the mock factory can access these arrays
const stored = vi.hoisted(() => ({
  expenses: [] as unknown[],
  categories: [] as unknown[],
  payees: [] as unknown[],
  fixedExpenses: [] as unknown[],
  fixedExpenseSnapshots: [] as unknown[],
  incomeSnapshots: [] as unknown[],
  savingsSnapshots: [] as unknown[],
  schedules: [] as unknown[],
  categoryMergeHistory: [] as unknown[],
  payeeMergeHistory: [] as unknown[],
  settings: [] as Array<{ key: string; value: unknown }>,
}))

vi.mock('../services/storageService', () => ({
  StorageService: {
    bulkUpsertExpenses: vi.fn((data: unknown[]) => { stored.expenses = data }),
    bulkUpsertCategories: vi.fn((data: unknown[]) => { stored.categories = data }),
    bulkUpsertPayees: vi.fn((data: unknown[]) => { stored.payees = data }),
    bulkUpsertFixedExpenses: vi.fn((data: unknown[]) => { stored.fixedExpenses = data }),
    bulkUpsertSnapshots: vi.fn((data: unknown[]) => { stored.fixedExpenseSnapshots = data }),
    bulkUpsertIncomeSnapshots: vi.fn((data: unknown[]) => { stored.incomeSnapshots = data }),
    bulkUpsertSavingsSnapshots: vi.fn((data: unknown[]) => { stored.savingsSnapshots = data }),
    setSetting: vi.fn((key: string, value: unknown) => { stored.settings.push({ key, value }) }),
    db: {
      schedules: { bulkPut: vi.fn((data: unknown[]) => { stored.schedules = data }) },
      categoryMergeHistory: { bulkPut: vi.fn((data: unknown[]) => { stored.categoryMergeHistory = data }) },
      payeeMergeHistory: { bulkPut: vi.fn((data: unknown[]) => { stored.payeeMergeHistory = data }) },
      settings: { put: vi.fn((data: Record<string, unknown>) => { stored.settings.push({ key: String(data.key), value: data.value }) }) },
    },
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
    Object.values(stored).forEach((arr: unknown[] | Array<{key:string;value:unknown}>) => {
      if (Array.isArray(arr)) arr.length = 0
    })

    supabaseSelect.mockReset()
    supabaseSelect.mockImplementation((table: string) => {
      if (table === 'expenses') {
        return makeQuery([
          { id: '101', date: '2026-05-05', category_id: '12', payee_id: '42', description: 'Lunch', amount: 18.5 },
        ])
      }
      if (table === 'categories') {
        return makeQuery([{ id: '12', name: 'Food', is_archived: false }])
      }
      if (table === 'payees') {
        return makeQuery([{ id: '42', name: 'Cafe', is_archived: false }])
      }
      if (table === 'fixed_expenses') {
        return makeQuery([{ id: '7', name: 'Rent', amount: 1500 }])
      }
      if (table === 'fixed_expense_snapshots') {
        return makeQuery([{
          id: '88', fixed_expense_id: '7', name_snapshot: 'Rent',
          amount_snapshot: 1500, month: 5, year: 2026,
          created_at: '2026-05-01T00:00:00.000Z',
        }])
      }
      if (table === 'settings') {
        return makeQuery([
          { key: 'monthlyIncome', value: '5000' },
          { key: 'scheduleMaterializationLog', value: '[]' },
        ])
      }
      if (table === 'income_snapshots') {
        return makeQuery([{
          id: '200', year: 2026, month: 5,
          amount_snapshot: 5000, created_at: '2026-05-01T00:00:00.000Z',
        }])
      }
      if (table === 'savings_snapshots') {
        return makeQuery([{
          id: '201', year: 2026, month: 5,
          rate_snapshot: 0.2, created_at: '2026-05-01T00:00:00.000Z',
        }])
      }
      if (table === 'schedules') {
        return makeQuery([{
          id: '300', type: 'income', target_id: null,
          effective_year: 2026, effective_month: 6, new_value: 5500,
          previous_value: 5000, materialized_at: '2026-06-01T00:00:00.000Z',
          is_active: false, note: null, created_at: '2026-05-10T00:00:00.000Z',
          day: null, category_id: null, payee_id: null,
        }])
      }
      if (table === 'category_merge_history') {
        return makeQuery([{
          id: '400', source_category_id: '12', target_category_id: '13',
          affected_expense_ids: ['101', '102'],
          created_at: '2026-05-02T00:00:00.000Z', reverted_at: null,
        }])
      }
      if (table === 'payee_merge_history') {
        return makeQuery([{
          id: '401', source_payee_id: '42', target_payee_id: '43',
          affected_expense_ids: ['101'],
          created_at: '2026-05-03T00:00:00.000Z', reverted_at: null,
        }])
      }
      return makeQuery([])
    })
  })

  it('normalizes cloud string ids to local numeric ids in stored data', async () => {
    await pullFromSupabase('user-1')

    // Expense: cloud id '101' → local id 101, foreign keys normalized
    const expense = stored.expenses[0] as Record<string, unknown>
    expect(expense.id).toBe(101)
    expect(expense.categoryId).toBe(12)
    expect(expense.payeeId).toBe(42)
    expect(expense.description).toBe('Lunch')
    expect(expense.amount).toBe(18.5)

    // Category: id normalized
    const category = stored.categories[0] as Record<string, unknown>
    expect(category.id).toBe(12)
    expect(category.name).toBe('Food')

    // Payee: id normalized
    const payee = stored.payees[0] as Record<string, unknown>
    expect(payee.id).toBe(42)
    expect(payee.name).toBe('Cafe')

    // Fixed expense + snapshot: ids normalized
    const fixed = stored.fixedExpenses[0] as Record<string, unknown>
    expect(fixed.id).toBe(7)

    const snapshot = stored.fixedExpenseSnapshots[0] as Record<string, unknown>
    expect(snapshot.id).toBe(88)
    expect(snapshot.fixedExpenseId).toBe(7)

    // Income snapshot: fields normalized
    const income = stored.incomeSnapshots[0] as Record<string, unknown>
    expect(income.id).toBe(200)
    expect(income.year).toBe(2026)
    expect(income.month).toBe(5)
    expect(income.amountSnapshot).toBe(5000)

    // Savings snapshot: rate preserved
    const savings = stored.savingsSnapshots[0] as Record<string, unknown>
    expect(savings.id).toBe(201)
    expect(savings.rateSnapshot).toBe(0.2)

    // Schedule: archived (isActive=0)
    const schedule = stored.schedules[0] as Record<string, unknown>
    expect(schedule.id).toBe(300)
    expect(schedule.isActive).toBe(0)

    // Category merge history: foreign keys normalized
    const catMerge = stored.categoryMergeHistory[0] as Record<string, unknown>
    expect(catMerge.id).toBe(400)
    expect(catMerge.sourceCategoryId).toBe(12)
    expect(catMerge.affectedExpenseIds).toEqual([101, 102])

    // Settings: key-value preserved
    const incomeSetting = stored.settings.find((s: { key: string }) => s.key === 'monthlyIncome')
    expect(incomeSetting?.value).toBe(5000)
  })
})
