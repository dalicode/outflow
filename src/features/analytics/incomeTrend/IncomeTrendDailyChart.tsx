import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useViewportWidth } from '../../../hooks/useViewportWidth'
import type { DailySpendingRow } from '../../../utils/analyticsTrendUtils'
import type { ThemeColors } from '../hooks/useThemeColors'

interface DailyTooltipPayloadItem {
  payload: DailySpendingRow
  value: number
}

interface DailyTooltipProps {
  active?: boolean
  payload?: DailyTooltipPayloadItem[]
  label?: string
  colors: ThemeColors
  formatAmount: (n: number) => string
}

const DailyTooltip = ({ active, payload, colors, formatAmount }: DailyTooltipProps) => {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div
      className="rounded-theme-medium border shadow-lg px-3 py-2 text-xs min-w-[160px]"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.grid,
        color: colors.text,
      }}
    >
      <div className="font-semibold mb-1" style={{ color: colors.text }}>
        Day {row.day}
      </div>
      <div className="flex justify-between gap-4">
        <span style={{ color: colors.muted }}>Spent</span>
        <span className="font-medium tabular-nums">{formatAmount(row.dailySpent)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span style={{ color: colors.muted }}>Cumulative</span>
        <span className="font-medium tabular-nums">{formatAmount(row.cumulativeSpent)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span style={{ color: colors.muted }}>Transactions</span>
        <span className="font-medium tabular-nums">{row.expenseCount}</span>
      </div>
    </div>
  )
}

interface IncomeTrendDailyChartProps {
  rows: DailySpendingRow[]
  colors: ThemeColors
  formatAmount: (n: number) => string
  monthLabel: string
}

export default function IncomeTrendDailyChart({
  rows,
  colors,
  formatAmount,
  monthLabel,
}: IncomeTrendDailyChartProps) {
  const isMobile = useViewportWidth() < 640

  if (rows.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center">
        <span className="text-xs text-theme-muted">No expenses recorded for {monthLabel}</span>
      </div>
    )
  }

  return (
    <div style={{ touchAction: 'pan-y pinch-zoom' }}>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.grid}
            opacity={0.5}
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tick={{ fill: colors.muted, fontSize: 11 }}
            axisLine={{ stroke: colors.grid }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: colors.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
            width={40}
          />
          {!isMobile && (
            <Tooltip content={<DailyTooltip colors={colors} formatAmount={formatAmount} />} />
          )}
          <Bar dataKey="dailySpent" fill={colors.danger} radius={[2, 2, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
