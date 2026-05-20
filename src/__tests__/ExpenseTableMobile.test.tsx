import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import ExpenseTableMobile from '../features/dashboard/ExpenseTableMobile'
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
})
