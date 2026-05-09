import { useMemo } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import EmptyState from '../../components/ui/EmptyState'
import { useSettings } from '../../context/settingsContext'
import { cn } from '../../utils/cn'

interface BreakdownItem {
  name: string
  amount: number
}

interface FinancialSummary {
  fixedExpenses: BreakdownItem[]
  autoSavings: number
  remaining: number
  variableExpenses: number
  fixedExpensesTotal: number
}

type SliceType = 'fixed' | 'variable' | 'savings'

interface BreakdownPieProps {
  type: SliceType
  financialSummary: FinancialSummary
  variableBreakdown: BreakdownItem[]
}

export default function BreakdownPie({
  type,
  financialSummary,
  variableBreakdown,
}: BreakdownPieProps) {
  const { currency, currentTheme } = useSettings()

  const data = useMemo(() => {
    if (type === 'fixed') {
      return financialSummary.fixedExpenses
        .map((item) => ({ name: item.name, value: item.amount }))
        .filter((d) => d.value > 0)
    }
    if (type === 'variable') {
      return variableBreakdown
        .map((item) => ({ name: item.name, value: item.amount }))
        .filter((d) => d.value > 0)
    }
    return [
      { name: 'Auto Savings', value: financialSummary.autoSavings },
      { name: 'Remaining', value: financialSummary.remaining },
    ]
  }, [type, financialSummary, variableBreakdown])

  const baseColors = [
    currentTheme.colors.primary,
    currentTheme.colors.secondary,
    currentTheme.colors.success,
    currentTheme.colors.danger,
    currentTheme.colors.muted,
  ]

  const hasNegative = data.some((d) => d.value < 0)

  if (hasNegative) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-theme-danger font-medium">
          Budget exceeded — overspend detected
        </p>
        {data.map((item) => (
          <div key={item.name} className="breakdown-row">
            <span className="text-sm text-theme-text">{item.name}</span>
            <span
              className={cn(
                'text-sm font-medium tabular-nums',
                item.value < 0 ? 'text-theme-danger' : 'text-theme-text',
              )}
            >
              {currency(item.value)}
            </span>
          </div>
        ))}
        <div className="breakdown-total-row">
          <span className="text-sm font-medium text-theme-text">Total Savings</span>
          <span className="text-sm font-bold tabular-nums text-theme-success">
            {currency(financialSummary.autoSavings + financialSummary.remaining)}
          </span>
        </div>
      </div>
    )
  }

  const positiveData = data.filter((d) => d.value > 0)

  if (positiveData.length === 0) {
    return <EmptyState message="No data to display." padding="py-6" />
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={positiveData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
          >
            {positiveData.map((_, i) => (
              <Cell key={i} fill={baseColors[i % baseColors.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => currency(v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
