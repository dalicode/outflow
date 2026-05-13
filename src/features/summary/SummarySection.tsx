import PrivateValue from '../../components/privacy/PrivateValue'
import { useSettings } from '../../context/settingsContext'
import type { ReactNode } from 'react'
import type { MonthlySummary } from '../../types'

interface CardProps {
  label: string
  value: ReactNode
  colorClass?: string
}

function Card({ label, value, colorClass = 'text-theme-text' }: CardProps) {
  return (
    <div className="summary-stat-card">
      <span className="summary-label">{label}</span>
      <span className={`text-xl font-semibold ${colorClass}`}>{value}</span>
    </div>
  )
}

interface SummarySectionProps {
  summary: MonthlySummary | null
}

export default function SummarySection({ summary }: SummarySectionProps) {
  const { formatAmount } = useSettings()
  if (!summary) return null

  const { income, fixedExpensesTotal, variableExpenses, autoSavings, remaining } = summary

  const available = income - fixedExpensesTotal

  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-theme-text tracking-tight">
        Financial Summary
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card
          label="Monthly Income"
          value={<PrivateValue>{formatAmount(income)}</PrivateValue>}
          colorClass="text-theme-primary"
        />
        <Card
          label="Fixed Expenses"
          value={<PrivateValue>{formatAmount(fixedExpensesTotal)}</PrivateValue>}
          colorClass="text-theme-primary"
        />
        <Card
          label="Variable Expenses"
          value={<PrivateValue>{formatAmount(variableExpenses)}</PrivateValue>}
          colorClass="text-theme-primary"
        />
        <Card
          label="Available Income"
          value={<PrivateValue>{formatAmount(Math.max(0, available))}</PrivateValue>}
          colorClass="text-theme-primary"
        />
        <Card
          label="Auto Savings"
          value={<PrivateValue>{formatAmount(Math.max(0, autoSavings))}</PrivateValue>}
          colorClass="text-theme-primary"
        />
        <Card
          label="Remaining Budget"
          value={<PrivateValue>{formatAmount(remaining)}</PrivateValue>}
          colorClass={
            remaining > 0
              ? 'text-theme-success'
              : remaining < 0
                ? 'text-theme-danger'
                : 'text-theme-text'
          }
        />
      </div>
    </div>
  )
}
