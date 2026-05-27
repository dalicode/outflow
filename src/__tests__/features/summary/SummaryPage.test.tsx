import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SummaryPage from '@/features/summary/SummaryPage'
import { useSummary } from '@/features/summary/hooks/useSummary'
import type { MonthlySummary } from '@/types'

vi.mock('@/features/summary/hooks/useSummary', () => ({
  useSummary: vi.fn(),
}))

vi.mock('@/context/settingsContext', () => ({
  useSettings: () => ({
    formatAmount: (n: number) => `$${n.toFixed(2)}`,
    privacyModeEnabled: false,
    togglePrivacyMode: vi.fn(),
    settings: { currencySymbol: '$' },
    currentTheme: {
      colors: {
        text: '#111111',
        success: '#0f9d58',
        danger: '#d93025',
        muted: '#6b7280',
        primary: '#2563eb',
        secondary: '#7c3aed',
        warning: '#f59e0b',
        border: '#d1d5db',
        background: '#f9fafb',
        surface: '#ffffff',
      },
    },
  }),
}))

vi.mock('@/features/summary/IncomeForm', () => ({
  default: () => <div>Income Setup</div>,
}))

vi.mock('@/features/summary/SavingsForm', () => ({
  default: () => <div>Savings Setup</div>,
}))

vi.mock('@/features/fixedExpenses/FixedExpensesList', () => ({
  default: () => <div>Fixed Expenses Setup</div>,
}))

vi.mock('@/features/summary/BudgetPaceSection', () => ({
  default: () => <div>Monthly Pace</div>,
}))

vi.mock('@/features/summary/SpendingBreakdown', () => ({
  default: () => <div>Spending Breakdown</div>,
}))

const mockedUseSummary = vi.mocked(useSummary)
type SummaryHookState = Omit<ReturnType<typeof useSummary>, 'financialSummary'> & {
  financialSummary: MonthlySummary | null
}

function makeSummary(): MonthlySummary {
  return {
    income: 5000,
    fixedExpensesTotal: 1200,
    savingsRate: 10,
    autoSavings: 500,
    remaining: 2500,
    variableExpenses: 800,
    fixedExpenses: [{ id: 1, name: 'Rent', amount: 1200, isArchived: false }],
  }
}

describe('SummaryPage', () => {
  it('keeps the setup cards visible before income is set', () => {
    mockedUseSummary.mockReturnValue({
      incomeRaw: '',
      incomeFreq: 'monthly',
      monthlyIncome: 0,
      savingsRate: 0,
      fixedExpenses: [],
      financialSummary: null,
      variableBreakdown: [],
      handleIncomeSave: vi.fn(),
      handleSavingsRateSave: vi.fn(),
      handleAddFixed: vi.fn(),
      handleUpdateFixed: vi.fn(),
      handleDeleteFixed: vi.fn(),
    } satisfies SummaryHookState)

    render(<SummaryPage expenses={[]} />)

    expect(screen.getByText('Income Setup')).toBeInTheDocument()
    expect(screen.getByText('Savings Setup')).toBeInTheDocument()
    expect(screen.getByText('Fixed Expenses Setup')).toBeInTheDocument()
    expect(screen.queryByText('Monthly Budget')).not.toBeInTheDocument()
    expect(screen.queryByText('Plan')).not.toBeInTheDocument()
  })

  it('replaces the plan cards with Budget Flow after setup', () => {
    mockedUseSummary.mockReturnValue({
      incomeRaw: '5000',
      incomeFreq: 'monthly',
      monthlyIncome: 5000,
      savingsRate: 10,
      fixedExpenses: [{ id: 1, name: 'Rent', amount: 1200, isArchived: false }],
      financialSummary: makeSummary(),
      variableBreakdown: [],
      handleIncomeSave: vi.fn(),
      handleSavingsRateSave: vi.fn(),
      handleAddFixed: vi.fn(),
      handleUpdateFixed: vi.fn(),
      handleDeleteFixed: vi.fn(),
    } satisfies SummaryHookState)

    render(<SummaryPage expenses={[]} />)

    expect(screen.getByText('Monthly Budget')).toBeInTheDocument()
    expect(screen.queryByText('Income Setup')).not.toBeInTheDocument()
    expect(screen.queryByText('Plan')).not.toBeInTheDocument()
    expect(screen.queryByText('Edit monthly plan')).not.toBeInTheDocument()
  })
})
