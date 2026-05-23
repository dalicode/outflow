import { describe, expect, it } from 'vitest'
import { fromCloud, toCloud } from '../services/sync/conversion'

describe('sync conversion archivedAt removal', () => {
  it('does not include archived_at when converting categories/payees/fixedExpenses to cloud rows', () => {
    const categoryRow = toCloud('categories', { name: 'Food', isArchived: true }, 'user-1')
    const payeeRow = toCloud('payees', { name: 'Cafe', isArchived: true }, 'user-1')
    const fixedExpenseRow = toCloud(
      'fixedExpenses',
      { name: 'Rent', amount: 1200, isArchived: true },
      'user-1',
    )

    expect('archived_at' in categoryRow).toBe(false)
    expect('archived_at' in payeeRow).toBe(false)
    expect('archived_at' in fixedExpenseRow).toBe(false)
  })

  it('does not read archived_at into local category/payee/fixed expense records', () => {
    const category = fromCloud('categories', {
      id: '1',
      local_id: 'local-cat',
      name: 'Food',
      is_archived: true,
      archived_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })
    const payee = fromCloud('payees', {
      id: '2',
      local_id: 'local-payee',
      name: 'Cafe',
      is_archived: true,
      archived_at: '2026-01-02T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    })
    const fixedExpense = fromCloud('fixed_expenses', {
      id: '3',
      local_id: 'local-fixed',
      name: 'Rent',
      amount: 1200,
      is_archived: true,
      archived_at: '2026-01-03T00:00:00.000Z',
      updated_at: '2026-01-03T00:00:00.000Z',
    })

    expect('archivedAt' in category).toBe(false)
    expect('archivedAt' in payee).toBe(false)
    expect('archivedAt' in fixedExpense).toBe(false)
  })
})
