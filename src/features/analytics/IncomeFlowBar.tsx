import BudgetFlowBar, {
  AllocationRow,
  barPct,
  getRemainingBarColor,
} from '../../components/ui/BudgetFlowBar'
import PrivateValue from '../../components/privacy/PrivateValue'
import { useThemeColors } from './AnalyticsCharts'

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

interface IncomeFlowBarProps {
  yearIncome: number
  yearFixed: number
  yearVariable: number
  yearSavings: number
  yearRemaining: number
  monthlyIncome: number[]
  monthlyFixed: number[]
  monthlyVariable: number[]
  monthlySavings: (number | null)[]
  monthlyRemaining: (number | null)[]
  selectedMonth: number | null
  monthCount: number
  isCurrentYear: boolean
  year: number
  formatAmount: (n: number) => string
}

export default function IncomeFlowBar({
  yearIncome,
  yearFixed,
  yearVariable,
  yearSavings,
  yearRemaining,
  monthlyIncome,
  monthlyFixed,
  monthlyVariable,
  monthlySavings,
  monthlyRemaining,
  selectedMonth,
  monthCount,
  isCurrentYear,
  formatAmount,
}: IncomeFlowBarProps) {
  const colors = useThemeColors()

  const income = selectedMonth !== null ? (monthlyIncome[selectedMonth] ?? 0) : yearIncome
  const fixed = selectedMonth !== null ? (monthlyFixed[selectedMonth] ?? 0) : yearFixed
  const variable = selectedMonth !== null ? (monthlyVariable[selectedMonth] ?? 0) : yearVariable
  const savings = selectedMonth !== null ? (monthlySavings[selectedMonth] ?? 0) : yearSavings
  const remaining = selectedMonth !== null ? (monthlyRemaining[selectedMonth] ?? 0) : yearRemaining

  const cappedSavings = Math.min(Math.max(0, savings), income)
  const totalAllocated = cappedSavings + fixed + variable
  const isOverBudget = totalAllocated > income
  const overflowAmt = isOverBudget ? totalAllocated - income : 0
  const baselineRemaining = Math.max(0, income - Math.max(0, savings) - fixed)
  const remainingColor = getRemainingBarColor(
    remaining,
    baselineRemaining,
    colors.success,
    colors.danger,
  )
  const spentPct = barPct(totalAllocated, income)

  const headlineLabel =
    selectedMonth !== null
      ? `${MONTH_LABELS[selectedMonth]} Income`
      : isCurrentYear
        ? 'YTD Income'
        : 'Total Income'

  const headlineContext =
    selectedMonth !== null
      ? null
      : isCurrentYear
        ? `${monthCount} month${monthCount === 1 ? '' : 's'}`
        : `${monthCount} month${monthCount === 1 ? '' : 's'}`

  const segments = [
    {
      key: 'savings',
      label: 'Savings',
      value: cappedSavings,
      widthPct: barPct(cappedSavings, income),
      color: colors.text,
    },
    {
      key: 'fixed',
      label: 'Fixed',
      value: fixed,
      widthPct: barPct(fixed, income),
      color: colors.primary,
    },
    {
      key: 'variable',
      label: 'Variable',
      value: variable,
      widthPct: barPct(variable, income),
      color: colors.danger,
    },
  ].filter((s) => s.value > 0)

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium text-theme-muted uppercase tracking-wider">
          {headlineLabel}
        </span>
        <span className="text-lg font-bold text-theme-text tabular-nums">
          <PrivateValue>{formatAmount(income)}</PrivateValue>
        </span>
        {headlineContext && <span className="text-xs text-theme-muted">· {headlineContext}</span>}
      </div>

      {/* Bar + allocation rows */}
      <BudgetFlowBar
        income={income}
        segments={segments}
        remaining={remaining}
        remainingColor={remainingColor}
        isOverBudget={isOverBudget}
        overflowAmt={overflowAmt}
        spentPct={spentPct}
        showOverflowLine={true}
        allowPinTooltip={true}
        formatAmount={formatAmount}
      >
        <div className="space-y-1 mt-3">
          <AllocationRow
            label="Savings"
            value={cappedSavings}
            rowPct={barPct(cappedSavings, income)}
            dotColor={colors.text}
            textColor={colors.text}
            formatAmount={formatAmount}
            privateValue
            privatePercentage={false}
            showActionSlot={false}
          />
          <AllocationRow
            label="Fixed Expenses"
            value={fixed}
            rowPct={barPct(fixed, income)}
            dotColor={colors.primary}
            textColor={colors.primary}
            formatAmount={formatAmount}
            privateValue
            privatePercentage={false}
            showActionSlot={false}
          />
          <AllocationRow
            label="Variable Expenses"
            value={variable}
            rowPct={barPct(variable, income)}
            dotColor={colors.danger}
            textColor={colors.danger}
            formatAmount={formatAmount}
            privateValue
            privatePercentage={false}
            showActionSlot={false}
          />

          <div className="border-t border-theme-border my-2" />

          <AllocationRow
            label={remaining >= 0 ? 'Remaining' : 'Over Budget'}
            value={Math.abs(remaining)}
            rowPct={income > 0 ? (remaining / income) * 100 : 0}
            dotColor={remaining >= 0 ? colors.success : colors.danger}
            textColor={remaining >= 0 ? colors.success : colors.danger}
            prefix={remaining >= 0 ? '+' : '−'}
            formatAmount={formatAmount}
            privateValue
            privatePercentage={false}
            showActionSlot={false}
            showZeroPercent
          />
        </div>
      </BudgetFlowBar>
    </div>
  )
}
