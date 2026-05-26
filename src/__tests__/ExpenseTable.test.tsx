import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  getActiveTags: vi.fn(),
  setExpenseTags: vi.fn<(expenseId: number, tagIds: number[]) => Promise<void>>(),
  addTag: vi.fn<(name: string) => Promise<number>>(),
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
    getActiveTags: storageMocks.getActiveTags,
    setExpenseTags: storageMocks.setExpenseTags,
    addTag: storageMocks.addTag,
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
    storageMocks.getActiveTags.mockReset()
    storageMocks.setExpenseTags.mockReset()
    storageMocks.addTag.mockReset()
    toastMocks.showToast.mockReset()
    storageMocks.getExpenseSplits.mockResolvedValue([])
    storageMocks.getAllExpenseSplits.mockResolvedValue([])
    storageMocks.getAllSplitChildExpenses.mockResolvedValue([])
    storageMocks.getActiveTags.mockResolvedValue([])
    storageMocks.setExpenseTags.mockResolvedValue()
    storageMocks.addTag.mockResolvedValue(999)
  })

  it('renders split container rows with grouped children and unsplit action', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
      { id: 3, date: '2026-05-09', amount: 5, categoryId: 1, notes: 'C' },
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

  it('shows a split parent checkbox that toggles all split children on desktop', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
      { id: 3, date: '2026-05-09', amount: 5, categoryId: 1, notes: 'Solo' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([{ id: 10, date: '2026-05-10', amount: 20 }])

    function TestHarness() {
      const [selectedIds, setSelectedIds] = useState(new Set<number>())

      return (
        <ExpenseTable
          expenses={expenses}
          categories={[
            { id: 1, name: 'Food' },
            { id: 2, name: 'Transport' },
          ]}
          payees={[]}
          selectedIds={selectedIds}
          onToggleSelect={(id) => {
            setSelectedIds((current) => {
              const next = new Set(current)
              if (next.has(id)) {
                next.delete(id)
              } else {
                next.add(id)
              }
              return next
            })
          }}
          onToggleSelectAll={vi.fn()}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      )
    }

    render(<TestHarness />)

    const splitRow = await screen.findByTestId('split-container-10')
    const splitCheckbox = within(splitRow).getByRole('checkbox', {
      name: 'Select split transaction',
    }) as HTMLInputElement

    expect(splitCheckbox.checked).toBe(false)

    fireEvent.click(splitCheckbox)

    const firstChildRow = await screen.findByTestId('split-child-1')
    const secondChildRow = await screen.findByTestId('split-child-2')

    await waitFor(() => {
      expect(splitCheckbox.checked).toBe(true)
      expect(within(firstChildRow).getByRole('checkbox')).toBeChecked()
      expect(within(secondChildRow).getByRole('checkbox')).toBeChecked()
      expect(splitRow).toHaveClass('selected-row')
    })
  })

  it('shows tags under the notes in mobile rows', async () => {
    const expenses: Expense[] = [
      { id: 1, date: '2026-05-10', amount: 20, categoryId: 1, payeeId: 1, notes: 'Lunch' },
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
    expect(within(mobileRow).getByText('Travel +1')).toBeInTheDocument()
  })

  it('renders desktop tags column summaries in read mode', async () => {
    storageMocks.getActiveTags.mockResolvedValue([
      { id: 101, name: 'Travel', isArchived: false },
      { id: 102, name: 'Work', isArchived: false },
      { id: 103, name: 'Home', isArchived: false },
    ])

    const expenses: Expense[] = [
      { id: 1, date: '2026-05-10', amount: 20, categoryId: 1, notes: 'No tag row' },
      { id: 2, date: '2026-05-09', amount: 12, categoryId: 1, notes: 'One tag row' },
      { id: 3, date: '2026-05-08', amount: 9, categoryId: 1, notes: 'Multi tag row' },
    ]

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[{ id: 1, name: 'Food' }]}
        payees={[]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        expenseTagsMap={{
          2: [{ id: 101, name: 'Travel', isArchived: false }],
          3: [
            { id: 102, name: 'Work', isArchived: false },
            { id: 103, name: 'Home', isArchived: false },
            { id: 101, name: 'Travel', isArchived: false },
          ],
        }}
      />,
    )

    const noTagRow = await screen.findByTestId('expense-row-1')
    const oneTagRow = screen.getByTestId('expense-row-2')
    const multiTagRow = screen.getByTestId('expense-row-3')

    expect(within(noTagRow).getByTestId('editable-cell-display-tags')).toBeEmptyDOMElement()
    expect(within(oneTagRow).getByTestId('editable-cell-display-tags')).toHaveTextContent('Travel')
    expect(within(multiTagRow).getByTestId('editable-cell-display-tags')).toHaveTextContent('Work +2')
    expect(screen.getByRole('columnheader', { name: 'Tags' })).toBeInTheDocument()
  })

  it('shows split parent tags as a deduped read-only aggregate summary', async () => {
    storageMocks.getActiveTags.mockResolvedValue([
      { id: 101, name: 'Travel', isArchived: false },
      { id: 102, name: 'Work', isArchived: false },
      { id: 103, name: 'Home', isArchived: false },
    ])
    storageMocks.getExpenseSplits.mockResolvedValue([{ id: 10, date: '2026-05-10', amount: 20 }])

    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
    ]

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
        expenseTagsMap={{
          1: [
            { id: 102, name: 'Work', isArchived: false },
            { id: 103, name: 'Home', isArchived: false },
          ],
          2: [
            { id: 103, name: 'Home', isArchived: false },
            { id: 101, name: 'Travel', isArchived: false },
          ],
        }}
      />,
    )

    const splitRow = await screen.findByTestId('split-container-10')
    const tagSummary = within(splitRow).getByText('Work +2')
    expect(tagSummary).toBeInTheDocument()

    fireEvent.pointerDown(tagSummary)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('stages tags edits with Save/Cancel for regular and split-child rows, including create', async () => {
    storageMocks.getActiveTags.mockResolvedValue([
      { id: 101, name: 'Work', isArchived: false },
      { id: 102, name: 'Home', isArchived: false },
    ])
    storageMocks.addTag.mockResolvedValue(777)
    storageMocks.getExpenseSplits.mockResolvedValue([{ id: 10, date: '2026-05-10', amount: 25 }])

    const expenses: Expense[] = [
      { id: 1, date: '2026-05-11', amount: 15, categoryId: 1, notes: 'Regular' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 10, categoryId: 1, notes: 'Split A' },
      { id: 3, splitId: 10, date: '2026-05-10', amount: 15, categoryId: 2, notes: 'Split B' },
    ]
    const triggerSync = vi.fn()

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
        triggerSync={triggerSync}
        expenseTagsMap={{
          1: [{ id: 101, name: 'Work', isArchived: false }],
          2: [{ id: 101, name: 'Work', isArchived: false }],
          3: [],
        }}
      />,
    )

    const regularRow = await screen.findByTestId('expense-row-1')
    fireEvent.pointerDown(within(regularRow).getByTestId('editable-cell-display-tags'))

    const firstEditorInput = await screen.findByRole('textbox')
    fireEvent.change(firstEditorInput, { target: { value: 'Home' } })
    fireEvent.keyDown(firstEditorInput, { key: 'Enter' })

    expect(storageMocks.setExpenseTags).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('tags-editor-save'))
    await waitFor(() => {
      expect(storageMocks.setExpenseTags).toHaveBeenCalledWith(1, [101, 102])
    })
    expect(triggerSync).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(within(regularRow).getByTestId('editable-cell-display-tags'))
    const secondEditorInput = await screen.findByRole('textbox')
    fireEvent.change(secondEditorInput, { target: { value: 'FreshTag' } })
    fireEvent.keyDown(secondEditorInput, { key: 'Enter' })

    await waitFor(() => {
      expect(storageMocks.addTag).toHaveBeenCalledWith('FreshTag')
    })
    await screen.findByText('FreshTag')
    expect(triggerSync).toHaveBeenCalledTimes(2)
    expect(storageMocks.setExpenseTags).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('tags-editor-cancel'))

    await waitFor(() => {
      expect(screen.queryByTestId('tags-editor-popover')).not.toBeInTheDocument()
    })
    expect(triggerSync).toHaveBeenCalledTimes(2)

    fireEvent.pointerDown(within(regularRow).getByTestId('editable-cell-display-tags'))
    const thirdEditorInput = await screen.findByRole('textbox')
    fireEvent.change(thirdEditorInput, { target: { value: 'FreshTag' } })
    fireEvent.keyDown(thirdEditorInput, { key: 'Enter' })
    await screen.findByText('FreshTag')
    fireEvent.click(screen.getByTestId('tags-editor-save'))
    await waitFor(() => expect(storageMocks.setExpenseTags).toHaveBeenCalledWith(1, [101, 777]))
    expect(triggerSync).toHaveBeenCalledTimes(4)

    const splitChildRow = await screen.findByTestId('split-child-2')
    fireEvent.pointerDown(within(splitChildRow).getByTestId('editable-cell-display-tags'))

    const splitEditorInput = await screen.findByRole('textbox')
    fireEvent.change(splitEditorInput, { target: { value: 'Home' } })
    fireEvent.keyDown(splitEditorInput, { key: 'Enter' })
    fireEvent.click(screen.getByTestId('tags-editor-save'))

    await waitFor(() => {
      expect(storageMocks.setExpenseTags).toHaveBeenCalledWith(2, [101, 102])
    })
    expect(triggerSync).toHaveBeenCalledTimes(5)
  })

  it.each([
    {
      label: 'date',
      getTarget: (row: HTMLElement) => within(row).getByTestId('editable-cell-display-date'),
      expectEditor: async () => {
        expect(await screen.findByDisplayValue('2026-05-10')).toBeInTheDocument()
      },
    },
    {
      label: 'payee',
      getTarget: (row: HTMLElement) => within(row).getByTestId('editable-cell-display-payeeId'),
      expectEditor: async () => {
        expect(await screen.findByRole('combobox')).toBeInTheDocument()
      },
    },
    {
      label: 'category',
      getTarget: (row: HTMLElement) => within(row).getByText('Food'),
      expectEditor: async () => {
        expect(await screen.findByRole('combobox')).toBeInTheDocument()
      },
    },
    {
      label: 'notes',
      getTarget: (row: HTMLElement) => within(row).getByTestId('editable-cell-display-notes'),
      expectEditor: async () => {
        expect(await screen.findByDisplayValue('Groceries')).toBeInTheDocument()
      },
    },
    {
      label: 'amount',
      getTarget: (row: HTMLElement) => within(row).getByText('$20.00'),
      expectEditor: async () => {
        const input = await screen.findByLabelText('Amount')
        expect(input).toBeInTheDocument()
        expect(input).toHaveValue('20.00')
      },
    },
  ])('dismisses the tags popover and opens the $label editor from the same click', async ({ getTarget, expectEditor }) => {
    const user = userEvent.setup()
    storageMocks.getActiveTags.mockResolvedValue([{ id: 101, name: 'Work', isArchived: false }])

    const expenses: Expense[] = [
      { id: 1, date: '2026-05-11', amount: 15, categoryId: 1, notes: 'Regular' },
      {
        id: 2,
        date: '2026-05-10',
        amount: 20,
        categoryId: 1,
        payeeId: 1,
        notes: 'Groceries',
      },
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
        expenseTagsMap={{
          1: [{ id: 101, name: 'Work', isArchived: false }],
        }}
      />,
    )

    const firstRow = await screen.findByTestId('expense-row-1')
    const secondRow = await screen.findByTestId('expense-row-2')

    fireEvent.pointerDown(within(firstRow).getByTestId('editable-cell-display-tags'))
    await screen.findByTestId('tags-editor-popover')

    await user.click(getTarget(secondRow))

    await waitFor(() => {
      expect(screen.queryByTestId('tags-editor-popover')).not.toBeInTheDocument()
    })
    await expectEditor()
  })

  it('discards unsaved tag drafts when switching to another editor', async () => {
    const user = userEvent.setup()
    storageMocks.getActiveTags.mockResolvedValue([
      { id: 101, name: 'Work', isArchived: false },
      { id: 102, name: 'Home', isArchived: false },
    ])

    const expenses: Expense[] = [
      { id: 1, date: '2026-05-11', amount: 15, categoryId: 1, notes: 'Regular' },
      { id: 2, date: '2026-05-10', amount: 20, categoryId: 1, notes: 'Groceries' },
    ]

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[{ id: 1, name: 'Food' }]}
        payees={[]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        expenseTagsMap={{
          1: [{ id: 101, name: 'Work', isArchived: false }],
        }}
      />,
    )

    const firstRow = await screen.findByTestId('expense-row-1')
    const secondRow = await screen.findByTestId('expense-row-2')

    fireEvent.pointerDown(within(firstRow).getByTestId('editable-cell-display-tags'))
    const editorInput = await screen.findByRole('textbox')
    fireEvent.change(editorInput, { target: { value: 'Home' } })
    fireEvent.keyDown(editorInput, { key: 'Enter' })
    await screen.findByText('Home')

    await user.click(within(secondRow).getByTestId('editable-cell-display-notes'))

    await waitFor(() => {
      expect(screen.queryByTestId('tags-editor-popover')).not.toBeInTheDocument()
    })
    expect(storageMocks.setExpenseTags).not.toHaveBeenCalled()
    expect(await screen.findByDisplayValue('Groceries')).toBeInTheDocument()
  })

  it('keeps the tags popover open while interacting inside it', async () => {
    storageMocks.getActiveTags.mockResolvedValue([{ id: 101, name: 'Work', isArchived: false }])

    const expenses: Expense[] = [
      { id: 1, date: '2026-05-11', amount: 15, categoryId: 1, notes: 'Regular' },
    ]

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[{ id: 1, name: 'Food' }]}
        payees={[]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        expenseTagsMap={{
          1: [{ id: 101, name: 'Work', isArchived: false }],
        }}
      />,
    )

    const row = await screen.findByTestId('expense-row-1')
    fireEvent.pointerDown(within(row).getByTestId('editable-cell-display-tags'))

    const editorInput = await screen.findByRole('textbox')
    fireEvent.pointerDown(editorInput)
    fireEvent.change(editorInput, { target: { value: 'Wo' } })

    expect(screen.getByTestId('tags-editor-popover')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Work/ })).toBeInTheDocument()
  })

  it('dismisses the tags popover when focus leaves the tag editor', async () => {
    storageMocks.getActiveTags.mockResolvedValue([{ id: 101, name: 'Work', isArchived: false }])

    const expenses: Expense[] = [
      { id: 1, date: '2026-05-11', amount: 15, categoryId: 1, notes: 'Regular' },
    ]

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[{ id: 1, name: 'Food' }]}
        payees={[]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        expenseTagsMap={{
          1: [{ id: 101, name: 'Work', isArchived: false }],
        }}
      />,
    )

    const row = await screen.findByTestId('expense-row-1')
    fireEvent.pointerDown(within(row).getByTestId('editable-cell-display-tags'))

    const editorInput = await screen.findByRole('textbox')
    fireEvent.blur(editorInput, { relatedTarget: null })

    await waitFor(() => {
      expect(screen.queryByTestId('tags-editor-popover')).not.toBeInTheDocument()
    })
  })

  it('dismisses the tags popover and opens a split field editor when clicking a split container cell', async () => {
    const user = userEvent.setup()
    storageMocks.getActiveTags.mockResolvedValue([{ id: 101, name: 'Work', isArchived: false }])
    storageMocks.getExpenseSplits.mockResolvedValue([{ id: 10, date: '2026-05-10', amount: 25, notes: '' }])

    const expenses: Expense[] = [
      { id: 1, date: '2026-05-11', amount: 15, categoryId: 1, notes: 'Regular' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 10, categoryId: 1, notes: 'Split A' },
      { id: 3, splitId: 10, date: '2026-05-10', amount: 15, categoryId: 2, notes: 'Split B' },
    ]

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
        expenseTagsMap={{
          1: [{ id: 101, name: 'Work', isArchived: false }],
        }}
      />,
    )

    const regularRow = await screen.findByTestId('expense-row-1')
    const splitRow = await screen.findByTestId('split-container-10')

    fireEvent.pointerDown(within(regularRow).getByTestId('editable-cell-display-tags'))
    await screen.findByTestId('tags-editor-popover')

    await user.click(within(splitRow).getByTestId('editable-cell-display-notes'))

    await waitFor(() => {
      expect(screen.queryByTestId('tags-editor-popover')).not.toBeInTheDocument()
    })
    expect(await screen.findByDisplayValue('')).toBeInTheDocument()
  })

  it('dismisses the tags popover and opens split parent date editor from the same click', async () => {
    const user = userEvent.setup()
    storageMocks.getActiveTags.mockResolvedValue([{ id: 101, name: 'Work', isArchived: false }])
    storageMocks.getExpenseSplits.mockResolvedValue([{ id: 10, date: '2026-05-10', amount: 25, notes: '' }])

    const expenses: Expense[] = [
      { id: 1, date: '2026-05-11', amount: 15, categoryId: 1, notes: 'Regular' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 10, categoryId: 1, notes: 'Split A' },
      { id: 3, splitId: 10, date: '2026-05-10', amount: 15, categoryId: 2, notes: 'Split B' },
    ]

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
        expenseTagsMap={{
          1: [{ id: 101, name: 'Work', isArchived: false }],
        }}
      />,
    )

    const regularRow = await screen.findByTestId('expense-row-1')
    const splitRow = await screen.findByTestId('split-container-10')

    fireEvent.pointerDown(within(regularRow).getByTestId('editable-cell-display-tags'))
    await screen.findByTestId('tags-editor-popover')

    await user.click(within(splitRow).getByText('2026-05-10'))

    await waitFor(() => {
      expect(screen.queryByTestId('tags-editor-popover')).not.toBeInTheDocument()
    })
    expect(await screen.findByRole('textbox')).toBeInTheDocument()
  })

  it('dismisses the tags popover and opens split parent payee editor from the same click', async () => {
    const user = userEvent.setup()
    storageMocks.getActiveTags.mockResolvedValue([{ id: 101, name: 'Work', isArchived: false }])
    storageMocks.getExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 25, notes: '', payeeId: undefined, payeeNameSnapshot: null },
    ])

    const expenses: Expense[] = [
      { id: 1, date: '2026-05-11', amount: 15, categoryId: 1, notes: 'Regular' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 10, categoryId: 1, notes: 'Split A' },
      { id: 3, splitId: 10, date: '2026-05-10', amount: 15, categoryId: 2, notes: 'Split B' },
    ]

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
        expenseTagsMap={{
          1: [{ id: 101, name: 'Work', isArchived: false }],
        }}
      />,
    )

    const regularRow = await screen.findByTestId('expense-row-1')
    const splitRow = await screen.findByTestId('split-container-10')

    fireEvent.pointerDown(within(regularRow).getByTestId('editable-cell-display-tags'))
    await screen.findByTestId('tags-editor-popover')

    await user.click(within(splitRow).getByText('No payee'))

    await waitFor(() => {
      expect(screen.queryByTestId('tags-editor-popover')).not.toBeInTheDocument()
    })
    expect(await screen.findByRole('combobox')).toBeInTheDocument()
  })

  it('blocks bulk edit when multi-select includes split allocations', async () => {
    const ref = createRef<ExpenseTableHandle>()
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, date: '2026-05-09', amount: 5, categoryId: 1, notes: 'C' },
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
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
    ]
    const splits: ExpenseSplit[] = [
      { id: 10, date: '2026-05-10', amount: 20, notes: 'Lunch' },
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
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
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
    const splits: ExpenseSplit[] = [{ id: 10, date: '2026-05-10', amount: 20, notes: '' }]
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
      'editable-cell-display-notes',
    )

    fireEvent.pointerDown(dash)
    const input = await screen.findByDisplayValue('')
    fireEvent.change(input, { target: { value: 'Shared receipt' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(storageMocks.updateExpenseSplit).toHaveBeenCalledWith(10, {
        notes: 'Shared receipt',
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
        notes: 'A',
      },
      {
        id: 2,
        splitId: 10,
        date: '2026-05-10',
        amount: 8,
        categoryId: 2,
        payeeId: 1,
        notes: 'B',
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
        notes: 'A',
      },
      {
        id: 2,
        splitId: 10,
        date: '2026-05-10',
        amount: 8,
        categoryId: 2,
        payeeId: 1,
        notes: 'B',
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
        notes: 'A',
      },
      {
        id: 2,
        splitId: 10,
        date: '2026-05-10',
        amount: 8,
        categoryId: 2,
        payeeId: 1,
        notes: 'B',
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

  it('persists notes edits when switching directly to another row editor', async () => {
    const initialExpenses: Expense[] = [
      { id: 1, date: '2026-05-10', amount: 12, categoryId: 1, notes: '' },
      { id: 2, date: '2026-05-09', amount: 8, categoryId: 1, notes: 'Groceries' },
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

    fireEvent.pointerDown(within(firstRow).getByTestId('editable-cell-display-notes'))
    const input = await screen.findByDisplayValue('')
    fireEvent.change(input, { target: { value: 'Coffee' } })
    fireEvent.pointerDown(within(secondRow).getByText('Groceries'))

    await waitFor(() => {
      expect(within(firstRow).getByText('Coffee')).toBeInTheDocument()
    })
    expect(await screen.findByDisplayValue('Groceries')).toBeInTheDocument()
  })

  it('keeps empty notes blank and still opens notes and tags editors from the cell', async () => {
    storageMocks.getActiveTags.mockResolvedValue([{ id: 101, name: 'Work', isArchived: false }])

    const expenses: Expense[] = [{ id: 1, date: '2026-05-10', amount: 12, categoryId: 1, notes: '' }]

    const view = render(
      <ExpenseTable
        expenses={expenses}
        categories={[{ id: 1, name: 'Food' }]}
        payees={[]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const row = await screen.findByTestId('expense-row-1')
    const notesCell = within(row).getByTestId('editable-cell-display-notes')

    expect(notesCell).toBeEmptyDOMElement()

    fireEvent.pointerDown(notesCell)
    expect(await screen.findByDisplayValue('')).toBeInTheDocument()

    view.unmount()

    render(
      <ExpenseTable
        expenses={expenses}
        categories={[{ id: 1, name: 'Food' }]}
        payees={[]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const tagsOnlyRow = await screen.findByTestId('expense-row-1')
    fireEvent.pointerDown(within(tagsOnlyRow).getByTestId('editable-cell-display-tags'))
    expect(await screen.findByTestId('tags-editor-popover')).toBeInTheDocument()
  })

  it('prefers opening the tags popover below when there is still usable space', async () => {
    storageMocks.getActiveTags.mockResolvedValue([{ id: 101, name: 'Work', isArchived: false }])

    const originalInnerHeight = window.innerHeight
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 700,
    })

    render(
      <ExpenseTable
        expenses={[{ id: 1, date: '2026-05-10', amount: 12, categoryId: 1, notes: '' }]}
        categories={[{ id: 1, name: 'Food' }]}
        payees={[]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    try {
      const row = await screen.findByTestId('expense-row-1')
      const tagsCell = within(row).getByTestId('editable-cell-display-tags')
      const tableCell = tagsCell.closest('td')

      expect(tableCell).not.toBeNull()

      vi.spyOn(tableCell as HTMLTableCellElement, 'getBoundingClientRect').mockReturnValue({
        x: 40,
        y: 400,
        top: 400,
        left: 40,
        right: 220,
        bottom: 560,
        width: 180,
        height: 160,
        toJSON: () => ({}),
      } as DOMRect)

      fireEvent.pointerDown(tagsCell)

      expect((await screen.findByTestId('tags-editor-popover')).dataset.placement).toBe('bottom')
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      })
      vi.restoreAllMocks()
    }
  })

  it('opens the tags popover above when there is not enough usable space below', async () => {
    storageMocks.getActiveTags.mockResolvedValue([{ id: 101, name: 'Work', isArchived: false }])

    const originalInnerHeight = window.innerHeight
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 700,
    })

    render(
      <ExpenseTable
        expenses={[{ id: 1, date: '2026-05-10', amount: 12, categoryId: 1, notes: '' }]}
        categories={[{ id: 1, name: 'Food' }]}
        payees={[]}
        selectedIds={new Set<number>()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    try {
      const row = await screen.findByTestId('expense-row-1')
      const tagsCell = within(row).getByTestId('editable-cell-display-tags')
      const tableCell = tagsCell.closest('td')

      expect(tableCell).not.toBeNull()

      vi.spyOn(tableCell as HTMLTableCellElement, 'getBoundingClientRect').mockReturnValue({
        x: 40,
        y: 430,
        top: 430,
        left: 40,
        right: 220,
        bottom: 580,
        width: 180,
        height: 150,
        toJSON: () => ({}),
      } as DOMRect)

      fireEvent.pointerDown(tagsCell)

      expect((await screen.findByTestId('tags-editor-popover')).dataset.placement).toBe('top')
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      })
      vi.restoreAllMocks()
    }
  })

  it('persists split notes edits when switching directly to another split editor', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
      { id: 3, splitId: 20, date: '2026-05-09', amount: 7, categoryId: 1, notes: 'C' },
      { id: 4, splitId: 20, date: '2026-05-09', amount: 3, categoryId: 2, notes: 'D' },
    ]
    const splits: ExpenseSplit[] = [
      { id: 10, date: '2026-05-10', amount: 20, notes: '' },
      { id: 20, date: '2026-05-09', amount: 10, notes: 'Second split' },
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

    fireEvent.pointerDown(within(firstSplitRow).getByTestId('editable-cell-display-notes'))
    const input = await screen.findByDisplayValue('')
    fireEvent.change(input, { target: { value: 'Shared receipt' } })
    fireEvent.pointerDown(within(secondSplitRow).getByText('Second split'))

    await waitFor(() => {
      expect(storageMocks.updateExpenseSplit).toHaveBeenCalledWith(10, {
        notes: 'Shared receipt',
      })
    })
    expect(screen.getByText('Second split')).toBeInTheDocument()
  })

  it('provides parent split mobile unsplit action when one full split is selected', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
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
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
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
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
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
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 20, notes: 'Trip food' },
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

  it('does not collapse split children when tapping split notes text on mobile', async () => {
    const expenses: Expense[] = [
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 20, notes: 'Trip food' },
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
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 20, notes: 'Trip food' },
    ])
    storageMocks.getAllExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 20, notes: 'Trip food' },
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
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 20, notes: 'Trip food' },
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
      { id: 1, splitId: 10, date: '2026-05-10', amount: 12, categoryId: 1, notes: 'A' },
      { id: 2, splitId: 10, date: '2026-05-10', amount: 8, categoryId: 2, notes: 'B' },
      { id: 3, date: '2026-05-09', amount: 5, categoryId: 1, notes: 'Solo' },
    ]
    storageMocks.getExpenseSplits.mockResolvedValue([
      { id: 10, date: '2026-05-10', amount: 20, notes: 'Trip food' },
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
