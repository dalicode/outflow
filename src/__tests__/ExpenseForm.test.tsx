import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../context/toastContext'
import ExpenseForm from '../features/expenses/ExpenseForm'

let mockPayees: Array<{ id: number; name: string; isArchived?: boolean }> = []

vi.mock('../context/settingsContext', () => ({
  useSettings: () => ({
    settings: { decimalPlaces: '2', currencySymbol: '$' },
    formatAmount: (value: number) => `$${value.toFixed(2)}`,
  }),
}))

vi.mock('../hooks/useLocalData', () => ({
  useExpenses: () => ({ expenses: [] }),
  usePayees: () => ({ payees: mockPayees, refresh: vi.fn() }),
  useTags: () => ({ tags: [], refresh: vi.fn() }),
}))

const hapticsError = vi.fn()
const hapticsSuccess = vi.fn()
vi.mock('../hooks/useHaptics', () => ({
  useHaptics: () => ({ error: hapticsError, success: hapticsSuccess }),
}))

vi.mock('../hooks/useViewportWidth', () => ({
  useViewportWidth: () => 1024,
}))

vi.mock('../components/ui/Modal', () => ({
  default: ({
    isOpen = true,
    children,
    footer,
  }: {
    isOpen?: boolean
    children: ReactNode
    footer?: ReactNode
  }) =>
    isOpen ? (
      <div>
        {children}
        {footer}
      </div>
    ) : null,
}))

