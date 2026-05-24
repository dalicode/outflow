import { describe, expect, it } from 'vitest'
import {
  buildExpenseDisplayRows,
  getSplitContainerPayeeDisplay,
} from '../features/dashboard/splitDisplayRows'
import type { Expense, ExpenseSplit, Payee } from '../types'

describe('splitDisplayRows', () => {
  it('builds grouped container and child rows for split expenses', () => {
    const expenses: Expense[] = [
      { id: 1, date: '2026-05-02', amount: 12, splitId: 10, categoryId: 3 },
      { id: 2, date: '2026-05-02', amount: 8, splitId: 10, categoryId: 4 },
      { id: 3, date: '2026-05-01', amount: 5, categoryId: 7 },
    ]
    const splits: ExpenseSplit[] = [
      { id: 10, date: '2026-05-02', amount: 20, description: 'Lunch split' },
    ]

    const rows = buildExpenseDisplayRows({
      expenses,
      splits,
      payeeMap: {},
      expandedSplitIds: new Set([10]),
    })

    expect(rows.map((row) => row.rowType)).toEqual([
      'splitContainer',
      'splitChild',
      'splitChild',
      'expense',
    ])
    expect(rows[0]).toEqual(
      expect.objectContaining({
        amountDisplay: 20,
      }),
    )
  })

  it('summarizes split payee label with remaining-payee count', () => {
    const payees: Record<number, Payee> = {
      1: { id: 1, name: 'Cafe' },
      2: { id: 2, name: 'Market' },
    }
    const children: Expense[] = [
      { id: 1, date: '2026-05-01', amount: 10, payeeId: 1 },
      { id: 2, date: '2026-05-01', amount: 20, payeeId: 1 },
      { id: 3, date: '2026-05-01', amount: 30, payeeId: 2 },
    ]

    expect(getSplitContainerPayeeDisplay(children, payees)).toBe('Cafe (+1 more)')
  })

  it('uses the visible split child subset for container totals', () => {
    const expenses: Expense[] = [
      { id: 1, date: '2026-05-02', amount: 12, splitId: 10, categoryId: 3 },
    ]
    const splits: ExpenseSplit[] = [
      { id: 10, date: '2026-05-02', amount: 20, description: 'Lunch split' },
    ]

    const rows = buildExpenseDisplayRows({
      expenses,
      splits,
      payeeMap: {},
      expandedSplitIds: new Set([10]),
    })

    expect(rows[0]).toEqual(
      expect.objectContaining({
        rowType: 'splitContainer',
        amountDisplay: 12,
      }),
    )
  })
})
