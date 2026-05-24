import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRef, useState } from 'react'
import ExpenseTable from '../features/dashboard/ExpenseTable'
import type { Category, Expense, ExpenseSplit, Payee } from '../types'
import type { ExpenseTableHandle } from '../features/dashboard/ExpenseTable'

const storageMocks = vi.hoisted(() => ({
  getExpenseSplits: vi.fn<() => Promise<ExpenseSplit[]>>(),
  getAllExpenseSplits: vi.fn<() => Promise<ExpenseSplit[]>>(),
  getAllSplitChildExpenses: vi.fn<(splitId: number) => Promise<Expense[]>>(),
  updateExpenseSplit: vi.fn<(id: number, changes: Partial<ExpenseSplit>) => Promise<void>>(),
  unsplitExpenseSplit: vi.fn<(id: number) => Promise<void>>(),
  unsplitSplitChildExpense: vi.fn<(expenseId: number) => Promise<void>>(),
}))
const toastMocks = vi.hoisted(() => ({
  showToast: vi.fn(),
}))

vi.mock('../context/settingsContext', () => ({
  useSettings: () => ({
    settings: {
      decimalPlaces: '2',
      currencySymbol: '$',
    },
    formatAmount: (n: number) => `$${n.toFixed(2)}`,
    formatDate: (iso: string) => iso,
  }),
}))

vi.mock('../context/toastContext', () => ({
  useToasts: () => ({
    showToast: toastMocks.showToast,
  }),
}))

vi.mock('../services/storageService', () => ({
  StorageService: {
    getExpenseSplits: storageMocks.getExpenseSplits,
    getAllExpenseSplits: storageMocks.getAllExpenseSplits,
    getAllSplitChildExpenses: storageMocks.getAllSplitChildExpenses,
    updateExpenseSplit: storageMocks.updateExpenseSplit,
    unsplitExpenseSplit: storageMocks.unsplitExpenseSplit,
    unsplitSplitChildExpense: storageMocks.unsplitSplitChildExpense,
    addCategory: vi.fn(),
    addPayee: vi.fn(),
  },
}))

