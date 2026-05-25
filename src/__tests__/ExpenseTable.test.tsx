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
      dateFormat: 'YYYY-MM-DD',
      hapticsEnabled: false,
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

function createDeferredPromise(): {
  promise: Promise<void>
  resolve: () => void
} {
  let resolve = () => {}
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('ExpenseTable', () => {
  beforeEach(() => {
    storageMocks.getExpenseSplits.mockReset()
    storageMocks.getAllExpenseSplits.mockReset()
    storageMocks.getAllSplitChildExpenses.mockReset()
    storageMocks.updateExpenseSplit.mockReset()
    storageMocks.unsplitExpenseSplit.mockReset()
    storageMocks.unsplitSplitChildExpense.mockReset()
    toastMocks.showToast.mockReset()
    storageMocks.getExpenseSplits.mockResolvedValue([])
    storageMocks.getAllExpenseSplits.mockResolvedValue([])
    storageMocks.getAllSplitChildExpenses.mockResolvedValue([])
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
    storageMocks.getAllSplitChildExpenses.mockResolvedValue(
      expenses.filter((expense) => expense.splitId === 10),
    )
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

  it('shows tags under the description in mobile rows', async () => {
    const expenses: Expense[] = [
      { id: 1, date: '2026-05-10', amount: 20, categoryId: 1, payeeId: 1, description: 'Lunch' },
    ]

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[{ id: 1, name: 'Food' }]}
        payees={[{ id: 1, name: 'Cafe' }]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isMobile
        expenseTagsMap={{
          1: [
            { id: 101, name: 'Travel', isArchived: false },
            { id: 102, name: 'Work', isArchived: false },
          ],
        }}
      />,
    )

    const mobileRow = await screen.findByTestId('expense-row-mobile-1')
    expect(within(mobileRow).getByText('Cafe')).toBeInTheDocument()
    expect(within(mobileRow).getByText('Food · Lunch')).toBeInTheDocument()
    expect(within(mobileRow).getByText('Travel')).toBeInTheDocument()
    expect(within(mobileRow).getByText('Work')).toBeInTheDocument()
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
    const refreshExpenses = vi.fn<() => Promise<void>>().mockResolvedValue()

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
        refreshExpenses={refreshExpenses}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('split-container-10')).toBeInTheDocument())
    const dash = within(screen.getByTestId('split-container-10')).getByTestId(
      'editable-cell-display-description',
    )

    fireEvent.pointerDown(dash)
    const input = await screen.findByDisplayValue('')
    fireEvent.change(input, { target: { value: 'Shared receipt' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(storageMocks.updateExpenseSplit).toHaveBeenCalledWith(10, {
        description: 'Shared receipt',
      })
    })
    expect(storageMocks.updateExpenseSplit).toHaveBeenCalledTimes(1)
    expect(refreshExpenses).not.toHaveBeenCalled()
    expect(screen.getByText('Shared receipt')).toBeInTheDocument()
  })

  it('saves split parent date once and closes editor before delayed refresh resolves', async () => {
    const expenses: Expense[] = [
      {
        id: 1,
        splitId: 10,
        date: '2026-05-10',
        amount: 12,
        categoryId: 1,
        payeeId: 1,
        description: 'A',
      },
      {
        id: 2,
        splitId: 10,
        date: '2026-05-10',
        amount: 8,
        categoryId: 2,
        payeeId: 1,
        description: 'B',
      },
    ]
    const splits: ExpenseSplit[] = [
      { id: 10, date: '2026-05-10', amount: 20, payeeId: 1, payeeNameSnapshot: 'Cafe' },
    ]
    const deferredRefresh = createDeferredPromise()
    const refreshExpenses = vi.fn<() => Promise<void>>().mockReturnValue(deferredRefresh.promise)

    storageMocks.getExpenseSplits.mockResolvedValue(splits)
    storageMocks.updateExpenseSplit.mockResolvedValue()

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[{ id: 1, name: 'Cafe' }]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        refreshExpenses={refreshExpenses}
      />,
    )

    const splitRow = await screen.findByTestId('split-container-10')
    fireEvent.pointerDown(within(splitRow).getByText('2026-05-10'))

    const input = await screen.findByDisplayValue('2026-05-10')
    fireEvent.change(input, { target: { value: '2026-05-12' } })
    fireEvent.blur(input)
    fireEvent.blur(input)

    await waitFor(() => {
      expect(storageMocks.updateExpenseSplit).toHaveBeenCalledWith(10, { date: '2026-05-12' })
    })
    expect(storageMocks.updateExpenseSplit).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByDisplayValue('2026-05-12')).not.toBeInTheDocument()
    })
    expect(refreshExpenses).toHaveBeenCalledTimes(1)
    deferredRefresh.resolve()
    expect(refreshExpenses).toHaveBeenCalled()
  })

  it('saves split parent payee once and closes editor before delayed refresh resolves', async () => {
    const expenses: Expense[] = [
      {
        id: 1,
        splitId: 10,
        date: '2026-05-10',
        amount: 12,
        categoryId: 1,
        payeeId: 1,
        description: 'A',
      },
      {
        id: 2,
        splitId: 10,
        date: '2026-05-10',
        amount: 8,
        categoryId: 2,
        payeeId: 1,
        description: 'B',
      },
    ]
    const splits: ExpenseSplit[] = [
      { id: 10, date: '2026-05-10', amount: 20, payeeId: 1, payeeNameSnapshot: 'Cafe' },
    ]
    const deferredRefresh = createDeferredPromise()
    const refreshExpenses = vi.fn<() => Promise<void>>().mockReturnValue(deferredRefresh.promise)

    storageMocks.getExpenseSplits.mockResolvedValue(splits)
    storageMocks.updateExpenseSplit.mockResolvedValue()

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[
          { id: 1, name: 'Cafe' },
          { id: 2, name: 'Market' },
        ]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        refreshExpenses={refreshExpenses}
      />,
    )

    const splitRow = await screen.findByTestId('split-container-10')
    fireEvent.pointerDown(within(splitRow).getByText('Cafe'))

    const input = await screen.findByDisplayValue('Cafe')
    fireEvent.change(input, { target: { value: 'Market' } })
    fireEvent.blur(input)
    fireEvent.blur(input)

    await waitFor(() => {
      expect(storageMocks.updateExpenseSplit).toHaveBeenCalledWith(10, {
        payeeId: 2,
        payeeNameSnapshot: 'Market',
      })
    })
    expect(storageMocks.updateExpenseSplit).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Market')).not.toBeInTheDocument()
    })
    expect(refreshExpenses).toHaveBeenCalledTimes(1)
    deferredRefresh.resolve()
    expect(refreshExpenses).toHaveBeenCalled()
  })

  it('does not render payee text for split child rows', async () => {
    const expenses: Expense[] = [
      {
        id: 1,
        splitId: 10,
        date: '2026-05-10',
        amount: 12,
        categoryId: 1,
        payeeId: 1,
        description: 'A',
      },
      {
        id: 2,
        splitId: 10,
        date: '2026-05-10',
        amount: 8,
        categoryId: 2,
        payeeId: 1,
        description: 'B',
      },
    ]
    const splits: ExpenseSplit[] = [
      { id: 10, date: '2026-05-10', amount: 20, payeeId: 1, payeeNameSnapshot: 'Cafe' },
    ]

    storageMocks.getExpenseSplits.mockResolvedValue(splits)

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[{ id: 1, name: 'Cafe' }]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const splitChildRow = await screen.findByTestId('split-child-1')
    expect(within(splitChildRow).queryByText('Cafe')).not.toBeInTheDocument()
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

    const firstRow = await screen.findByTestId('expense-row-1')
    const secondRow = await screen.findByTestId('expense-row-2')

    fireEvent.pointerDown(within(firstRow).getByTestId('editable-cell-display-description'))
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

    fireEvent.pointerDown(within(firstSplitRow).getByTestId('editable-cell-display-description'))
    const input = await screen.findByDisplayValue('')
    fireEvent.change(input, { target: { value: 'Shared receipt' } })
    fireEvent.pointerDown(within(secondSplitRow).getByText('Second split'))

    await waitFor(() => {
      expect(storageMocks.updateExpenseSplit).toHaveBeenCalledWith(10, {
        description: 'Shared receipt',
      })
    })
    expect(screen.getByText('Second split')).toBeInTheDocument()
  })

  it('provides parent split mobile unsplit action when one full split is selected', async () => {
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

    fireEvent.click(await screen.findByRole('button', { expanded: true }))
    await waitFor(() => {
      expect(screen.queryByTestId('expense-row-mobile-1')).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(onMobileExtraMenuActionsChange).toHaveBeenLastCalledWith(
        expect.arrayContaining([expect.objectContaining({ label: 'Unsplit transaction' })]),
      )
    })

    const parentActions = onMobileExtraMenuActionsChange.mock.calls.at(-1)?.[0] as Array<{
      label: string
      onClick: () => void
      danger?: boolean
    }>
    expect(parentActions.some((action) => action.label === 'Edit split transaction')).toBe(false)
    parentActions.find((action) => action.label === 'Unsplit transaction')?.onClick()

    await waitFor(() => expect(storageMocks.unsplitExpenseSplit).toHaveBeenCalledWith(10))
    expect(refreshExpenses).toHaveBeenCalled()
    expect(triggerSync).toHaveBeenCalled()
  })

  it('reports full split-parent mobile selection while the split is collapsed', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, description: 'B' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([{ id: 10, date: '2026-05-10', amount: 20 }])
    const onMobileSplitParentSelectionChange = vi.fn()

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
        onMobileSplitParentSelectionChange={onMobileSplitParentSelectionChange}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: true }))
    await waitFor(() => {
      expect(screen.queryByTestId('expense-row-mobile-1')).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(onMobileSplitParentSelectionChange).toHaveBeenLastCalledWith(10)
    })
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

  it('collapses and expands split children from the compact mobile Split toggle', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, description: 'B' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 20, description: 'Trip food' },
    ])

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[{ id: 1, name: 'Cafe' }]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isMobile
      />,
    )

    const splitRow = await screen.findByTestId('split-container-mobile-10')
    expect(screen.getByTestId('expense-row-mobile-1')).toBeInTheDocument()

    const splitToggle = within(splitRow).getByRole('button', { expanded: true })
    fireEvent.click(splitToggle)

    await waitFor(() => {
      expect(screen.queryByTestId('expense-row-mobile-1')).not.toBeInTheDocument()
    })
    expect(within(splitRow).getByRole('button', { expanded: false })).toBeInTheDocument()

    fireEvent.click(within(splitRow).getByRole('button', { expanded: false }))
    await waitFor(() => {
      expect(screen.getByTestId('expense-row-mobile-1')).toBeInTheDocument()
    })
    expect(within(splitRow).getByRole('button', { expanded: true })).toBeInTheDocument()
  })

  it('does not collapse split children when tapping split description text on mobile', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, description: 'B' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 20, description: 'Trip food' },
    ])

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[{ id: 1, name: 'Cafe' }]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isMobile
      />,
    )

    const splitRow = await screen.findByTestId('split-container-mobile-10')
    const splitToggle = within(splitRow).getByRole('button', { expanded: true })

    fireEvent.click(within(splitRow).getByText('Trip food'))

    expect(within(splitRow).getByRole('button', { expanded: true })).toBeInTheDocument()
    expect(splitToggle).toBeInTheDocument()
    expect(screen.getByTestId('expense-row-mobile-1')).toBeInTheDocument()
  })

  it('opens split editor flow when tapping a split parent row on mobile', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, description: 'B' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 20, description: 'Trip food' },
    ])
    storageMocks.getAllExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 20, description: 'Trip food' },
    ])
    storageMocks.getAllSplitChildExpenses.mockResolvedValue(expenses)

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[{ id: 1, name: 'Cafe' }]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isMobile
      />,
    )

    fireEvent.click(await screen.findByTestId('split-container-mobile-10'))

    await waitFor(() => expect(screen.getAllByText('Edit Expense').length).toBeGreaterThan(0))
    expect(storageMocks.getAllExpenseSplits).toHaveBeenCalled()
    expect(storageMocks.getAllSplitChildExpenses).toHaveBeenCalledWith(10)
  })

  it('toggles split parent selection from parent card taps outside the Split toggle in mobile selection mode', async () => {
    const onToggleSelect = vi.fn()
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, description: 'B' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 20, description: 'Trip food' },
    ])

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[{ id: 1, name: 'Cafe' }]}
        selectedIds={new Set<number>([999])}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isMobile
      />,
    )

    const splitRow = await screen.findByTestId('split-container-mobile-10')
    fireEvent.click(splitRow)

    expect(onToggleSelect).toHaveBeenCalledTimes(2)
    expect(onToggleSelect).toHaveBeenCalledWith(1)
    expect(onToggleSelect).toHaveBeenCalledWith(2)
  })

  it('toggles only the tapped split child from mobile selection mode', async () => {
    const onToggleSelect = vi.fn()
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, description: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, description: 'B' },
      { id: 3, date: '2026-05-09', amount: 5, categoryId: 1, description: 'Solo' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 20, description: 'Trip food' },
    ])

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
        ]}
        payees={[{ id: 1, name: 'Cafe' }]}
        selectedIds={new Set<number>([3])}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isMobile
      />,
    )

    fireEvent.click(await screen.findByTestId('expense-row-mobile-1'))

    expect(onToggleSelect).toHaveBeenCalledTimes(1)
    expect(onToggleSelect).toHaveBeenCalledWith(1)
  })
})
