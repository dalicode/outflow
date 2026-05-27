import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import EmptyState from '../../../components/ui/EmptyState'
import { fmtCompact, fmtPct } from '../../../utils/analyticsFormatting'
import { getCategoryColor } from '../../../utils/summaryColorUtils'
import ChartTooltip from '../ChartTooltip'
import { MONTHS, sliceMonths, type ChartProps } from '../utils/analyticsChartUtils'

interface BreakdownChartProps extends ChartProps {
  selectedMonth: number | null
}

export function CategoryBreakdownChart({
  data,
  colors,
  monthCount,
  selectedMonth,
}: BreakdownChartProps) {
  const pieData = useMemo(() => {
    const items: { name: string; value: number }[] = []
    if (selectedMonth === null) {
      const fixedTotal = sliceMonths(data.monthlyFixedTotals, monthCount).reduce<number>(
        (s, v) => s + (v || 0),
        0,
      )
      if (fixedTotal > 0) {
        items.push({ name: 'Fixed Expenses', value: fixedTotal })
      }
      ;(data.variableRows || []).forEach((row) => {
        const total = sliceMonths(row.amounts, monthCount).reduce<number>((s, v) => s + (v || 0), 0)
        if (total > 0) items.push({ name: row.name, value: total })
      })
      const savingsTotal = sliceMonths(data.monthlyTotalSavings, monthCount).reduce<number>(
        (s, v) => s + (v || 0),
        0,
      )
      if (savingsTotal > 0) {
        items.push({ name: 'Total Savings', value: savingsTotal })
      }
    } else {
      const m = selectedMonth
      const fixedTotal = data.monthlyFixedTotals[m] || 0
      if (fixedTotal > 0) {
        items.push({ name: 'Fixed Expenses', value: fixedTotal })
      }
      ;(data.variableRows || []).forEach((row) => {
        const val = row.amounts?.[m] || 0
        if (val > 0) items.push({ name: row.name, value: val })
      })
      const savingsTotal = data.monthlyTotalSavings[m] || 0
      if (savingsTotal > 0) {
        items.push({ name: 'Total Savings', value: savingsTotal })
      }
    }
    return items
  }, [data, monthCount, selectedMonth])

  const emptyLabel =
    selectedMonth === null ? 'No category data' : `No data for ${MONTHS[selectedMonth]}`
  if (pieData.length === 0) return <EmptyState chartHeight message={emptyLabel} />

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
        >
          {pieData.map((entry) => (
            <Cell
              key={entry.name}
              fill={
                /saving/i.test(entry.name)
                  ? colors.success
                  : /fixed/i.test(entry.name)
                    ? colors.primary
                    : getCategoryColor(entry.name)
              }
            />
          ))}
        </Pie>
        <Tooltip
          content={
            <ChartTooltip
              colors={colors}
              formatter={(v: number, name: string) => [fmtCompact(v), name]}
            />
          }
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function PayeeBreakdownChart({
  data,
  colors,
  monthCount,
  selectedMonth,
}: BreakdownChartProps) {
  const pieData = useMemo(() => {
    const rows = data.payeeRows ?? []
    if (selectedMonth === null) {
      return rows
        .map((row) => ({
          name: row.name,
          value: sliceMonths(row.amounts, monthCount).reduce<number>((s, v) => s + (v || 0), 0),
        }))
        .filter((d) => d.value > 0)
    }
    return rows
      .map((row) => ({
        name: row.name,
        value: row.amounts?.[selectedMonth] || 0,
      }))
      .filter((d) => d.value > 0)
  }, [data.payeeRows, monthCount, selectedMonth])

  const emptyLabel =
    selectedMonth === null ? 'No payee data' : `No payee data for ${MONTHS[selectedMonth]}`
  if (pieData.length === 0) return <EmptyState chartHeight message={emptyLabel} />

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
        >
          {pieData.map((entry) => (
            <Cell key={entry.name} fill={getCategoryColor(entry.name)} />
          ))}
        </Pie>
        <Tooltip
          content={
            <ChartTooltip
              colors={colors}
              formatter={(v: number, name: string) => [fmtCompact(v), name]}
            />
          }
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function SavingsRateChart({ data, colors, monthCount }: ChartProps) {
  const chartData = useMemo(() => {
    return MONTHS.slice(0, monthCount).map((m, i) => ({
      month: m,
      rate: data.monthlySavingsPct[i] || 0,
    }))
  }, [data, monthCount])

  const hasData = chartData.some((d) => d.rate !== 0 && d.rate != null)
  if (!hasData) return <EmptyState chartHeight message="No savings data" />

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.5} />
        <XAxis
          dataKey="month"
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={{ stroke: colors.grid }}
        />
        <YAxis
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={{ stroke: colors.grid }}
          tickFormatter={fmtPct}
          domain={[0, 'auto']}
        />
        <Tooltip
          content={
            <ChartTooltip colors={colors} formatter={(v: number) => [fmtPct(v), 'Savings Rate']} />
          }
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke={colors.primary}
          strokeWidth={2}
          dot={{ r: 3, fill: colors.primary }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function MonthlyTotalSavingsChart({ data, colors, monthCount }: ChartProps) {
  const chartData = useMemo(() => {
    return MONTHS.slice(0, monthCount).map((m, i) => ({
      month: m,
      savings: data.monthlyTotalSavings[i] || 0,
    }))
  }, [data, monthCount])

  const hasData = chartData.some((d) => d.savings !== 0 && d.savings != null)
  if (!hasData) return <EmptyState chartHeight message="No savings data" />

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={2}>
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
              formatter={(v: number) => [fmtCompact(v), 'Total Savings']}
            />
          }
        />
        <Bar dataKey="savings" radius={[3, 3, 0, 0]} maxBarSize={32}>
          {chartData.map((entry) => (
            <Cell key={entry.month} fill={entry.savings >= 0 ? colors.success : colors.danger} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
