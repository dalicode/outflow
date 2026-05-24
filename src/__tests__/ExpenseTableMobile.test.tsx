import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import ExpenseTableMobile from '../features/dashboard/ExpenseTableMobile'
import type { ExpenseDisplayRow } from '../features/dashboard/splitDisplayRows'
import type { Expense } from '../types'

const expenses: Expense[] = [
  {
    id: 1,
    amount: 25.5,
    categoryId: 10,
    payeeId: 100,
    date: '2026-05-13',
    description: 'Lunch',
  },
  {
    id: 2,
    amount: -10,
    categoryId: 11,
    payeeId: undefined,
    date: '2026-05-13',
    description: 'Refund note',
  },
]

describe('ExpenseTableMobile', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders payee/amount primary line and category-description secondary line', () => {
    render(
      <ExpenseTableMobile
        expenses={expenses}
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={(exp) => (exp.categoryId === 10 ? 'Food' : 'Other')}
        resolvePayeeName={(exp) => (exp.payeeId ? 'Cafe' : '')}
      />,
    )

    expect(screen.getByText('Cafe')).toBeInTheDocument()
    expect(screen.getByText('$25.50')).toBeInTheDocument()
    expect(screen.getByText('Food · Lunch')).toBeInTheDocument()
  })

  it('shows no payee for missing payee and does not use description as payee fallback', () => {
    render(
      <ExpenseTableMobile
        expenses={[expenses[1]]}
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'No category'}
        resolvePayeeName={() => 'No payee'}
      />,
    )

    expect(screen.getByText('No payee')).toBeInTheDocument()
    expect(screen.getByText('No category · Refund note')).toBeInTheDocument()
  })

  it('opens cell edit on tap when no rows are selected', () => {
    const onCellEdit = vi.fn()
    render(
      <ExpenseTableMobile
        expenses={[expenses[0]]}
        onCellEdit={onCellEdit}
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'Food'}
        resolvePayeeName={() => 'Cafe'}
      />,
    )

    fireEvent.click(screen.getByTestId('expense-row-mobile-1'))
    expect(onCellEdit).toHaveBeenCalledWith(expenses[0])
  })

  it('toggles selection on tap when selection mode is active', () => {
    const onToggleSelect = vi.fn()
    render(
      <ExpenseTableMobile
        expenses={[expenses[0]]}
        selectedIds={new Set<number>([99])}
        onToggleSelect={onToggleSelect}
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'Food'}
        resolvePayeeName={() => 'Cafe'}
      />,
    )

    fireEvent.click(screen.getByTestId('expense-row-mobile-1'))
    expect(onToggleSelect).toHaveBeenCalledWith(1)
  })

  it('toggles selection on long press', () => {
    const onToggleSelect = vi.fn()
    render(
      <ExpenseTableMobile
        expenses={[expenses[0]]}
        onToggleSelect={onToggleSelect}
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'Food'}
        resolvePayeeName={() => 'Cafe'}
      />,
    )

    const row = screen.getByTestId('expense-row-mobile-1')
    fireEvent.touchStart(row, { touches: [{ clientX: 10, clientY: 10 }] })
    vi.advanceTimersByTime(550)
    expect(onToggleSelect).toHaveBeenCalledWith(1)
  })

  it('renders split container rows with expand/collapse and unsplit action', () => {
    const onToggleSplitExpanded = vi.fn()
    const onUnsplitSplit = vi.fn()
    const displayRows: ExpenseDisplayRow[] = [
      {
        rowType: 'splitContainer',
        rowId: 'split-container-90',
        splitId: 90,
        split: { id: 90, date: '2026-05-13', amount: 50 },
        childExpenses: [expenses[0], expenses[1]],
        payeeDisplay: 'Cafe (+1 more)',
        descriptionDisplay: 'Trip food',
        amountDisplay: 50,
      },
      {
        rowType: 'splitChild',
        rowId: 'split-child-1',
        splitId: 90,
        expense: expenses[0],
      },
    ]

    render(
      <ExpenseTableMobile
        expenses={expenses}
        displayRows={displayRows}
        onToggleSplitExpanded={onToggleSplitExpanded}
        isSplitExpanded={() => true}
        onUnsplitSplit={onUnsplitSplit}
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'Food'}
        resolvePayeeName={() => 'Cafe'}
      />,
    )

    expect(screen.getByText('Split')).toBeInTheDocument()
    expect(screen.getByText('Cafe (+1 more)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /split actions/i }))
    fireEvent.click(screen.getByRole('button', { name: /unsplit transaction/i }))
    expect(onUnsplitSplit).toHaveBeenCalledWith(90)

    fireEvent.click(screen.getByRole('button', { expanded: true }))
    expect(onToggleSplitExpanded).toHaveBeenCalledWith(90)
  })
})
