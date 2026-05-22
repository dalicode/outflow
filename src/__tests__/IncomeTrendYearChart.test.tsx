import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IncomeTrendYearChart from '../features/analytics/incomeTrend/IncomeTrendYearChart'
import type { ThemeColors } from '../features/analytics/AnalyticsCharts'
import type { AllTimeRow, YearTrendRow } from '../utils/analyticsTrendUtils'

vi.mock('../hooks/useViewportWidth', () => ({
  useViewportWidth: () => 375,
}))

let activeChartData: Array<Record<string, string | number | null>> = []

vi.mock('recharts', async () => {
  return {
    Bar: () => null,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Cell: () => null,
    ComposedChart: ({
      children,
      data,
      onClick,
    }: {
      children: ReactNode
      data: Array<Record<string, string | number | null>>
      onClick?: (state: { activePayload?: Array<{ payload: Record<string, string | number | null> }> }) => void
    }) => {
      activeChartData = data
      return (
        <div data-testid="composed-chart">
          {data.map((row) => (
            <button
              key={String(row.monthKey ?? row.month)}
              type="button"
              data-testid={`chart-click-${String(row.monthKey)}`}
              onClick={() => onClick?.({ activePayload: [{ payload: row }] })}
            />
          ))}
          {children}
        </div>
      )
    },
    Customized: () => null,
    Legend: ({ payload }: { payload?: Array<{ value: string }> }) => (
      <div data-testid="legend">
        {payload?.map((item) => (
          <span key={item.value}>{item.value}</span>
        ))}
      </div>
    ),
    Line: () => null,
    ReferenceLine: () => <div data-testid="reference-line" />,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div style={{ width: 360, height: 220 }}>{children}</div>
    ),
    Tooltip: () => <div data-testid="tooltip" />,
    XAxis: ({ dataKey }: { dataKey: string }) => (
      <div className="recharts-xAxis">
        {activeChartData.map((row, index) => (
          <span key={`${String(row[dataKey])}-${index}`} className="recharts-cartesian-axis-tick-value">
            {String(row[dataKey] ?? '')}
          </span>
        ))}
      </div>
    ),
    YAxis: ({
      yAxisId,
      tickFormatter,
    }: {
      yAxisId?: string
      tickFormatter?: (value: number) => string
    }) => {
      const values = activeChartData
        .map((row) => {
          if (yAxisId === 'right') return Number(row.monthlySaved ?? 0)
          return Number(row.thisYear ?? 0)
        })
        .filter((value) => !Number.isNaN(value))

      const max = values.length > 0 ? Math.max(...values) : 0
      const ticks = Array.from(new Set([0, max > 0 ? Math.round(max / 2) : 0, max]))

      return (
        <div className="recharts-yAxis" data-axis-id={yAxisId ?? 'left'}>
          {ticks.map((tick) => (
            <span
              key={`${yAxisId ?? 'left'}-${tick}`}
              className="recharts-cartesian-axis-tick-value"
            >
              {tickFormatter ? tickFormatter(tick) : String(tick)}
            </span>
          ))}
        </div>
      )
    },
  }
})

const colors: ThemeColors = {
  primary: '#2563eb',
  secondary: '#7c3aed',
  success: '#16a34a',
  danger: '#dc2626',
  text: '#111827',
  muted: '#6b7280',
  surface: '#ffffff',
  background: '#f9fafb',
  grid: '#d1d5db',
  chartPalette: ['#2563eb', '#7c3aed'],
}

const rows: YearTrendRow[] = [
  {
    monthIndex: 0,
    monthKey: '2026-01',
    monthLabel: 'Jan',
    income: 5000,
    expenses: 3200,
    saved: 1800,
    savingsRate: 36,
    expenseCount: 8,
    hasData: true,
    cumulativeRemaining: 1800,
  },
  {
    monthIndex: 1,
    monthKey: '2026-02',
    monthLabel: 'Feb',
    income: 5000,
    expenses: 2800,
    saved: 2200,
    savingsRate: 44,
    expenseCount: 7,
    hasData: true,
    cumulativeRemaining: 4000,
  },
  {
    monthIndex: 2,
    monthKey: '2026-03',
    monthLabel: 'Mar',
    income: 5000,
    expenses: 3400,
    saved: 1600,
    savingsRate: 32,
    expenseCount: 9,
    hasData: true,
    cumulativeRemaining: 5600,
  },
]

