import { fireEvent, render, screen, within } from '@testing-library/react'
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
    notes: 'Lunch',
  },
  {
    id: 2,
    amount: -10,
    categoryId: 11,
    payeeId: undefined,
    date: '2026-05-13',
    notes: 'Refund notes',
  },
]

describe('ExpenseTableMobile', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders payee/amount primary line and category-notes secondary line', () => {
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

  it('shows no payee for missing payee and does not use notes as payee fallback', () => {
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
    expect(screen.getByText('No category · Refund notes')).toBeInTheDocument()
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

  it('renders split container rows with expand/collapse and no split kebab actions', () => {
    const onToggleSplitExpanded = vi.fn()
    const displayRows: ExpenseDisplayRow[] = [
      {
        rowType: 'splitContainer',
        rowId: 'split-container-90',
        splitId: 90,
        split: { id: 90, date: '2026-05-13', amount: 50 },
        childExpenses: [expenses[0], expenses[1]],
        payeeDisplay: 'Cafe (+1 more)',
        notesDisplay: 'Trip food',
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
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'Food'}
        resolvePayeeName={() => 'Cafe'}
      />,
    )

    expect(screen.getByText('Split')).toBeInTheDocument()
    expect(screen.getByText('Cafe (+1 more)')).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: /split actions/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /split child actions/i })).not.toBeInTheDocument()

    expect(screen.getByText('Trip food')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /split/i }))
    expect(onToggleSplitExpanded).toHaveBeenCalledWith(90)
  })

  it('shows only Split for a parent split row when no split notes exist', () => {
    const displayRows: ExpenseDisplayRow[] = [
      {
        rowType: 'splitContainer',
        rowId: 'split-container-90',
        splitId: 90,
        split: { id: 90, date: '2026-05-13', amount: 50, notes: '' },
        childExpenses: [expenses[0]],
        payeeDisplay: 'Cafe',
        notesDisplay: '',
        amountDisplay: 50,
      },
    ]

    render(
      <ExpenseTableMobile
        expenses={expenses}
        displayRows={displayRows}
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'Food'}
        resolvePayeeName={() => 'Cafe'}
      />,
    )

    expect(screen.getByText('Split')).toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('hides payee text for split child rows', () => {
    const displayRows: ExpenseDisplayRow[] = [
      {
        rowType: 'splitContainer',
        rowId: 'split-container-90',
        splitId: 90,
        split: { id: 90, date: '2026-05-13', amount: 50, payeeId: 100 },
        childExpenses: [expenses[0]],
        payeeDisplay: 'Cafe',
        notesDisplay: 'Trip food',
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
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'Food'}
        resolvePayeeName={() => 'Cafe'}
      />,
    )

    expect(within(screen.getByTestId('expense-row-mobile-1')).queryByText('Cafe')).not.toBeInTheDocument()
  })

  it('toggles split parent selection on tap in selection mode', () => {
    const onToggleSplitParentSelect = vi.fn()
    const onSplitParentEdit = vi.fn()
    const displayRows: ExpenseDisplayRow[] = [
      {
        rowType: 'splitContainer',
        rowId: 'split-container-90',
        splitId: 90,
        split: { id: 90, date: '2026-05-13', amount: 50 },
        childExpenses: [expenses[0]],
        payeeDisplay: 'Cafe',
        notesDisplay: 'Trip food',
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
        selectedIds={new Set<number>([999])}
        onToggleSplitParentSelect={onToggleSplitParentSelect}
        onSplitParentEdit={onSplitParentEdit}
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'Food'}
        resolvePayeeName={() => 'Cafe'}
      />,
    )

    fireEvent.click(screen.getByTestId('split-container-mobile-90'))

    expect(onToggleSplitParentSelect).toHaveBeenCalledWith(90)
    expect(onSplitParentEdit).not.toHaveBeenCalled()
  })

  it('does not double-toggle split parent selection when touchend is followed by click', () => {
    const onToggleSplitParentSelect = vi.fn()
    const displayRows: ExpenseDisplayRow[] = [
      {
        rowType: 'splitContainer',
        rowId: 'split-container-90',
        splitId: 90,
        split: { id: 90, date: '2026-05-13', amount: 50 },
        childExpenses: [expenses[0]],
        payeeDisplay: 'Cafe',
        notesDisplay: 'Trip food',
        amountDisplay: 50,
      },
    ]

    render(
      <ExpenseTableMobile
        expenses={expenses}
        displayRows={displayRows}
        selectedIds={new Set<number>([999])}
        onToggleSplitParentSelect={onToggleSplitParentSelect}
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'Food'}
        resolvePayeeName={() => 'Cafe'}
      />,
    )

    const row = screen.getByTestId('split-container-mobile-90')
    fireEvent.touchStart(row, { touches: [{ clientX: 10, clientY: 10 }] })
    fireEvent.touchEnd(row)
    fireEvent.click(row)

    expect(onToggleSplitParentSelect).toHaveBeenCalledTimes(1)
    expect(onToggleSplitParentSelect).toHaveBeenCalledWith(90)
  })

  it('toggles only the split child when tapping a split child in selection mode', () => {
    const onToggleSelect = vi.fn()
    const displayRows: ExpenseDisplayRow[] = [
      {
        rowType: 'splitContainer',
        rowId: 'split-container-90',
        splitId: 90,
        split: { id: 90, date: '2026-05-13', amount: 50 },
        childExpenses: [expenses[0]],
        payeeDisplay: 'Cafe',
        notesDisplay: 'Trip food',
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
        selectedIds={new Set<number>([999])}
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

  it('opens split parent edit on parent row tap when not in selection mode', () => {
    const onSplitParentEdit = vi.fn()
    const displayRows: ExpenseDisplayRow[] = [
      {
        rowType: 'splitContainer',
        rowId: 'split-container-90',
        splitId: 90,
        split: { id: 90, date: '2026-05-13', amount: 50 },
        childExpenses: [expenses[0]],
        payeeDisplay: 'Cafe',
        notesDisplay: 'Trip food',
        amountDisplay: 50,
      },
    ]

    render(
      <ExpenseTableMobile
        expenses={expenses}
        displayRows={displayRows}
        onSplitParentEdit={onSplitParentEdit}
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'Food'}
        resolvePayeeName={() => 'Cafe'}
      />,
    )

    fireEvent.click(screen.getByTestId('split-container-mobile-90'))
    expect(onSplitParentEdit).toHaveBeenCalledWith(90)
  })

  it('does not open split parent edit when tapping the split expand toggle', () => {
    const onSplitParentEdit = vi.fn()
    const onToggleSplitExpanded = vi.fn()
    const displayRows: ExpenseDisplayRow[] = [
      {
        rowType: 'splitContainer',
        rowId: 'split-container-90',
        splitId: 90,
        split: { id: 90, date: '2026-05-13', amount: 50 },
        childExpenses: [expenses[0]],
        payeeDisplay: 'Cafe',
        notesDisplay: 'Trip food',
        amountDisplay: 50,
      },
    ]

    render(
      <ExpenseTableMobile
        expenses={expenses}
        displayRows={displayRows}
        onSplitParentEdit={onSplitParentEdit}
        onToggleSplitExpanded={onToggleSplitExpanded}
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'Food'}
        resolvePayeeName={() => 'Cafe'}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /split/i }))
    expect(onToggleSplitExpanded).toHaveBeenCalledWith(90)
    expect(onSplitParentEdit).not.toHaveBeenCalled()
  })

  it('toggles split parent selection on long press', () => {
    const onToggleSplitParentSelect = vi.fn()
    const displayRows: ExpenseDisplayRow[] = [
      {
        rowType: 'splitContainer',
        rowId: 'split-container-90',
        splitId: 90,
        split: { id: 90, date: '2026-05-13', amount: 50 },
        childExpenses: [expenses[0]],
        payeeDisplay: 'Cafe',
        notesDisplay: 'Trip food',
        amountDisplay: 50,
      },
    ]

    render(
      <ExpenseTableMobile
        expenses={expenses}
        displayRows={displayRows}
        onToggleSplitParentSelect={onToggleSplitParentSelect}
        formatDate={(iso) => iso}
        formatAmount={(value) => `$${value.toFixed(2)}`}
        resolveName={() => 'Food'}
        resolvePayeeName={() => 'Cafe'}
      />,
    )

    const row = screen.getByTestId('split-container-mobile-90')
    fireEvent.touchStart(row, { touches: [{ clientX: 10, clientY: 10 }] })
    vi.advanceTimersByTime(550)
    expect(onToggleSplitParentSelect).toHaveBeenCalledWith(90)
  })

  it('toggles only the split child when long-pressing a split child in selection mode', () => {
    const onToggleSelect = vi.fn()
    const displayRows: ExpenseDisplayRow[] = [
      {
        rowType: 'splitContainer',
        rowId: 'split-container-90',
        splitId: 90,
        split: { id: 90, date: '2026-05-13', amount: 50 },
        childExpenses: [expenses[0]],
        payeeDisplay: 'Cafe',
        notesDisplay: 'Trip food',
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
        selectedIds={new Set<number>([999])}
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

  it('starts selection with only the split child when long-pressing without active selection', () => {
    const onToggleSelect = vi.fn()
    const displayRows: ExpenseDisplayRow[] = [
      {
        rowType: 'splitContainer',
        rowId: 'split-container-90',
        splitId: 90,
        split: { id: 90, date: '2026-05-13', amount: 50 },
        childExpenses: [expenses[0]],
        payeeDisplay: 'Cafe',
        notesDisplay: 'Trip food',
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
