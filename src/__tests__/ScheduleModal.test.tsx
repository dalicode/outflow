import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ScheduleModal from '../features/settings/ScheduleModal'

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
    settings: { dateFormat: 'MM/DD/YYYY' },
    formatDate: (iso: string) => iso,
    formatAmount: (n: number) => String(n),
    getNumberColorClass: () => 'text-theme-text',
  }),
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
})
