import { type ReactNode, useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useSettings } from '../../context/settingsContext'
import PrivateValue from '../../components/privacy/PrivateValue'
import { useViewportWidth } from '../../hooks/useViewportWidth'
import type { Expense, MonthlySummary } from '../../types'
import { cn } from '../../utils/cn'
import { type BudgetPaceSummary, getBudgetPaceSummary } from './utils/budgetPaceUtils'

interface BudgetPaceSectionProps {
  expenses: Expense[]
  summary: MonthlySummary | null
  selectedYear?: number
  selectedMonth?: number
}

interface MetricProps {
  label: string
  value: ReactNode
  subValue?: string
  valueClassName?: string
}

function Metric({ label, value, subValue, valueClassName = 'text-theme-text' }: MetricProps) {
  return (
    <div className="summary-stat-card min-h-[4.75rem]">
      <span className="summary-label mb-1">{label}</span>
      <span className={cn('text-lg font-semibold tabular-nums', valueClassName)}>{value}</span>
      {subValue && <span className="mt-0.5 text-[11px] text-theme-muted">{subValue}</span>}
    </div>
  )
}

function formatDayLabel(
  day: number,
  isMobile: boolean,
  currentDay: number,
  daysInMonth: number,
): string {
  if (!isMobile) {
    return day === 1 || day === daysInMonth || day % 2 === 0 ? String(day) : ''
  }

  if (day === 1 || day === currentDay || day === daysInMonth) return String(day)
  return day % 5 === 0 ? String(day) : ''
}

function getStatusTone(status: string): 'success' | 'warning' | 'danger' | 'muted' {
  if (status === 'No budget set') return 'muted'
  if (status === 'No spending yet') return 'success'
  if (status === 'Under budget pace') return 'success'
  if (status === 'On track') return 'success'
  if (status === 'Slightly ahead of pace') return 'warning'
  if (status === 'Spending fast') return 'warning'
  if (status === 'Over budget') return 'danger'
  if (status === 'Month complete') return 'success'
  return 'muted'
}

