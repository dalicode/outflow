import { describe, expect, it } from 'vitest'
import {
  buildExpenseDisplayRows,
  getEffectiveSplitParentExpanded,
  getSplitContainerPayeeDisplay,
} from '@/features/dashboard/splitDisplayRows'
import type { Expense, ExpenseSplit, Payee } from '@/types'

describe('splitDisplayRows', () => {
  it('builds grouped container and child rows for split expenses', () => {
    const expenses: Expense[] = [
      { id: 1, date: '2026-05-02', amount: 12, splitId: 10, categoryId: 3 },
      { id: 2, date: '2026-05-02', amount: 8, splitId: 10, categoryId: 4 },
      { id: 3, date: '2026-05-01', amount: 5, categoryId: 7 },
    ]
    const splits: ExpenseSplit[] = [
      { id: 10, date: '2026-05-02', amount: 20, notes: 'Lunch split' },
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
      { id: 10, date: '2026-05-02', amount: 20, notes: 'Lunch split' },
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

  it('keeps split container notes empty when the parent has no notes', () => {
    const expenses: Expense[] = [
      { id: 1, date: '2026-05-02', amount: 12, splitId: 10, categoryId: 3 },
    ]
    const splits: ExpenseSplit[] = [{ id: 10, date: '2026-05-02', amount: 12 }]

    const rows = buildExpenseDisplayRows({
      expenses,
      splits,
      payeeMap: {},
      expandedSplitIds: new Set<number>(),
    })

    expect(rows[0]).toEqual(
      expect.objectContaining({
        rowType: 'splitContainer',
        notesDisplay: '',
      }),
    )
  })

  it('uses default split expansion when no override exists', () => {
    expect(
      getEffectiveSplitParentExpanded({
        splitId: 10,
        defaultExpanded: false,
        overrides: {},
      }),
    ).toBe(false)
    expect(
      getEffectiveSplitParentExpanded({
        splitId: 10,
        defaultExpanded: true,
        overrides: {},
      }),
    ).toBe(true)
  })

  it('uses split-specific override when present', () => {
    expect(
      getEffectiveSplitParentExpanded({
        splitId: 10,
        defaultExpanded: false,
        overrides: { 10: true },
      }),
    ).toBe(true)
    expect(
      getEffectiveSplitParentExpanded({
        splitId: 10,
        defaultExpanded: true,
        overrides: { 10: false },
      }),
    ).toBe(false)
  })
})
