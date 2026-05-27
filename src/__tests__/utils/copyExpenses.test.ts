import { describe, expect, it } from 'vitest'
import type { Expense } from '@/types'
import { formatExpensesAsTsv } from '@/utils/copyExpenses'

describe('formatExpensesAsTsv', () => {
  it('exports a flat list that includes split child allocations and unsplit expenses', () => {
    const expenses: Expense[] = [
      {
        id: 11,
        splitId: 9,
        date: '2026-04-10',
        amount: 12,
        categoryId: 1,
        payeeId: 1,
        notes: 'Food split',
      },
      {
        id: 12,
        splitId: 9,
        date: '2026-04-10',
        amount: 8,
        categoryId: 2,
        payeeId: 1,
        notes: 'Taxi split',
      },
      { id: 13, date: '2026-04-11', amount: 4, categoryId: 1, payeeId: 2, notes: 'Snack' },
    ]

    const tsv = formatExpensesAsTsv(
      expenses,
      [
        { id: 1, name: 'Food' },
        { id: 2, name: 'Transport' },
      ],
      [
        { id: 1, name: 'Shared Payee' },
        { id: 2, name: 'Corner Store' },
      ],
      (date) => date,
      (amount) => amount.toFixed(2),
    )

    const lines = tsv.split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toContain('Food split')
    expect(lines[2]).toContain('Taxi split')
    expect(lines[3]).toContain('Snack')
  })
})