describe('ExpenseTable', () => {
  beforeEach(() => {
    storageMocks.getExpenseSplits.mockReset()
    storageMocks.getAllExpenseSplits.mockReset()
    storageMocks.getAllSplitChildExpenses.mockReset()
    storageMocks.updateExpenseSplit.mockReset()
    storageMocks.unsplitExpenseSplit.mockReset()
    storageMocks.unsplitSplitChildExpense.mockReset()
    toastMocks.showToast.mockReset()
  })

  it('renders split container rows with grouped children and unsplit action', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, description: 'B' },
      { id: 3, date: '2026-05-09', amount: 5, categoryId: 1, description: 'C' },
    ]
    const categories: Category[] = [
      { id: 1, name: 'Food' },
      { id: 2, name: 'Transport' },
    ]
    const payees: Payee[] = [{ id: 1, name: 'Cafe' }]
    const splits: ExpenseSplit[] = [{ id: 10, date: '2026-05-10', amount: 20 }]
    storageMocks.getExpenseSplits.mockResolvedValue(splits)
    storageMocks.getAllExpenseSplits.mockResolvedValue(splits)
    storageMocks.getAllSplitChildExpenses.mockResolvedValue(expenses.filter((expense) => expense.splitId === 10))
    storageMocks.unsplitExpenseSplit.mockResolvedValue()
    const refreshExpenses = vi.fn<() => Promise<void>>().mockResolvedValue()
    const triggerSync = vi.fn()

    render(
      <ExpenseTable
        expenses={expenses}
        categories={categories}
        payees={payees}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        refreshExpenses={refreshExpenses}
        triggerSync={triggerSync}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('split-container-10')).toBeInTheDocument())
    expect(screen.getByText('Split')).toBeInTheDocument()
    expect(screen.getAllByText('2026-05-10')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { expanded: true }))
    expect(screen.queryByTestId('split-child-1')).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByTestId('split-container-10'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit split transaction' }))

    await waitFor(() => expect(screen.getAllByText('Edit Expense').length).toBeGreaterThan(0))
    expect(storageMocks.getAllExpenseSplits).toHaveBeenCalled()
    expect(storageMocks.getAllSplitChildExpenses).toHaveBeenCalledWith(10)

    fireEvent.contextMenu(screen.getByTestId('split-container-10'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Unsplit transaction' }))
    await waitFor(() => expect(storageMocks.unsplitExpenseSplit).toHaveBeenCalledWith(10))
    expect(refreshExpenses).toHaveBeenCalled()
    expect(triggerSync).toHaveBeenCalled()
  })

  it('blocks bulk edit when multi-select includes split allocations', async () => {
    const ref = createRef<ExpenseTableHandle>()
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, date: '2026-05-09', amount: 5, categoryId: 1, description: 'C' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([{ id: 10, date: '2026-05-10', amount: 12 }])

    render(
      <ExpenseTable
        ref={ref}
        expenses={expenses}
        categories={[{ id: 1, name: 'Food' }]}
        payees={[]}
        selectedIds={new Set<number>([1, 2])}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    await waitFor(() => expect(ref.current).not.toBeNull())
    ref.current?.handleEditRequest([1, 2])

    expect(toastMocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Bulk edit is unavailable when selection includes split allocations.',
      }),
    )
    expect(screen.queryByText('Apply Changes')).not.toBeInTheDocument()
  })

  it('opens the split editor when a split child amount is edited', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, description: 'B' },
    ]
    const splits: ExpenseSplit[] = [
      { id: 10, date: '2026-05-10', amount: 20, description: 'Lunch' },
    ]

    storageMocks.getExpenseSplits.mockResolvedValue(splits)
    storageMocks.getAllExpenseSplits.mockResolvedValue(splits)
    storageMocks.getAllSplitChildExpenses.mockResolvedValue(expenses)

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('split-child-1')).toBeInTheDocument())
    fireEvent.pointerDown(screen.getByText('$12.00'))

    await waitFor(() => expect(screen.getAllByText('Edit Expense').length).toBeGreaterThan(0))
    expect(storageMocks.getAllExpenseSplits).toHaveBeenCalled()
    expect(storageMocks.getAllSplitChildExpenses).toHaveBeenCalledWith(10)
  })

  it('allows unsplitting a single split child from the row context menu', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, description: 'B' },
    ]
    const splits: ExpenseSplit[] = [{ id: 10, date: '2026-05-10', amount: 20 }]
    const refreshExpenses = vi.fn<() => Promise<void>>().mockResolvedValue()
    const triggerSync = vi.fn()

    storageMocks.getExpenseSplits.mockResolvedValue(splits)
    storageMocks.unsplitSplitChildExpense.mockResolvedValue()

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        refreshExpenses={refreshExpenses}
        triggerSync={triggerSync}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('split-child-1')).toBeInTheDocument())

    fireEvent.contextMenu(screen.getByTestId('split-child-1'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Unsplit allocation' }))

    await waitFor(() => expect(storageMocks.unsplitSplitChildExpense).toHaveBeenCalledWith(1))
    expect(refreshExpenses).toHaveBeenCalled()
    expect(triggerSync).toHaveBeenCalled()
  })

  it('shows a dash for empty split parent descriptions and saves inline edits', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1 },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2 },
    ]
    const splits: ExpenseSplit[] = [{ id: 10, date: '2026-05-10', amount: 20, description: '' }]

    storageMocks.getExpenseSplits.mockResolvedValue(splits)
    storageMocks.updateExpenseSplit.mockResolvedValue()

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('split-container-10')).toBeInTheDocument())
    const dash = within(screen.getByTestId('split-container-10')).getByText('—')

    fireEvent.pointerDown(dash)
    const input = await screen.findByDisplayValue('')
    fireEvent.change(input, { target: { value: 'Shared receipt' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(storageMocks.updateExpenseSplit).toHaveBeenCalledWith(10, {
        description: 'Shared receipt',
      })
    })
    expect(screen.getByText('Shared receipt')).toBeInTheDocument()
  })

  it('persists description edits when switching directly to another row editor', async () => {
    const initialExpenses: Expense[] = [
      { id: 1, date: '2026-05-10', amount: 12, categoryId: 1, description: '' },
      { id: 2, date: '2026-05-09', amount: 8, categoryId: 1, description: 'Groceries' },
    ]

    storageMocks.getExpenseSplits.mockResolvedValue([])

    function TestHarness() {
      const [expenses, setExpenses] = useState(initialExpenses)

      return (
        <ExpenseTable
          expenses={expenses}
          categories={[{ id: 1, name: 'Food' }]}
          payees={[]}
          selectedIds={new Set<number>()}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          onUpdate={(id, changes) => {
            setExpenses((current) =>
              current.map((expense) => (expense.id === id ? { ...expense, ...changes } : expense)),
            )
          }}
          onDelete={vi.fn()}
        />
      )
    }

    render(<TestHarness />)

    const firstRow = await screen.findByTestId('expense-1')
    const secondRow = await screen.findByTestId('expense-2')

    fireEvent.pointerDown(within(firstRow).getByText('—'))
    const input = await screen.findByDisplayValue('')
    fireEvent.change(input, { target: { value: 'Coffee' } })
    fireEvent.pointerDown(within(secondRow).getByText('Groceries'))

    await waitFor(() => {
      expect(within(firstRow).getByText('Coffee')).toBeInTheDocument()
    })
    expect(await screen.findByDisplayValue('Groceries')).toBeInTheDocument()
  })

  it('persists split description edits when switching directly to another split editor', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, description: 'B' },
      { id: 3, splitId: 20, date: '2026-05-09', amount: 7, categoryId: 1, description: 'C' },
      { id: 4, splitId: 20, date: '2026-05-09', amount: 3, categoryId: 2, description: 'D' },
    ]
    const splits: ExpenseSplit[] = [
      { id: 10, date: '2026-05-10', amount: 20, description: '' },
      { id: 20, date: '2026-05-09', amount: 10, description: 'Second split' },
    ]

    storageMocks.getExpenseSplits.mockResolvedValue(splits)
    storageMocks.updateExpenseSplit.mockResolvedValue()

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const firstSplitRow = await screen.findByTestId('split-container-10')
    const secondSplitRow = await screen.findByTestId('split-container-20')

    fireEvent.pointerDown(within(firstSplitRow).getByText('—'))
    const input = await screen.findByDisplayValue('')
    fireEvent.change(input, { target: { value: 'Shared receipt' } })
    fireEvent.pointerDown(within(secondSplitRow).getByText('Second split'))

    await waitFor(() => {
      expect(storageMocks.updateExpenseSplit).toHaveBeenCalledWith(10, {
        description: 'Shared receipt',
      })
    })
    expect(await screen.findByDisplayValue('Second split')).toBeInTheDocument()
  })

  it('provides parent split mobile menu actions when one full split is selected', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, description: 'B' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([{ id: 10, date: '2026-05-10', amount: 20 }])
    storageMocks.unsplitExpenseSplit.mockResolvedValue()
    const refreshExpenses = vi.fn<() => Promise<void>>().mockResolvedValue()
    const triggerSync = vi.fn()
    const onMobileExtraMenuActionsChange = vi.fn()

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[]}
        selectedIds={new Set<number>([1, 2])}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isMobile
        refreshExpenses={refreshExpenses}
        triggerSync={triggerSync}
        onMobileExtraMenuActionsChange={onMobileExtraMenuActionsChange}
      />,
    )

    await waitFor(() => {
      expect(onMobileExtraMenuActionsChange).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Edit split transaction' }),
          expect.objectContaining({ label: 'Unsplit transaction' }),
        ]),
      )
    })

    const parentActions = onMobileExtraMenuActionsChange.mock.calls.at(-1)?.[0] as Array<{
      label: string
      onClick: () => void
      danger?: boolean
    }>
    parentActions.find((action) => action.label === 'Unsplit transaction')?.onClick()

    await waitFor(() => expect(storageMocks.unsplitExpenseSplit).toHaveBeenCalledWith(10))
    expect(refreshExpenses).toHaveBeenCalled()
    expect(triggerSync).toHaveBeenCalled()
  })

  it('provides single child unsplit mobile action when one split child is selected', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, description: 'B' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([{ id: 10, date: '2026-05-10', amount: 20 }])
    storageMocks.unsplitSplitChildExpense.mockResolvedValue()
    const refreshExpenses = vi.fn<() => Promise<void>>().mockResolvedValue()
    const triggerSync = vi.fn()
    const onMobileExtraMenuActionsChange = vi.fn()

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[]}
        selectedIds={new Set<number>([1])}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isMobile
        refreshExpenses={refreshExpenses}
        triggerSync={triggerSync}
        onMobileExtraMenuActionsChange={onMobileExtraMenuActionsChange}
      />,
    )

    await waitFor(() => {
      expect(onMobileExtraMenuActionsChange).toHaveBeenLastCalledWith(
        expect.arrayContaining([expect.objectContaining({ label: 'Unsplit allocation' })]),
      )
    })

    const childActions = onMobileExtraMenuActionsChange.mock.calls.at(-1)?.[0] as Array<{
      label: string
      onClick: () => void
      danger?: boolean
    }>
    childActions.find((action) => action.label === 'Unsplit allocation')?.onClick()

    await waitFor(() => expect(storageMocks.unsplitSplitChildExpense).toHaveBeenCalledWith(1))
    expect(refreshExpenses).toHaveBeenCalled()
    expect(triggerSync).toHaveBeenCalled()
  })
})
