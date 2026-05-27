import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IncomeFlowBar from '../features/analytics/IncomeFlowBar'

vi.mock('../components/privacy/PrivateValue', () => ({
  default: ({ children }: { children: unknown }) => <>{children}</>,
}))

vi.mock('../features/analytics/hooks/useThemeColors', () => ({
  useThemeColors: () => ({
    primary: '#2563eb',
    secondary: '#7c3aed',
    success: '#16a34a',
    danger: '#dc2626',
    text: '#111827',
    muted: '#6b7280',
    surface: '#ffffff',
    background: '#f9fafb',
    grid: '#e5e7eb',
    chartPalette: ['#2563eb'],
  }),
}))

describe('IncomeFlowBar', () => {
  it('does not render allocation action slots in analytics rows', () => {
    render(
      <IncomeFlowBar
        yearIncome={5000}
        yearFixed={1200}
        yearVariable={800}
        yearSavings={500}
        yearRemaining={2500}
        monthlyIncome={[5000]}
        monthlyFixed={[1200]}
        monthlyVariable={[800]}
        monthlySavings={[500]}
        monthlyRemaining={[2500]}
        selectedMonth={0}
        monthCount={1}
        isCurrentYear={true}
        year={2026}
        formatAmount={(n) => `$${n.toFixed(2)}`}
      />,
    )

    expect(screen.queryByTestId('allocation-action-slot-savings')).not.toBeInTheDocument()
    expect(screen.queryByTestId('allocation-action-slot-fixed-expenses')).not.toBeInTheDocument()
    expect(screen.queryByTestId('allocation-action-slot-variable-expenses')).not.toBeInTheDocument()
    expect(screen.getByText('+$2500.00')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('shows over-budget sign and zero percent for zero remaining', () => {
    const { rerender } = render(
      <IncomeFlowBar
        yearIncome={5000}
        yearFixed={1200}
        yearVariable={800}
        yearSavings={500}
        yearRemaining={-150}
        monthlyIncome={[5000]}
        monthlyFixed={[1200]}
        monthlyVariable={[800]}
        monthlySavings={[500]}
        monthlyRemaining={[-150]}
        selectedMonth={0}
        monthCount={1}
        isCurrentYear={true}
        year={2026}
        formatAmount={(n) => `$${n.toFixed(2)}`}
      />,
    )

    expect(screen.getByText('Over Budget')).toBeInTheDocument()
    expect(screen.getByText('−$150.00')).toBeInTheDocument()

    rerender(
      <IncomeFlowBar
        yearIncome={5000}
        yearFixed={1200}
        yearVariable={800}
        yearSavings={500}
        yearRemaining={0}
        monthlyIncome={[5000]}
        monthlyFixed={[1200]}
        monthlyVariable={[800]}
        monthlySavings={[500]}
        monthlyRemaining={[0]}
        selectedMonth={0}
        monthCount={1}
        isCurrentYear={true}
        year={2026}
        formatAmount={(n) => `$${n.toFixed(2)}`}
      />,
    )

    expect(screen.getByText('+$0.00')).toBeInTheDocument()
    expect(screen.getAllByText('0%')).toHaveLength(2)
  })
})
