import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ScheduleModal from '../features/settings/ScheduleModal'
import { StorageService } from '../services/storageService'

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders expense type option in dropdown', () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Expense')).toBeInTheDocument()
  })

  it('shows expense fields (date, payee, category, description, amount) when type is expense', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)

    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: 'expense' } })

    await waitFor(() => {
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('Payee')).toBeInTheDocument()
      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('Amount')).toBeInTheDocument()
    })
  })

  it('does not show note field for expense type', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)

    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: 'expense' } })

    await waitFor(() => {
      expect(screen.queryByText('Note')).not.toBeInTheDocument()
    })
  })

  it('validates category is required for expense schedules', async () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)

    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: 'expense' } })

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

  it('shows note field for non-expense types', () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)
    // Default type is income
    expect(screen.getByText('Note')).toBeInTheDocument()
  })

  it('shows effective date label for non-expense types', () => {
    render(<ScheduleModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText('Effective Date')).toBeInTheDocument()
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

    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: 'savingsRate' } })

    const valueInput = screen.getByPlaceholderText('e.g. 25')
    fireEvent.change(valueInput, { target: { value: '101' } })

    const saveBtn = screen.getByText('Save Schedule')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Savings rate must be between 0 and 100.')).toBeInTheDocument()
    })
  })
})