vi.mock('../components/ui/ModalFooter', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../components/inputs/DatePicker', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="Date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

vi.mock('../components/inputs/DesktopDropdown', () => ({
  default: ({
    options,
    placeholder,
    onChange,
  }: {
    options: Array<{ id: number; label: string }>
    placeholder?: string
    onChange: (id?: number) => void
  }) => (
    <div>
      <button type="button" onClick={() => onChange(options[0]?.id)}>
        {`Select ${placeholder ?? 'option'}`}
      </button>
      <button
        type="button"
        aria-label={`Select alternate ${placeholder ?? 'option'}`}
        onClick={() => onChange(options[1]?.id)}
      >
        Select alternate
      </button>
    </div>
  ),
}))

vi.mock('../components/inputs/SingleSelectTrigger', () => ({
  default: () => null,
}))

vi.mock('../components/inputs/MobileEntityPicker', () => ({
  default: () => null,
}))

vi.mock('../components/inputs/MoneyInput', () => ({
  default: ({
    label,
    value,
    onChange,
  }: {
    label?: string
    value: number
    onChange: (value: number) => void
  }) => (
    <input
      aria-label={label ?? 'Amount'}
      type="number"
      value={value}
      onChange={(e) => {
        const parsed = Number(e.target.value)
        const next = Number.isNaN(parsed) ? 0 : parsed
        const cap = 100000
        onChange(Math.max(-cap, Math.min(cap, next)))
      }}
    />
  ),
}))

vi.mock('../components/inputs/TagMultiSelect', () => ({
  default: ({
    onCreate,
  }: {
    onCreate?: (name: string) => Promise<number>
  }) => (
    <button
      type="button"
      onClick={() => {
        void onCreate?.('FreshTag')
      }}
    >
      Create tag
    </button>
  ),
}))

vi.mock('../features/expenses/CategoryModal', () => ({
  default: () => null,
}))

vi.mock('../features/expenses/PayeeModal', () => ({
  default: () => null,
}))

vi.mock('../services/storageService', () => ({
  StorageService: {
    add: vi.fn(async () => 1),
    update: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    addExpenseSplit: vi.fn(async () => 100),
    updateExpenseSplit: vi.fn(async () => {}),
    saveExpenseSplitWithChildren: vi.fn(async () => 100),
    getSplitChildExpenses: vi.fn(async () => [{ id: 101 }, { id: 102 }]),
    getAllExpenseSplits: vi.fn(async () => []),
    getAllSplitChildExpenses: vi.fn(async () => []),
    addPayee: vi.fn(async () => 1),
    addCategory: vi.fn(async () => 1),
    getTagIdsForExpense: vi.fn(async () => []),
    setExpenseTags: vi.fn(async () => undefined),
    setTagsForExpenses: vi.fn(async () => undefined),
    addTag: vi.fn(async () => 1),
  },
}))

import { StorageService } from '../services/storageService'

const categories = [
  { id: 1, name: 'Food', isArchived: false },
  { id: 2, name: 'Travel', isArchived: false },
]

const getContainerAmountInput = (): HTMLInputElement => {
  return screen.getByRole('spinbutton', { name: 'Amount' }) as HTMLInputElement
}

const selectSplitCategoryFromDesktopDropdown = (rowIndex: number, optionIndex = 0): void => {
  const wrapper = screen.getByTestId(`desktop-split-category-dropdown-${rowIndex}`)
  if (optionIndex === 1) {
    fireEvent.click(within(wrapper).getByRole('button', { name: /Select alternate/ }))
    return
  }
  fireEvent.click(within(wrapper).getByRole('button', { name: 'Select Select category' }))
}

describe('ExpenseForm', () => {
  beforeEach(() => {
    mockPayees = []
    vi.clearAllMocks()
  })

  it('shows category validation as a warning toast without inline error text', async () => {
    render(
      <ToastProvider>
        <ExpenseForm onClose={vi.fn()} categories={categories} />
      </ToastProvider>,
    )

    fireEvent.submit(screen.getByTestId('expense-form'))

    await waitFor(() => {
      expect(screen.getByText('Please select a category.')).toBeInTheDocument()
    })
    expect(screen.queryByText('Amount cannot be zero.')).not.toBeInTheDocument()
  })

  it('shows amount validation as a warning toast when category is selected', async () => {
    render(
      <ToastProvider>
        <ExpenseForm onClose={vi.fn()} categories={categories} />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select Select category' }))
    fireEvent.submit(screen.getByTestId('expense-form'))

    await waitFor(() => {
      expect(screen.getByText('Amount cannot be zero.')).toBeInTheDocument()
    })
    expect(screen.queryByText('Please select a category.')).not.toBeInTheDocument()
  })

  it('clamps oversized amount via money input before submit', async () => {
    const onAdd = vi.fn()
    render(
      <ToastProvider>
        <ExpenseForm onClose={vi.fn()} categories={categories} onAdd={onAdd} />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select Select category' }))
    fireEvent.change(screen.getByLabelText(/^Amount$/), { target: { value: '100001' } })
    fireEvent.submit(screen.getByTestId('expense-form'))

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalled()
    })
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ amount: 100000 }))
  })

  it('creates split children and persists a split transaction', async () => {
    render(
      <ToastProvider>
        <ExpenseForm onClose={vi.fn()} categories={categories} />
      </ToastProvider>,
    )

    expect(screen.getByRole('checkbox', { name: 'Enable split transaction' })).not.toBeChecked()
    fireEvent.click(screen.getByTestId('toggle-split-mode'))
    expect(screen.getByRole('checkbox', { name: 'Enable split transaction' })).toBeChecked()
    expect(screen.getByLabelText('Split amount 1')).toHaveValue(0)

    fireEvent.change(getContainerAmountInput(), { target: { value: '10' } })
    selectSplitCategoryFromDesktopDropdown(0)
    fireEvent.change(screen.getByLabelText('Split amount 1'), { target: { value: '10' } })
    fireEvent.submit(screen.getByTestId('expense-form'))

    await waitFor(() => {
      expect(StorageService.saveExpenseSplitWithChildren).toHaveBeenCalledTimes(1)
    })

    expect(StorageService.saveExpenseSplitWithChildren).toHaveBeenCalledWith(
      expect.objectContaining({
        split: expect.objectContaining({ amount: 10 }),
        children: [expect.objectContaining({ categoryId: 1, amount: 10 })],
      }),
    )
  })

  it('queues sync when creating a tag from the expense form', async () => {
    const triggerSync = vi.fn()

    render(
      <ToastProvider>
        <ExpenseForm onClose={vi.fn()} categories={categories} triggerSync={triggerSync} />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create tag' }))

    await waitFor(() => {
      expect(StorageService.addTag).toHaveBeenCalledWith('FreshTag')
    })
    expect(triggerSync).toHaveBeenCalledTimes(1)
  })

  it('selects split category through desktop dropdown wrapper', async () => {
    render(
      <ToastProvider>
        <ExpenseForm onClose={vi.fn()} categories={categories} />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByTestId('toggle-split-mode'))
    fireEvent.change(getContainerAmountInput(), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Split amount 1'), { target: { value: '10' } })

    expect(screen.getByTestId('desktop-split-category-dropdown-0')).toBeInTheDocument()
    selectSplitCategoryFromDesktopDropdown(0)
    fireEvent.submit(screen.getByTestId('expense-form'))

    await waitFor(() => {
      expect(StorageService.saveExpenseSplitWithChildren).toHaveBeenCalledTimes(1)
    })
    expect(StorageService.saveExpenseSplitWithChildren).toHaveBeenCalledWith(
      expect.objectContaining({
        children: [expect.objectContaining({ categoryId: 1 })],
      }),
    )
  })

  it('shows unresolved split modal and distributes before saving', async () => {
    render(
      <ToastProvider>
        <ExpenseForm onClose={vi.fn()} categories={categories} />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByTestId('toggle-split-mode'))
    fireEvent.click(screen.getByTestId('btn-add-split-row'))

    fireEvent.change(getContainerAmountInput(), { target: { value: '10' } })
    selectSplitCategoryFromDesktopDropdown(0)
    selectSplitCategoryFromDesktopDropdown(1, 1)
    fireEvent.submit(screen.getByTestId('expense-form'))

    expect(StorageService.saveExpenseSplitWithChildren).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Distribute' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Distribute' }))

    await waitFor(() => {
      expect(StorageService.saveExpenseSplitWithChildren).toHaveBeenCalledTimes(1)
    })

    expect(StorageService.saveExpenseSplitWithChildren).toHaveBeenCalledWith(
      expect.objectContaining({
        children: [
          expect.objectContaining({ amount: 5 }),
          expect.objectContaining({ amount: 5 }),
        ],
      }),
    )
  })

  it('applies remaining amount to a selected split child row', async () => {
    render(
      <ToastProvider>
        <ExpenseForm onClose={vi.fn()} categories={categories} />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByTestId('toggle-split-mode'))
    fireEvent.click(screen.getByTestId('btn-add-split-row'))

    fireEvent.change(getContainerAmountInput(), { target: { value: '10' } })
    selectSplitCategoryFromDesktopDropdown(0)
    selectSplitCategoryFromDesktopDropdown(1, 1)
    fireEvent.change(screen.getByLabelText('Split amount 1'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('btn-apply-remaining-1'))

    await waitFor(() => {
      expect(screen.getByLabelText('Split amount 2')).toHaveValue(7)
      expect(screen.getByTestId('split-balanced')).toHaveTextContent('Balanced')
    })
  })

  it('blocks split persistence until reconciliation is resolved', async () => {
    render(
      <ToastProvider>
        <ExpenseForm onClose={vi.fn()} categories={categories} />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByTestId('toggle-split-mode'))
    fireEvent.change(getContainerAmountInput(), { target: { value: '10' } })
    selectSplitCategoryFromDesktopDropdown(0)
    fireEvent.change(screen.getByLabelText('Split amount 1'), { target: { value: '6' } })
    fireEvent.submit(screen.getByTestId('expense-form'))

    expect(StorageService.saveExpenseSplitWithChildren).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Distribute' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(StorageService.saveExpenseSplitWithChildren).not.toHaveBeenCalled()
  })

  it('requires a category on every split row before save', async () => {
    render(
      <ToastProvider>
        <ExpenseForm onClose={vi.fn()} categories={categories} />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByTestId('toggle-split-mode'))
    fireEvent.change(getContainerAmountInput(), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Split amount 1'), { target: { value: '10' } })
    fireEvent.submit(screen.getByTestId('expense-form'))

    await waitFor(() => {
      expect(screen.getByText('Select a category for each split row.')).toBeInTheDocument()
    })
    expect(StorageService.saveExpenseSplitWithChildren).not.toHaveBeenCalled()
  })

  it('saves split edits through the atomic split persistence API', async () => {
    mockPayees = [
      { id: 1, name: 'Old Merchant', isArchived: false },
      { id: 2, name: 'Cafe Nova', isArchived: false },
    ]
    vi.mocked(StorageService.getAllExpenseSplits).mockResolvedValue([
      {
        id: 77,
        date: '2026-02-01',
        payeeId: 1,
        notes: 'Split container',
        amount: 10,
      },
    ])
    vi.mocked(StorageService.getAllSplitChildExpenses).mockResolvedValue([
      { id: 201, splitId: 77, date: '2026-02-01', amount: 4, categoryId: 1, payeeId: 1 },
      { id: 202, splitId: 77, date: '2026-02-01', amount: 6, categoryId: 2, payeeId: 1 },
    ])

    render(
      <ToastProvider>
        <ExpenseForm
          onClose={vi.fn()}
          categories={categories}
          initialExpense={{
            id: 201,
            splitId: 77,
            date: '2026-02-01',
            amount: 4,
            categoryId: 1,
            payeeId: 1,
          }}
        />
      </ToastProvider>,
    )

    await waitFor(() => {
      expect(StorageService.getAllSplitChildExpenses).toHaveBeenCalledWith(77)
    })

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-02-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Select Select payee' }))
    selectSplitCategoryFromDesktopDropdown(0)
    selectSplitCategoryFromDesktopDropdown(1, 1)
    fireEvent.submit(screen.getByTestId('expense-form'))

    await waitFor(() => {
      expect(StorageService.saveExpenseSplitWithChildren).toHaveBeenCalledWith(
        expect.objectContaining({
          splitId: 77,
          split: expect.objectContaining({
            date: '2026-02-15',
            payeeId: 2,
            amount: 10,
          }),
        }),
      )
    })

    expect(StorageService.saveExpenseSplitWithChildren).toHaveBeenCalledWith(
      expect.objectContaining({
        children: [
          expect.objectContaining({ expenseId: 201, categoryId: 1, payeeId: 2, amount: 4 }),
          expect.objectContaining({ expenseId: 202, categoryId: 2, payeeId: 2, amount: 6 }),
        ],
      }),
    )
  })

  it('shows a toast when distribute-save fails', async () => {
    const onClose = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(StorageService.saveExpenseSplitWithChildren).mockRejectedValueOnce(new Error('boom'))

    render(
      <ToastProvider>
        <ExpenseForm onClose={onClose} categories={categories} />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByTestId('toggle-split-mode'))
    fireEvent.click(screen.getByTestId('btn-add-split-row'))
    fireEvent.change(getContainerAmountInput(), { target: { value: '10' } })
    selectSplitCategoryFromDesktopDropdown(0)
    selectSplitCategoryFromDesktopDropdown(1, 1)
    fireEvent.submit(screen.getByTestId('expense-form'))
    fireEvent.click(screen.getByRole('button', { name: 'Distribute' }))

    await waitFor(() => {
      expect(screen.getByText('Could not save split transaction.')).toBeInTheDocument()
    })

    expect(onClose).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