const priorRows: YearTrendRow[] = [
  {
    monthIndex: 0,
    monthKey: '2025-01',
    monthLabel: 'Jan',
    income: 4500,
    expenses: 3100,
    saved: 1400,
    savingsRate: 31.1,
    expenseCount: 6,
    hasData: true,
    cumulativeRemaining: 1400,
  },
  {
    monthIndex: 1,
    monthKey: '2025-02',
    monthLabel: 'Feb',
    income: 4500,
    expenses: 2900,
    saved: 1600,
    savingsRate: 35.6,
    expenseCount: 6,
    hasData: true,
    cumulativeRemaining: 3000,
  },
  {
    monthIndex: 2,
    monthKey: '2025-03',
    monthLabel: 'Mar',
    income: 4500,
    expenses: 3000,
    saved: 1500,
    savingsRate: 33.3,
    expenseCount: 6,
    hasData: true,
    cumulativeRemaining: 4500,
  },
]

const allTimeRows: AllTimeRow[] = rows.map((row) => ({
  label: `${row.monthLabel} 26`,
  monthLabel: row.monthLabel,
  monthKey: row.monthKey,
  monthIndex: row.monthIndex,
  year: 2026,
  cumulativeRemaining: row.cumulativeRemaining,
  saved: row.saved,
  priorSaved: priorRows[row.monthIndex]?.saved ?? null,
  savedDelta:
    priorRows[row.monthIndex] != null ? row.saved - priorRows[row.monthIndex].saved : null,
  income: row.income,
  expenses: row.expenses,
  savingsRate: row.savingsRate,
  hasData: row.hasData,
  expenseCount: row.expenseCount,
}))

describe('IncomeTrendYearChart', () => {
  it('renders mobile axes and keeps desktop-only extras hidden', () => {
    const { container } = render(
      <IncomeTrendYearChart
        rows={rows}
        priorRows={priorRows}
        priorYear={2025}
        selectedMonth={null}
        onSelectMonth={vi.fn()}
        colors={colors}
        formatAmount={(n) => `$${n.toFixed(2)}`}
        allTimeRows={allTimeRows}
        selectedYear={2026}
      />,
    )

    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('Feb')).toBeInTheDocument()
    expect(screen.queryByText('Jan 26')).not.toBeInTheDocument()
    expect(screen.queryByText('Feb 26')).not.toBeInTheDocument()

    const yAxisTicks = Array.from(
      container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value'),
    )
      .map((node) => node.textContent?.trim() ?? '')
      .filter(Boolean)

    expect(yAxisTicks.length).toBeGreaterThan(0)
    expect(yAxisTicks.some((tick) => tick === '0' || tick.includes('k'))).toBe(true)

    expect(container.querySelectorAll('.recharts-yAxis')).toHaveLength(1)
    expect(container.querySelector('[data-brush-overview]')).not.toBeInTheDocument()
    expect(screen.queryByText('Saved (this year)')).not.toBeInTheDocument()
    expect(screen.queryByText('Saved (2025)')).not.toBeInTheDocument()
  })

  it('uses full monthKey for chart click selection and toggle, including past-year keys', () => {
    const onSelectMonth = vi.fn()
    const pastYearRows: YearTrendRow[] = [
      {
        ...rows[0],
        monthIndex: 4,
        monthKey: '2024-05',
        monthLabel: 'May',
      },
      {
        ...rows[1],
        monthIndex: 4,
        monthKey: '2026-05',
        monthLabel: 'May',
      },
    ]

    const { rerender } = render(
      <IncomeTrendYearChart
        rows={pastYearRows}
        priorRows={null}
        selectedMonth={null}
        onSelectMonth={onSelectMonth}
        colors={colors}
        formatAmount={(n) => `$${n.toFixed(2)}`}
        selectedYear={2026}
      />,
    )

    fireEvent.click(screen.getByTestId('chart-click-2024-05'))
    expect(onSelectMonth).toHaveBeenLastCalledWith('2024-05')

    rerender(
      <IncomeTrendYearChart
        rows={pastYearRows}
        priorRows={null}
        selectedMonth="2024-05"
        onSelectMonth={onSelectMonth}
        colors={colors}
        formatAmount={(n) => `$${n.toFixed(2)}`}
        selectedYear={2026}
      />,
    )

    fireEvent.click(screen.getByTestId('chart-click-2024-05'))
    expect(onSelectMonth).toHaveBeenLastCalledWith(null)
  })
})