function PaceBadge({
  status,
  tone,
  colors,
}: {
  status: string
  tone: 'success' | 'warning' | 'danger' | 'muted'
  colors: Record<string, string>
}) {
  const styleMap: Record<
    typeof tone,
    { color: string; backgroundColor: string; borderColor: string }
  > = {
    success: {
      color: colors.success,
      backgroundColor: `color-mix(in srgb, ${colors.success} 10%, transparent)`,
      borderColor: `color-mix(in srgb, ${colors.success} 22%, transparent)`,
    },
    warning: {
      color: colors.secondary,
      backgroundColor: `color-mix(in srgb, ${colors.secondary} 10%, transparent)`,
      borderColor: `color-mix(in srgb, ${colors.secondary} 22%, transparent)`,
    },
    danger: {
      color: colors.danger,
      backgroundColor: `color-mix(in srgb, ${colors.danger} 10%, transparent)`,
      borderColor: `color-mix(in srgb, ${colors.danger} 22%, transparent)`,
    },
    muted: {
      color: colors.muted,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  }

  return (
    <span
      className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={styleMap[tone]}
    >
      {status}
    </span>
  )
}

function PaceProgressBar({
  label,
  percent,
  barColor,
  secondaryLabel,
  ariaLabel,
}: {
  label: string
  percent: number | null
  barColor: string
  secondaryLabel?: string
  ariaLabel: string
}) {
  const visiblePercent = percent == null ? 0 : Math.max(0, Math.min(100, percent * 100))

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-theme-muted">{label}</span>
        <span className="tabular-nums text-theme-text">
          {secondaryLabel ?? (percent == null ? '—' : `${(percent * 100).toFixed(0)}%`)}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-theme-background"
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={percent == null ? undefined : Math.round(percent * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${visiblePercent}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  )
}

function LineTooltip({
  active,
  payload,
  label,
  formatAmount,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | null }>
  label?: string
  formatAmount: (n: number | null | undefined) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  const actual = payload.find((item) => item.name === 'Actual')
  const ideal = payload.find((item) => item.name === 'Ideal pace')
  const actualValue = actual?.value != null ? Number(actual.value) : null
  const idealValue = ideal?.value != null ? Number(ideal.value) : null
  const difference = actualValue != null && idealValue != null ? actualValue - idealValue : null

  return (
    <div className="rounded-theme-medium border border-theme-border bg-theme-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-theme-text">Day {label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-theme-muted">Spent</span>
          <span className="tabular-nums text-theme-text">{formatAmount(actualValue)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-theme-muted">Ideal pace</span>
          <span className="tabular-nums text-theme-text">{formatAmount(idealValue)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-theme-muted">Difference</span>
          <span
            className={cn(
              'tabular-nums',
              difference == null
                ? 'text-theme-muted'
                : difference > 0
                  ? 'text-theme-danger'
                  : 'text-theme-success',
            )}
          >
            {difference == null
              ? '—'
              : `${difference > 0 ? 'Ahead by' : 'Under by'} ${formatAmount(Math.abs(difference))}`}
          </span>
        </div>
      </div>
    </div>
  )
}

function DailyTooltip({
  active,
  payload,
  label,
  formatAmount,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | null }>
  label?: string
  formatAmount: (n: number | null | undefined) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  const spent = payload.find((item) => item.name === 'Daily spend')?.value ?? 0
  const expenses = payload.find((item) => item.name === 'Expenses')?.value ?? 0

  return (
    <div className="rounded-theme-medium border border-theme-border bg-theme-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-theme-text">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-theme-muted">Spent</span>
          <span className="tabular-nums text-theme-text">{formatAmount(spent)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-theme-muted">Expenses</span>
          <span className="tabular-nums text-theme-text">{expenses}</span>
        </div>
      </div>
    </div>
  )
}

function getInsight(
  pace: BudgetPaceSummary,
  formatAmount: (value: number | null | undefined) => string,
): string {
  if (pace.status === 'No budget set') {
    return 'Set a monthly budget to compare your spending pace.'
  }

  if (pace.daysElapsed === 0) {
    return 'This month has not started yet. Your pace will appear once spending begins.'
  }

  if (pace.status === 'Month complete') {
    const balance = pace.budgetRemaining ?? 0
    return balance >= 0
      ? `This month is complete. You finished ${formatAmount(balance)} under budget.`
      : `This month is complete. You finished ${formatAmount(Math.abs(balance))} over budget.`
  }

  if (pace.spentSoFar === 0 && pace.daysElapsed > 0) {
    return 'No spending logged for this month yet.'
  }

  if (pace.daysRemaining <= 0) {
    return `You have spent ${formatAmount(pace.spentSoFar)} of your monthly budget.`
  }

  if (pace.paceDifference != null && pace.paceDifference > 0) {
    return `You are ${formatAmount(pace.paceDifference)} ahead of your ideal pace. Slower days now can help balance the month.`
  }

  if (pace.paceDifference != null && pace.paceDifference < 0) {
    return `You are ${formatAmount(Math.abs(pace.paceDifference))} under your ideal pace. You have about ${formatAmount(pace.safeDailySpend ?? 0)}/day available for the rest of the month.`
  }

  if (pace.safeDailySpend != null) {
    return `You have ${pace.daysRemaining} days left and ${formatAmount(pace.budgetRemaining ?? 0)} remaining. That gives you about ${formatAmount(pace.safeDailySpend)}/day for the rest of the month.`
  }

  return 'Set a monthly budget to compare your spending pace.'
}

export default function BudgetPaceSection({
  expenses,
  summary,
  selectedYear,
  selectedMonth,
}: BudgetPaceSectionProps) {
  const { formatAmount, formatShortMonth, currentTheme } = useSettings()
  const viewportWidth = useViewportWidth()
  const now = useMemo(() => new Date(), [])
  const isMobile = viewportWidth < 640
  const year = selectedYear ?? now.getFullYear()
  const month = selectedMonth ?? now.getMonth()

  const monthlyBudget = summary
    ? Math.max(0, summary.income - summary.fixedExpensesTotal - Math.max(0, summary.autoSavings))
    : null

  const pace = useMemo(
    () =>
      getBudgetPaceSummary({
        expenses,
        selectedYear: year,
        selectedMonth: month,
        monthlyBudget,
        now,
      }),
    [expenses, year, month, monthlyBudget, now],
  )

  const hasActualData = pace.dailyRows.some((row) => (row.dailySpent ?? 0) !== 0)
  const hasBudget = pace.monthlyBudget != null && pace.monthlyBudget > 0
  const statusTone = getStatusTone(pace.status)
  const insight = useMemo(() => getInsight(pace, formatAmount), [pace, formatAmount])
  const lineHeight = isMobile ? 240 : 300
  const barHeight = isMobile ? 240 : 280
  const monthProgressBarColor = currentTheme.colors.muted
  const budgetProgressBarColor =
    statusTone === 'danger'
      ? currentTheme.colors.danger
      : statusTone === 'warning'
        ? currentTheme.colors.secondary
        : statusTone === 'success'
          ? currentTheme.colors.success
          : currentTheme.colors.primary

  const actualSeries = pace.dailyRows.map((row) => ({
    day: row.day,
    actual: row.cumulativeSpent,
    ideal: row.idealCumulativeSpend,
    isToday: row.isToday,
  }))

  const dailySeries = pace.dailyRows.map((row) => ({
    day: row.day,
    actual: row.dailySpent,
    expenseCount: row.expenseCount,
    isToday: row.isToday,
    isFutureDay: row.isFutureDay,
  }))

  return (
    <section className="space-y-5 rounded-theme-large border border-theme-border bg-theme-surface p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-theme-text">Monthly Pace</p>
          <p className="mt-1 text-xs text-theme-muted">
            How your current spending compares with the days left in the month.
          </p>
        </div>
        <PaceBadge status={pace.status} tone={statusTone} colors={currentTheme.colors} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric
          label="Spent so far"
          value={<PrivateValue>{formatAmount(pace.spentSoFar)}</PrivateValue>}
        />
        <Metric
          label="Budget remaining"
          value={
            pace.budgetRemaining == null ? (
              '—'
            ) : (
              <PrivateValue>{formatAmount(pace.budgetRemaining)}</PrivateValue>
            )
          }
          valueClassName={
            pace.budgetRemaining != null && pace.budgetRemaining < 0
              ? 'text-theme-danger'
              : 'text-theme-success'
          }
        />
        <Metric label="Days remaining" value={String(pace.daysRemaining)} />
        <Metric
          label="Safe daily spend"
          value={
            pace.safeDailySpend == null ? (
              '—'
            ) : (
              <>
                <PrivateValue>{formatAmount(pace.safeDailySpend)}</PrivateValue>/day
              </>
            )
          }
          valueClassName={
            statusTone === 'danger'
              ? 'text-theme-danger'
              : statusTone === 'warning'
                ? 'text-theme-secondary'
                : 'text-theme-success'
          }
        />
        <Metric
          label="Current avg/day"
          value={
            <>
              <PrivateValue>{formatAmount(pace.currentAverageDailySpend)}</PrivateValue>/day
            </>
          }
        />
        <Metric
          label="Budget used"
          value={
            pace.budgetUsedPercent == null ? '—' : `${(pace.budgetUsedPercent * 100).toFixed(0)}%`
          }
          valueClassName={
            statusTone === 'danger'
              ? 'text-theme-danger'
              : statusTone === 'warning'
                ? 'text-theme-secondary'
                : statusTone === 'success'
                  ? 'text-theme-success'
                  : 'text-theme-text'
          }
        />
      </div>

      <div className="space-y-4 rounded-theme-large border border-theme-border bg-theme-background p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <PaceProgressBar
            label="Month elapsed"
            percent={pace.monthElapsedPercent}
            barColor={monthProgressBarColor}
            secondaryLabel={`${(pace.monthElapsedPercent * 100).toFixed(0)}%`}
            ariaLabel="Month elapsed"
          />
          <PaceProgressBar
            label="Budget used"
            percent={pace.budgetUsedPercent}
            barColor={budgetProgressBarColor}
            secondaryLabel={
              pace.budgetUsedPercent == null
                ? 'Set a monthly budget to compare pace'
                : `${(pace.budgetUsedPercent * 100).toFixed(0)}%`
            }
            ariaLabel="Budget used"
          />
        </div>
        <div className="text-sm text-theme-muted">
          {pace.status === 'No budget set'
            ? 'Set a monthly budget to compare your spending pace.'
            : pace.status}
        </div>
        <p className="text-sm text-theme-text">{insight}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className="rounded-theme-large border border-theme-border bg-theme-background p-4"
          aria-labelledby="budget-pace-cumulative-title"
          aria-describedby="budget-pace-cumulative-description"
          role="img"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="budget-pace-cumulative-title" className="text-sm font-semibold text-theme-text">
              Cumulative Spending vs. Ideal Pace
            </h2>
            <span className="tabular-nums text-xs text-theme-muted">
              {formatShortMonth(month + 1)} {year}
            </span>
          </div>
          <p id="budget-pace-cumulative-description" className="sr-only">
            Line chart comparing actual cumulative spending with the ideal month pace.
          </p>
          {hasActualData || hasBudget ? (
            <ResponsiveContainer width="100%" height={lineHeight}>
              <LineChart data={actualSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid
                  stroke={currentTheme.colors.border}
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.4}
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: currentTheme.colors.muted, fontSize: 11 }}
                  tickFormatter={(value: number) =>
                    formatDayLabel(value, isMobile, pace.currentDayForSummary, pace.daysInMonth)
                  }
                  interval={0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: currentTheme.colors.muted, fontSize: 11 }}
                  tickFormatter={(value: number) => formatAmount(value)}
                  width={70}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <LineTooltip
                      active={active}
                      payload={
                        payload as Array<{ name?: string; value?: number | null }> | undefined
                      }
                      label={label ? String(label) : undefined}
                      formatAmount={formatAmount}
                    />
                  )}
                />
                {pace.currentDayForSummary > 0 && (
                  <ReferenceLine
                    x={pace.currentDayForSummary}
                    stroke={currentTheme.colors.secondary}
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke={currentTheme.colors.primary}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
                {hasBudget && (
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    name="Ideal pace"
                    stroke={currentTheme.colors.muted}
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                    connectNulls={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div
              className="flex items-center justify-center rounded-theme-medium border border-dashed border-theme-border bg-theme-surface px-4 text-center text-sm text-theme-muted"
              style={{ height: lineHeight }}
            >
              No spending logged for this month yet.
            </div>
          )}
        </div>

        <div
          className="rounded-theme-large border border-theme-border bg-theme-background p-4"
          aria-labelledby="budget-pace-daily-title"
          aria-describedby="budget-pace-daily-description"
          role="img"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="budget-pace-daily-title" className="text-sm font-semibold text-theme-text">
              Daily Spending
            </h2>
            <span className="tabular-nums text-xs text-theme-muted">
              {pace.daysElapsed} of {pace.daysInMonth} days
            </span>
          </div>
          <p id="budget-pace-daily-description" className="sr-only">
            Bar chart showing daily spending through the selected month.
          </p>
          {hasActualData ? (
            <ResponsiveContainer width="100%" height={barHeight}>
              <BarChart data={dailySeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid
                  stroke={currentTheme.colors.border}
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.4}
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: currentTheme.colors.muted, fontSize: 11 }}
                  tickFormatter={(value: number) =>
                    formatDayLabel(value, isMobile, pace.currentDayForSummary, pace.daysInMonth)
                  }
                  interval={0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: currentTheme.colors.muted, fontSize: 11 }}
                  tickFormatter={(value: number) => formatAmount(value)}
                  width={70}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <DailyTooltip
                      active={active}
                      payload={
                        payload as Array<{ name?: string; value?: number | null }> | undefined
                      }
                      label={label ? `${formatShortMonth(month + 1)} ${label}` : undefined}
                      formatAmount={formatAmount}
                    />
                  )}
                />
                {pace.safeDailySpend != null && (
                  <ReferenceLine
                    y={pace.safeDailySpend}
                    stroke={currentTheme.colors.success}
                    strokeDasharray="4 4"
                    strokeOpacity={0.55}
                    label={{
                      value: 'Safe/day',
                      position: 'insideTopRight',
                      fill: currentTheme.colors.success,
                      fontSize: 11,
                    }}
                  />
                )}
                <Bar dataKey="actual" name="Daily spend" radius={[4, 4, 0, 0]}>
                  {dailySeries.map((entry) => (
                    <Cell
                      key={`cell-${entry.day}`}
                      fill={
                        entry.isFutureDay
                          ? 'transparent'
                          : entry.actual != null && entry.actual < 0
                            ? currentTheme.colors.danger
                            : entry.isToday
                              ? currentTheme.colors.secondary
                              : currentTheme.colors.primary
                      }
                      fillOpacity={entry.isFutureDay ? 0 : entry.isToday ? 1 : 0.82}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div
              className="flex items-center justify-center rounded-theme-medium border border-dashed border-theme-border bg-theme-surface px-4 text-center text-sm text-theme-muted"
              style={{ height: barHeight }}
            >
              No spending logged for this month yet.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
