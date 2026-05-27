import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RankedCategoryTable, RankedPayeeTable } from '@/features/analytics/AnalyticsCharts'
import type { AnalyticsData } from '@/types'

vi.mock('@/context/settingsContext', () => ({
  useSettings: () => ({
    currentTheme: {
      colors: {
        primary: '#2563eb',
        secondary: '#7c3aed',
        success: '#16a34a',
        danger: '#dc2626',
        text: '#111827',
        muted: '#6b7280',
        surface: '#ffffff',
        background: '#f9fafb',
        border: '#d1d5db',
      },
    },
    formatAmount: (n: number) => `$${n.toFixed(2)}`,
  }),
}))

function makeAnalyticsData(): AnalyticsData {
  return {
    loading: false,
    year: 2026,
    monthlyIncome: Array(12).fill(0),
    variableRows: [
      {
        key: 'groceries',
        name: 'Groceries',
        amounts: [120, 80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        yearTotal: 200,
      },
      {
        key: 'transport',
        name: 'Transport',
        amounts: [50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        yearTotal: 50,
      },
    ],
    payeeRows: [
      {
        key: 'metro',
        name: 'Metro',
        amounts: [90, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        yearTotal: 100,
      },
      {
        key: 'freshco',
        name: 'FreshCo',
        amounts: [70, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        yearTotal: 100,
      },
    ],
    grid: {},
    fixedRows: [],
    monthlyFixedTotals: Array(12).fill(0),
    monthlyVariableTotals: [170, 80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    monthlyTotals: Array(12).fill(0),
    monthlySavings: Array(12).fill(null),
    monthlyRemaining: Array(12).fill(null),
    monthlyTotalSavings: Array(12).fill(null),
    monthlySavingsRates: Array(12).fill(0),
    monthlySavingsPct: Array(12).fill(null),
    monthlyHasData: Array(12).fill(false),
    yearVariableTotal: 250,
    yearFixedTotal: 0,
    yearTotal: 250,
    yearSavings: 0,
    yearRemaining: 0,
    yearTotalIncome: 0,
    avgSavingsPct: 0,
    maxPerMonth: Array(12).fill(0),
  }
}

describe('AnalyticsCharts tables', () => {
  it('shows category year totals when focusMonth is null', () => {
    render(
      <RankedCategoryTable data={makeAnalyticsData()} focusMonth={null} focusLabel="Year total" />,
    )

    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Transport')).toBeInTheDocument()
    expect(screen.queryByText('No category data')).not.toBeInTheDocument()
  })

  it('shows payee year totals when focusMonth is null', () => {
    render(
      <RankedPayeeTable data={makeAnalyticsData()} focusMonth={null} focusLabel="Year total" />,
    )

    expect(screen.getByText('Metro')).toBeInTheDocument()
    expect(screen.getByText('FreshCo')).toBeInTheDocument()
    expect(screen.queryByText('No payee data')).not.toBeInTheDocument()
  })
})
