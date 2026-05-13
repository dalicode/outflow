import type { ReactNode } from 'react'
import PrivateValue from '../../../components/privacy/PrivateValue'
import type { ThemeColors } from '../AnalyticsCharts'

function DrilldownStat({
  label,
  value,
  valueColor,
}: {
  label: string
  value: ReactNode
  valueColor?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[0.625rem] font-medium text-theme-muted uppercase tracking-wider truncate">
        {label}
      </span>
      <span
        className="text-sm font-semibold tabular-nums truncate"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

interface IncomeTrendDrilldownHeaderProps {
  monthLabel: string
  year: number
  income: number
  expenses: number
  saved: number
  savingsRate: number | null
  cumulativeRemaining: number
  colors: ThemeColors
  formatAmount: (n: number) => string
  onBack: () => void
}

export default function IncomeTrendDrilldownHeader({
  monthLabel,
  year,
  income,
  expenses,
  saved,
  savingsRate,
  cumulativeRemaining,
  colors,
  formatAmount,
  onBack,
}: IncomeTrendDrilldownHeaderProps) {
  const cumulativeColor = cumulativeRemaining < 0 ? colors.danger : colors.success

  return (
    <div className="border-b border-theme-border">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          data-testid="income-trend-back-btn"
          className="flex items-center gap-1 text-sm font-medium text-theme-primary hover:opacity-80 transition-opacity py-2 -my-2"
          aria-label={`Back to ${year} overview`}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {year}
        </button>
        <span className="text-theme-muted text-sm">/</span>
        <span className="text-sm font-semibold text-theme-text">{monthLabel}</span>
      </div>

      <div className="px-4 pb-2 sm:px-5">
        <div
          className="text-[0.625rem] font-medium uppercase tracking-wider"
          style={{ color: colors.muted }}
        >
          All-time cash flow
        </div>
        <div className="text-2xl font-bold tabular-nums" style={{ color: cumulativeColor }}>
          <PrivateValue>{formatAmount(cumulativeRemaining)}</PrivateValue>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-3 sm:grid-cols-4 sm:px-5">
        <DrilldownStat label="Income" value={<PrivateValue>{formatAmount(income)}</PrivateValue>} />
        <DrilldownStat
          label="Expenses"
          value={<PrivateValue>{formatAmount(expenses)}</PrivateValue>}
          valueColor={expenses > 0 ? colors.danger : undefined}
        />
        <DrilldownStat
          label="Saved"
          value={<PrivateValue>{formatAmount(saved)}</PrivateValue>}
          valueColor={saved < 0 ? colors.danger : saved > 0 ? colors.success : undefined}
        />
        <DrilldownStat
          label="Rate"
          value={savingsRate !== null ? `${savingsRate.toFixed(1)}%` : '—'}
        />
      </div>
    </div>
  )
}
