import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRef } from 'react'
import ExpenseTable from '../features/dashboard/ExpenseTable'
import type { Category, Expense, ExpenseSplit, Payee } from '../types'
import type { ExpenseTableHandle } from '../features/dashboard/ExpenseTable'

const storageMocks = vi.hoisted(() => ({
  getExpenseSplits: vi.fn<() => Promise<ExpenseSplit[]>>(),
  getAllExpenseSplits: vi.fn<() => Promise<ExpenseSplit[]>>(),
  getAllSplitChildExpenses: vi.fn<(splitId: number) => Promise<Expense[]>>(),
  unsplitExpenseSplit: vi.fn<(id: number) => Promise<void>>(),
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
    unsplitExpenseSplit: storageMocks.unsplitExpenseSplit,
    addCategory: vi.fn(),
    addPayee: vi.fn(),
  },
}))

describe('ExpenseTable', () => {
  beforeEach(() => {
    storageMocks.getExpenseSplits.mockReset()
    storageMocks.getAllExpenseSplits.mockReset()
    storageMocks.getAllSplitChildExpenses.mockReset()
    storageMocks.unsplitExpenseSplit.mockReset()
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
    storageMocks.getExpenseSplits.mockResolvedValue([{ id: 10, date: '2026-05-10', amount: 20 }])
    storageMocks.unsplitExpenseSplit.mockResolvedValue()

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
      />,
    )

    await waitFor(() => expect(screen.getByTestId('split-container-10')).toBeInTheDocument())
    expect(screen.getByText('Split')).toBeInTheDocument()
    expect(screen.getAllByText('2026-05-10')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { expanded: true }))
    expect(screen.queryByTestId('split-child-1')).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByTestId('split-container-10'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Unsplit transaction' }))
    expect(storageMocks.unsplitExpenseSplit).toHaveBeenCalledWith(10)
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
})
