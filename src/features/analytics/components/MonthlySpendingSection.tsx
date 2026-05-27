import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import EmptyState from '../../../components/ui/EmptyState'
import { fmtCompact, fmtFull, fmtPct } from '../../../utils/analyticsFormatting'
import { cn } from '../../../lib/cn'
import { getCategoryColor } from '../../../utils/summaryColorUtils'
import AnalyticsBreakdownTable from './AnalyticsBreakdownTable'
import ChartTooltip from '../ChartTooltip'
import { MONTHS, type ChartProps, fmtChange } from '../utils/analyticsChartUtils'

export function MonthlyStackedChart({ data, colors, monthCount }: ChartProps) {
  const categoryKeys = useMemo(
    () => (data.variableRows ?? []).map((r) => r.key),
    [data.variableRows],
  )

  const chartData: Array<Record<string, number | null | string>> = useMemo(() => {
    return MONTHS.slice(0, monthCount).map((m, i) => {
      const fixed = data.monthlyFixedTotals[i] || 0
      const income = data.monthlyIncome[i] || 0
      const prevTotal = i > 0 ? data.monthlyTotals[i - 1] || 0 : null
      const total = data.monthlyTotals[i] || 0
      const momDelta = prevTotal !== null ? total - prevTotal : null
      const entry: Record<string, number | null> = { fixed, income, momDelta }
      ;(data.variableRows ?? []).forEach((row) => {
        entry[row.key] = row.amounts[i] || 0
      })
      return { month: m, ...entry }
    })
  }, [data, monthCount])

  const hasData = chartData.some(
    (d) => (d.fixed as number) > 0 || categoryKeys.some((k) => (d[k] as number) > 0),
  )

  const keyToName = useMemo(() => {
    const map: Record<string, string> = {}
    ;(data.variableRows ?? []).forEach((r) => {
      map[r.key] = r.name
    })
    return map
  }, [data.variableRows])

  if (!hasData) return <EmptyState chartHeight message="No spending data" />

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.5} />
        <XAxis
          dataKey="month"
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={{ stroke: colors.grid }}
        />
        <YAxis
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={{ stroke: colors.grid }}
          tickFormatter={fmtCompact}
        />
        <Tooltip
          content={
            <ChartTooltip
              colors={colors}
              formatter={(v: number, name: string) => {
                if (name === 'fixed') return [fmtCompact(v), 'Fixed']
                if (name === 'income') return [fmtCompact(v), 'Income']
                return [fmtCompact(v), keyToName[name] ?? name]
              }}
            />
          }
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: colors.text }}
          formatter={(v: string) => {
            if (v === 'fixed') return 'Fixed'
            if (v === 'income') return 'Income'
            return keyToName[v] ?? v
          }}
        />
        <Bar
          dataKey="fixed"
          stackId="spend"
          fill={colors.primary}
          maxBarSize={32}
          radius={[0, 0, 0, 0]}
        />
        {categoryKeys.map((key, idx) => {
          const isLast = idx === categoryKeys.length - 1
          const catName = keyToName[key] ?? key
          return (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              stackId="spend"
              fill={getCategoryColor(catName)}
              maxBarSize={32}
              radius={isLast ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            >
              {isLast && (
                <LabelList
                  dataKey="momDelta"
                  position="top"
                  content={(props) => {
                    // biome-ignore lint/suspicious/noExplicitAny: Recharts LabelList content prop type
                    const { x, y, width, value } = props as any
                    if (value == null || value === 0) return null
                    const isPositive = value > 0
                    return (
                      <text
                        x={(x as number) + (width as number) / 2}
                        y={(y as number) - 4}
                        textAnchor="middle"
                        fontSize={10}
                        fill={isPositive ? colors.danger : colors.success}
                      >
                        {isPositive ? '+' : '−'}
                        {fmtCompact(Math.abs(value))}
                      </text>
                    )
                  }}
                />
              )}
            </Bar>
          )
        })}
        <Line
          type="monotone"
          dataKey="income"
          stroke={colors.success}
          strokeWidth={2}
          dot={{ r: 3, fill: colors.success }}
          activeDot={{ r: 5 }}
          strokeDasharray="4 2"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

interface MonthlyComparisonTableProps {
  data: ChartProps['data']
  monthCount: number
}

export function MonthlyComparisonTable({ data, monthCount }: MonthlyComparisonTableProps) {
  const rows = useMemo(
    () =>
      MONTHS.slice(0, monthCount).map((month, index) => {
        const spending = data.monthlyTotals[index] || 0
        const previous = index > 0 ? data.monthlyTotals[index - 1] || 0 : null
        const savingsRate = data.monthlySavingsPct[index]
        const remaining = data.monthlyRemaining[index] ?? 0
        return {
          month,
          income: data.monthlyIncome[index] || 0,
          fixed: data.monthlyFixedTotals[index] || 0,
          variable: data.monthlyVariableTotals[index] || 0,
          spending,
          remaining,
          savingsRate: savingsRate ?? 0,
          delta: previous == null ? null : spending - previous,
        }
      }),
    [data, monthCount],
  )

  if (rows.length === 0) return <EmptyState chartHeight message="No month data" />

  return (
    <AnalyticsBreakdownTable
      headers={[
        { key: 'month', label: 'Month' },
        { key: 'income', label: 'Income' },
        { key: 'spend', label: 'Spend' },
        { key: 'fixed', label: 'Fixed' },
        { key: 'variable', label: 'Variable' },
        { key: 'remaining', label: 'Remaining' },
        { key: 'savings-rate', label: 'Savings %' },
        { key: 'mom', label: 'MoM' },
      ]}
    >
      {rows.map((row) => (
        <tr key={row.month}>
          <td className="font-semibold text-theme-text">{row.month}</td>
          <td className="tabular-nums">{fmtFull(row.income)}</td>
          <td className="tabular-nums">{fmtFull(row.spending)}</td>
          <td className="tabular-nums">{fmtFull(row.fixed)}</td>
          <td className="tabular-nums">{fmtFull(row.variable)}</td>
          <td
            className={cn(
              'tabular-nums',
              row.remaining < 0 ? 'text-theme-danger' : 'text-theme-success',
            )}
          >
            {fmtFull(row.remaining)}
          </td>
          <td className="tabular-nums">{fmtPct(row.savingsRate)}</td>
          <td
            className={cn(
              'tabular-nums',
              row.delta == null || row.delta === 0
                ? 'text-theme-muted'
                : row.delta > 0
                  ? 'text-theme-danger'
                  : 'text-theme-success',
            )}
          >
            {fmtChange(row.delta)}
          </td>
        </tr>
      ))}
    </AnalyticsBreakdownTable>
  )
}
