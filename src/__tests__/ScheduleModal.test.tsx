import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ScheduleModal from '../features/settings/ScheduleModal'
import { StorageService } from '../services/storageService'

const mockExpenses = [
  { id: 101, date: '2026-05-20', categoryId: 1, payeeId: 1 },
  { id: 102, date: '2026-05-18', categoryId: 2, payeeId: 2 },
]

vi.mock('../services/storageService', () => ({
  StorageService: {
    getActiveFixedExpenses: vi.fn(() => Promise.resolve([])),
    getCategories: vi.fn(() =>
      Promise.resolve([
        { id: 1, name: 'Groceries' },
        { id: 2, name: 'Entertainment' },
      ]),
    ),
    getPayees: vi.fn(() =>
      Promise.resolve([
        { id: 1, name: 'Amazon' },
        { id: 2, name: 'Supermarket' },
      ]),
    ),
    addCategory: vi.fn(() => Promise.resolve(3)),
    addPayee: vi.fn(() => Promise.resolve(3)),
    addSchedule: vi.fn(() => Promise.resolve(1)),
    updateSchedule: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('../context/settingsContext', () => ({
  useSettings: () => ({
    settings: { dateFormat: 'MM/DD/YYYY', currencySymbol: '$' },
    formatDate: (iso: string) => iso,
    formatAmount: (n: number) => String(n),
    getNumberColorClass: () => 'text-theme-text',
  }),
}))

vi.mock('../hooks/useLocalData', () => ({
  useExpenses: () => ({
    expenses: mockExpenses,
  }),
  usePayees: () => ({
    payees: [
      { id: 1, name: 'Amazon' },
      { id: 2, name: 'Supermarket' },
    ],
    refresh: vi.fn(() => Promise.resolve()),
  }),
}))

vi.mock('../components/inputs/MoneyInput', () => ({
  default: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: number
    onChange: (value: number) => void
    placeholder?: string
    disabled?: boolean
  }) => (
    <input
      aria-label="Amount"
      type="number"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => {
        const parsed = Number(e.target.value)
        const next = Number.isNaN(parsed) ? 0 : parsed
        const cap = 100000
        onChange(Math.max(-cap, Math.min(cap, next)))
      }}
    />
  ),
}))

describe('ScheduleModal', () => {
  const openTypeDropdown = (): void => {
    fireEvent.click(screen.getByRole('button', { name: 'Schedule type' }))
  }

  const selectScheduleType = async (label: string): Promise<void> => {
    openTypeDropdown()
    fireEvent.click(await screen.findByRole('button', { name: label }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders expense type option in dropdown', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)
    openTypeDropdown()
    expect(await screen.findByRole('button', { name: 'Expense' })).toBeInTheDocument()
    await waitFor(() => expect(StorageService.getCategories).toHaveBeenCalled())
  })

  it('shows expense fields (date, payee, category, notes, amount) when type is expense', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)

    await selectScheduleType('Expense')

    await waitFor(() => {
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('Payee')).toBeInTheDocument()
      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Notes')).toBeInTheDocument()
      expect(screen.getByText('Amount')).toBeInTheDocument()
    })
  })

  it('shows notes field for expense type', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)

    await selectScheduleType('Expense')

    await waitFor(() => {
      expect(screen.getByText('Notes')).toBeInTheDocument()
    })
  })

  it('shows recent payees in the expense schedule payee dropdown', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)

    await selectScheduleType('Expense')
    fireEvent.click(screen.getAllByRole('button', { name: 'Select payee' })[0])

    expect(await screen.findByText('Recent')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Amazon' })).toBeInTheDocument()
  })

  it('auto-selects a payee from notes using the expense form matching logic', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)

    await selectScheduleType('Expense')

    const notesInput = screen.getByTestId('schedule-notes-input')
    fireEvent.change(notesInput, { target: { value: 'Amazon marketplace order' } })
    fireEvent.blur(notesInput)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Amazon' }).length).toBeGreaterThan(0)
    })
  })

  it('validates category is required for expense schedules', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)

    await selectScheduleType('Expense')

    await waitFor(() => {
      expect(screen.getByText('Amount')).toBeInTheDocument()
    })

    const amountInput = screen.getByPlaceholderText('0.00')
    fireEvent.change(amountInput, { target: { value: '50' } })

    const saveBtn = screen.getByText('Save Schedule')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Please select a category.')).toBeInTheDocument()
    })
  })

  it('shows notes field for non-expense types', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)
    // Default type is income
    expect(screen.getByText('Notes')).toBeInTheDocument()
    await waitFor(() => expect(StorageService.getCategories).toHaveBeenCalled())
  })

  it('shows effective date label for non-expense types', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Effective Date')).toBeInTheDocument()
    await waitFor(() => expect(StorageService.getCategories).toHaveBeenCalled())
  })

  it('closes an open desktop dropdown when clicking elsewhere inside the modal', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)

    openTypeDropdown()
    expect(await screen.findByRole('button', { name: 'Expense' })).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByText('Add Schedule'))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Expense' })).not.toBeInTheDocument()
    })
  })

  it('clamps oversized amount via money input before schedule save', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)

    const valueInput = screen.getByPlaceholderText('e.g. 6000')
    fireEvent.change(valueInput, { target: { value: '100001' } })

    const saveBtn = screen.getByText('Save Schedule')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(StorageService.addSchedule).toHaveBeenCalled()
    })
    expect(StorageService.addSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ newValue: 100000 }),
    )
  })

  it('keeps savings rate validation independent of money cap', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)

    await selectScheduleType('Auto Savings %')

    const valueInput = screen.getByPlaceholderText('e.g. 25')
    fireEvent.change(valueInput, { target: { value: '101' } })

    const saveBtn = screen.getByText('Save Schedule')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Savings rate must be between 0 and 100.')).toBeInTheDocument()
    })
  })
})
