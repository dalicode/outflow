import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ScheduleModal from '../features/settings/ScheduleModal'
import { StorageService } from '../services/storageService'

vi.mock('../services/storageService', () => ({
  StorageService: {
    getActiveFixedExpenses: vi.fn(() => Promise.resolve([])),
    getCategories: vi.fn(() => Promise.resolve([
      { id: 1, name: 'Groceries' },
      { id: 2, name: 'Entertainment' },
    ])),
    addCategory: vi.fn(() => Promise.resolve(3)),
    addSchedule: vi.fn(() => Promise.resolve(1)),
    updateSchedule: vi.fn(() => Promise.resolve()),
  },
}))

describe('ScheduleModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders expense type option in dropdown', () => {
    render(
      <ScheduleModal isOpen={true} onClose={vi.fn()} />,
    )
    expect(screen.getByText('Expense')).toBeInTheDocument()
  })

  it('shows category dropdown and date picker when type is expense', async () => {
    render(
      <ScheduleModal isOpen={true} onClose={vi.fn()} />,
    )

    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: 'expense' } })

    await waitFor(() => {
      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Date')).toBeInTheDocument()
    })
  })

  it('validates category is required for expense schedules', async () => {
    render(
      <ScheduleModal isOpen={true} onClose={vi.fn()} />,
    )

    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: 'expense' } })

    const amountInput = screen.getByPlaceholderText('e.g. 6000')
    fireEvent.change(amountInput, { target: { value: '50' } })

    const saveBtn = screen.getByText('Save Schedule')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Please select a category.')).toBeInTheDocument()
    })
  })

  it('displays category options in dropdown', async () => {
    render(
      <ScheduleModal isOpen={true} onClose={vi.fn()} />,
    )

    const typeSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(typeSelect, { target: { value: 'expense' } })

    await waitFor(() => {
      expect(screen.getByText('Category')).toBeInTheDocument()
    })

    // Open the CreatableCombobox dropdown
    const categoryInput = screen.getByPlaceholderText('Search or add category…')
    fireEvent.focus(categoryInput)
    fireEvent.keyDown(categoryInput, { key: 'ArrowDown' })

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
      expect(screen.getByText('Entertainment')).toBeInTheDocument()
    })
  })
})
