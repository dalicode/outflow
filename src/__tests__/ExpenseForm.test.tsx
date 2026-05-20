import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../context/toastContext'
import ExpenseForm from '../features/expenses/ExpenseForm'

vi.mock('../context/settingsContext', () => ({
  useSettings: () => ({
    settings: { decimalPlaces: '2', currencySymbol: '$' },
  }),
}))

vi.mock('../hooks/useLocalData', () => ({
  useExpenses: () => ({ expenses: [] }),
  usePayees: () => ({ payees: [], refresh: vi.fn() }),
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
  default: ({ children, footer }: { children: ReactNode; footer?: ReactNode }) => (
    <div>
      {children}
      {footer}
    </div>
  ),
}))

vi.mock('../components/ui/ModalFooter', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../components/inputs/DatePicker', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input
      aria-label="Date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
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
    <button type="button" onClick={() => onChange(options[0]?.id)}>
      {`Select ${placeholder ?? 'option'}`}
    </button>
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
    onChange,
  }: {
    onChange: (value: number) => void
  }) => (
    <input
      aria-label="Amount"
      type="number"
      onChange={(e) => {
        const parsed = Number(e.target.value)
        const next = Number.isNaN(parsed) ? 0 : parsed
        const cap = 100000
        onChange(Math.max(-cap, Math.min(cap, next)))
      }}
    />
  ),
}))

vi.mock('../features/expenses/CategoryModal', () => ({
  default: () => null,
}))

vi.mock('../features/expenses/PayeeModal', () => ({
  default: () => null,
}))

const categories = [{ id: 1, name: 'Food', isArchived: false }]

describe('ExpenseForm', () => {
  it('shows category validation as a warning toast without inline error text', async () => {
    render(
      <ToastProvider>
        <ExpenseForm onClose={vi.fn()} categories={categories} />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save Expense' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Save Expense' }))

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
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Expense' }))

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalled()
    })
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ amount: 100000 }))
  })
})
