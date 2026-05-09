import { useSettings } from '../../context/settingsContext'
import type { MonthlySummary } from '../../types'

interface CardProps {
  label: string
  value: string
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
        <Card label="Monthly Income" value={formatAmount(income)} colorClass="text-theme-primary" />
        <Card
          label="Fixed Expenses"
          value={formatAmount(fixedExpensesTotal)}
          colorClass="text-theme-primary"
        />
        <Card
          label="Variable Expenses"
          value={formatAmount(variableExpenses)}
          colorClass="text-theme-primary"
        />
        <Card
          label="Available Income"
          value={formatAmount(Math.max(0, available))}
          colorClass="text-theme-primary"
        />
        <Card
          label="Auto Savings"
          value={formatAmount(Math.max(0, autoSavings))}
          colorClass="text-theme-primary"
        />
        <Card
          label="Remaining Budget"
          value={formatAmount(remaining)}
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
