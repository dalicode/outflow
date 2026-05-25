import { describe, expect, it } from 'vitest'
import { getExpenseAllocations } from '../utils/expenseAllocations'

describe('getExpenseAllocations', () => {
  it('maps regular and split child expenses into allocation rows', () => {
    const allocations = getExpenseAllocations([
      { id: 1, date: '2026-01-01', amount: 20, categoryId: 1, payeeId: 1 },
      { id: 2, splitId: 99, date: '2026-01-01', amount: 80, categoryId: 2, payeeId: 2 },
    ])

    expect(allocations).toEqual([
      {
        expenseId: 1,
        splitId: undefined,
        date: '2026-01-01',
        amount: 20,
        categoryId: 1,
        payeeId: 1,
        notes: undefined,
      },
      {
        expenseId: 2,
        splitId: 99,
        date: '2026-01-01',
        amount: 80,
        categoryId: 2,
        payeeId: 2,
        notes: undefined,
      },
    ])
  })
})
