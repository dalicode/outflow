import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BudgetFlow from '../features/summary/BudgetFlow'
import type { MonthlySummary } from '../types'

vi.mock('../context/settingsContext', () => ({
  useSettings: () => ({
    formatAmount: (n: number) => `$${n.toFixed(2)}`,
    settings: { currencySymbol: '$' },
    privacyModeEnabled: false,
    togglePrivacyMode: vi.fn(),
    currentTheme: {
      colors: {
        text: '#111111',
        success: '#0f9d58',
        danger: '#d93025',
        muted: '#6b7280',
        primary: '#2563eb',
        secondary: '#7c3aed',
        border: '#d1d5db',
        background: '#f9fafb',
        surface: '#ffffff',
      },
    },
  }),
}))

function renderBudgetFlow() {
  const summary: MonthlySummary = {
    income: 5000,
    fixedExpensesTotal: 1200,
    variableExpenses: 800,
    autoSavings: 500,
    remaining: 2500,
    savingsRate: 10,
    fixedExpenses: [{ id: 1, name: 'Rent', amount: 1200, isArchived: false }],
  }

  return render(
    <BudgetFlow
      summary={summary}
      variableBreakdown={[
        { name: 'Groceries', amount: 300, pct: 37.5 },
        { name: 'Dining', amount: 500, pct: 62.5 },
      ]}
      incomeRaw="5000"
      incomeFrequency="monthly"
      savingsRate={10}
      fixedExpenses={[{ id: 1, name: 'Rent', amount: 1200, isArchived: false }]}
      onSaveIncome={vi.fn()}
      onSaveSavingsRate={vi.fn()}
      onAddFixed={vi.fn()}
      onUpdateFixed={vi.fn()}
      onDeleteFixed={vi.fn()}
    />,
  )
}

describe('BudgetFlow', () => {
  it('opens the income editor from the monthly budget header', async () => {
    renderBudgetFlow()

    fireEvent.click(screen.getByLabelText('Edit income'))

    expect(await screen.findByText('Edit Income')).toBeInTheDocument()
  })

  it('opens the savings editor from the auto savings row', async () => {
    renderBudgetFlow()

    fireEvent.click(screen.getByLabelText('Edit savings goal'))

    expect(await screen.findByText('Edit Auto Savings')).toBeInTheDocument()
  })

  it('opens the fixed expense manager from the fixed expenses row', async () => {
    renderBudgetFlow()

    fireEvent.click(screen.getByLabelText('Edit fixed expenses'))

    expect(await screen.findByRole('dialog', { name: 'Fixed Expenses' })).toBeInTheDocument()
  })

  it('does not make variable expenses row clickable', () => {
    renderBudgetFlow()

    expect(screen.queryByLabelText('Variable Expenses')).not.toBeInTheDocument()
  })

  it('renders alignment action slots for editable and non-editable rows', () => {
    renderBudgetFlow()

    const fixedSlot = screen.getByTestId('allocation-action-slot-fixed-expenses')
    const variableSlot = screen.getByTestId('allocation-action-slot-variable-expenses')
    const savingsSlot = screen.getByTestId('allocation-action-slot-auto-savings')

    expect(fixedSlot).not.toHaveClass('invisible')
    expect(savingsSlot).not.toHaveClass('invisible')
    expect(variableSlot).toHaveClass('invisible')
  })
})
