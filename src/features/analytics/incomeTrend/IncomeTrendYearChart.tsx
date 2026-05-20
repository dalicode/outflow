import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Customized,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useViewportWidth } from '../../../hooks/useViewportWidth'
import type { AllTimeRow, YearTrendRow } from '../../../utils/analyticsTrendUtils'
import type { ThemeColors } from '../AnalyticsCharts'
import BrushOverview from './BrushOverview'
import ColoredCumulativeLine, { type ColoredCumulativeLineProps } from './ColoredCumulativeLine'

interface IncomeTrendYearChartProps {
  rows: YearTrendRow[]
  priorRows?: YearTrendRow[] | null
  priorYear?: number
  selectedMonth: string | null
  onSelectMonth: (trendKey: string | null) => void
  colors: ThemeColors
  formatAmount: (n: number) => string
  /** Full all-time dataset for the brush mini-timeline */
  allTimeRows?: AllTimeRow[]
  /** Currently selected year — used to set the default brush window */
  selectedYear?: number
  /** Called when the brush window changes */
  onBrushChange?: (window: AllTimeRow[]) => void
  /** External brush window to apply (e.g. from year strip pan) */
  externalBrushWindow?: AllTimeRow[] | null
  /** Increment to force re-apply even if window content is the same */
  externalBrushVersion?: number
}

interface TooltipPayloadItem {
  value: number
  name: string
  color: string
  // biome-ignore lint/suspicious/noExplicitAny: Recharts tooltip payload type
  payload: any
}

interface IncomeTrendTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
  colors: ThemeColors
  formatAmount: (n: number) => string
}

const IncomeTrendTooltip = ({
  active,
  payload,
  label,
  colors,
  formatAmount,
}: IncomeTrendTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null

  const thisYearEntry = payload.find((p) => p.name === 'thisYear')
  const monthlySavedEntry = payload.find((p) => p.name === 'monthlySaved')
  const priorSavedEntry = payload.find((p) => p.name === 'priorSaved')
  const deltaEntry = payload.find((p) => p.name === 'savedDelta')

  const cumulativeValue: number | undefined = thisYearEntry?.value
  const monthlySavedValue: number | undefined = monthlySavedEntry?.value
  const priorSavedValue: number | undefined = priorSavedEntry?.value
  const deltaValue: number | null = deltaEntry?.value ?? null

  const row = thisYearEntry?.payload as
    | {
        income?: number
        expenses?: number
        saved?: number
        savingsRate?: number | null
        priorSavedAmt?: number
      }
    | undefined

  const savedDelta =
    deltaValue != null
      ? deltaValue
      : monthlySavedValue != null && priorSavedValue != null
        ? monthlySavedValue - priorSavedValue
        : null

  return (
    <div
      className="rounded-theme-medium border shadow-lg px-3 py-2 text-xs min-w-[200px]"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.grid,
        color: colors.text,
      }}
    >
      {label && (
        <div className="font-semibold mb-1.5" style={{ color: colors.text }}>
          {label}
        </div>
      )}

      {/* Cumulative cash flow */}
      {cumulativeValue != null && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: thisYearEntry?.color }}
            />
            <span style={{ color: colors.muted }}>Cumulative</span>
          </div>
          <span
            className="font-medium tabular-nums"
            style={{
              color: cumulativeValue < 0 ? colors.danger : colors.success,
            }}
          >
            {formatAmount(cumulativeValue)}
          </span>
        </div>
      )}

      {/* Monthly saved — this year vs prior year */}
      {(monthlySavedValue != null || priorSavedValue != null) && (
        <div
          className="mt-1.5 pt-1.5 space-y-0.5"
          style={{ borderTop: `1px solid ${colors.grid}` }}
        >
          {monthlySavedValue != null && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: monthlySavedEntry?.color }}
                />
                <span style={{ color: colors.muted }}>Saved this month</span>
              </div>
              <span
                className="font-medium tabular-nums"
                style={{
                  color: monthlySavedValue < 0 ? colors.danger : colors.success,
                }}
              >
                {formatAmount(monthlySavedValue)}
              </span>
            </div>
          )}
          {priorSavedValue != null && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: priorSavedEntry?.color }}
                />
                <span style={{ color: colors.muted }}>Prior year</span>
              </div>
              <span
                className="font-medium tabular-nums"
                style={{
                  color: priorSavedValue < 0 ? colors.danger : colors.success,
                }}
              >
                {formatAmount(priorSavedValue)}
              </span>
            </div>
          )}
          {savedDelta != null && (
            <div className="flex items-center justify-between gap-4 pt-0.5">
              <span style={{ color: colors.muted }}>vs last year</span>
              <span
                className="font-semibold tabular-nums"
                style={{
                  color: savedDelta >= 0 ? colors.success : colors.danger,
                }}
              >
                {savedDelta >= 0 ? '+' : '−'}
                {formatAmount(Math.abs(savedDelta))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* This month breakdown */}
      {row && (
        <div
          className="mt-1.5 pt-1.5 space-y-0.5"
          style={{ borderTop: `1px solid ${colors.grid}` }}
        >
          {row.income != null && row.income > 0 && (
            <div className="flex justify-between gap-4">
              <span style={{ color: colors.muted }}>Income</span>
              <span className="tabular-nums font-medium" style={{ color: colors.text }}>
                {formatAmount(row.income)}
              </span>
            </div>
          )}
          {row.savingsRate != null && (
            <div className="flex justify-between gap-4">
              <span style={{ color: colors.muted }}>Savings rate</span>
              <span className="tabular-nums font-medium" style={{ color: colors.text }}>
                {row.savingsRate.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function IncomeTrendYearChart({
  rows,
  priorRows,
  priorYear,
  selectedMonth,
  onSelectMonth,
  colors,
  formatAmount,
  allTimeRows,
  selectedYear,
  onBrushChange,
  externalBrushWindow,
  externalBrushVersion,
}: IncomeTrendYearChartProps) {
  const isMobile = useViewportWidth() < 640

  // Brush indices into allTimeRows — default to the selected year's window
  const defaultBrushIndices = useMemo(() => {
    if (!allTimeRows || allTimeRows.length === 0) return null
    const start = allTimeRows.findIndex((r) => r.year === selectedYear)
    if (start === -1) return null
    const end = allTimeRows.findLastIndex((r) => r.year === selectedYear)
    return { start, end }
  }, [allTimeRows, selectedYear])

  const [brushIndices, setBrushIndices] = useState<{
    start: number
    end: number
  } | null>(defaultBrushIndices)

  // Reset brush when year changes
  const prevSelectedYear = useMemo(() => selectedYear, [selectedYear])
  if (prevSelectedYear !== selectedYear) {
    setBrushIndices(defaultBrushIndices)
  }

  // Sync brush when external window is set (e.g. year strip pan)
  const prevExternalVersion = useRef(externalBrushVersion)
  if (
    prevExternalVersion.current !== externalBrushVersion &&
    externalBrushWindow != null &&
    allTimeRows
  ) {
    prevExternalVersion.current = externalBrushVersion
    const firstKey = externalBrushWindow[0]?.monthKey
    const lastKey = externalBrushWindow[externalBrushWindow.length - 1]?.monthKey
    const start = allTimeRows.findIndex((r) => r.monthKey === firstKey)
    const end = allTimeRows.findLastIndex((r) => r.monthKey === lastKey)
    if (start !== -1 && end !== -1) {
      setBrushIndices({ start, end })
    }
  }
  // Only switch to all-time mode when the brush spans outside the selected year
  const isBrushCustom = useMemo(() => {
    if (!brushIndices || !defaultBrushIndices) return false
    return (
      brushIndices.start !== defaultBrushIndices.start ||
      brushIndices.end !== defaultBrushIndices.end
    )
  }, [brushIndices, defaultBrushIndices])

  // When brush is active and custom, derive the visible rows from the brushed window
  const visibleAllTimeRows = useMemo(() => {
    if (!allTimeRows || !brushIndices || !isBrushCustom) return null
    return allTimeRows.slice(brushIndices.start, brushIndices.end + 1)
  }, [allTimeRows, brushIndices, isBrushCustom]) // Merge this year and prior year data by month index
  // When brush is active, use the all-time rows for the visible window
  const chartData = useMemo(() => {
    if (visibleAllTimeRows && visibleAllTimeRows.length > 0) {
      // Brush mode: use all-time rows with per-point prior-year data
      return visibleAllTimeRows.map((row) => ({
        month: row.monthLabel,
        thisYear: row.cumulativeRemaining,
        monthlySaved: row.saved,
        priorSaved: row.priorSaved,
        savedDelta: row.savedDelta,
        monthIndex: row.monthIndex,
        monthKey: row.monthKey,
        year: row.year,
        hasData: row.hasData,
        income: row.income,
        expenses: row.expenses,
        saved: row.saved,
        savingsRate: row.savingsRate,
        priorSavedAmt: row.priorSaved,
      }))
    }
    // Default: per-year rows with prior-year overlay
    const priorByMonth = new Map((priorRows ?? []).map((r) => [r.monthIndex, r]))
    return rows.map((row) => {
      const prior = priorByMonth.get(row.monthIndex)
      return {
        month: row.monthLabel,
        thisYear: row.cumulativeRemaining,
        monthlySaved: row.saved,
        priorSaved: prior?.saved ?? null,
        savedDelta: prior?.saved != null ? row.saved - prior.saved : null,
        monthIndex: row.monthIndex,
        monthKey: row.monthKey,
        year: selectedYear,
        hasData: row.hasData,
        income: row.income,
        expenses: row.expenses,
        saved: row.saved,
        savingsRate: row.savingsRate,
        priorSavedAmt: prior?.saved,
      }
    })
  }, [visibleAllTimeRows, rows, priorRows, selectedYear])

  // Prior year line: muted color, always consistent
  const priorLineColor = colors.muted
  const hasPriorData = priorRows != null && priorRows.length > 0

  const legendPayload = useMemo(() => {
    const items: { value: string; id: string; type: 'line'; color: string }[] = []
    items.push({
      value: 'Saved (this year)',
      id: 'monthlySaved',
      type: 'line',
      color: colors.primary,
    })
    if (hasPriorData) {
      items.push({
        value: `Saved (${priorYear ?? 'prior year'})`,
        id: 'priorSaved',
        type: 'line',
        color: priorLineColor,
      })
    }
    return items
  }, [hasPriorData, priorYear, colors.primary, priorLineColor])

  const dotSelectedMonth = useMemo(() => {
    if (!selectedMonth) return null
    return parseInt(selectedMonth.split('-')[1], 10) - 1
  }, [selectedMonth])

  const handleDotSelect = useCallback(
    (monthIndex: number | null) => {
      if (monthIndex == null) {
        onSelectMonth(null)
        return
      }
      const dotRow = chartData.find((d) => d.monthIndex === monthIndex)
      if (dotRow?.monthKey) {
        onSelectMonth(dotRow.monthKey)
      }
    },
    [onSelectMonth, chartData],
  )

  const handleChartClick = useCallback(
    (chartState: { activePayload?: Array<{ payload: { monthKey: string } }> }) => {
      if (!chartState?.activePayload?.length) return
      const clickedKey = chartState.activePayload[0].payload.monthKey
      onSelectMonth(clickedKey === selectedMonth ? null : clickedKey)
    },
    [selectedMonth, onSelectMonth],
  )

  const yAxisFormatter = useCallback((v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`
    return `${v}`
  }, [])

  const chartHeight = isMobile ? 184 : 260
  const xAxisTick = useMemo(
    () => ({
      fill: colors.muted,
      fontSize: isMobile ? 10 : 12,
    }),
    [colors.muted, isMobile],
  )
  const yAxisTick = useMemo(
    () => ({
      fill: colors.muted,
      fontSize: isMobile ? 10 : 12,
    }),
    [colors.muted, isMobile],
  )
  const chartMargin = useMemo(
    () => ({
      top: 10,
      right: isMobile ? 16 : 0,
      left: isMobile ? 0 : 0,
      bottom: isMobile ? 20 : 0,
    }),
    [isMobile],
  )

  if (rows.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center">
        <span className="text-xs text-theme-muted">No data for this year</span>
      </div>
    )
  }

  if (rows.length === 1) {
    const row = rows[0]
    return (
      <div
        className="flex flex-col items-center justify-center gap-2"
        style={{ height: chartHeight }}
      >
        <div
          className="text-2xl font-bold tabular-nums"
          style={{
            color: row.cumulativeRemaining < 0 ? colors.danger : colors.success,
          }}
        >
          {formatAmount(row.cumulativeRemaining)}
        </div>
        <div className="text-xs text-theme-muted">Cash flow after {row.monthLabel}</div>
        <div className="text-[0.625rem] text-theme-muted">Add more months to see the trend</div>
      </div>
    )
  }

  return (
    <div
      aria-label="Cash flow chart showing cumulative surplus or deficit by month"
      style={{ touchAction: isMobile ? 'pan-y pinch-zoom' : 'none' }}
    >
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart
          data={chartData}
          margin={chartMargin}
          onClick={handleChartClick}
          style={{ cursor: 'pointer' }}
        >
          {!isMobile && <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.5} />}
          <XAxis
            dataKey="month"
            tick={xAxisTick}
            axisLine={{ stroke: colors.grid }}
            padding={{ left: 0, right: 0 }}
            interval={0}
            minTickGap={0}
            tickMargin={isMobile ? 8 : 0}
            height={isMobile ? 28 : undefined}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            tick={yAxisTick}
            axisLine={{ stroke: colors.grid }}
            tickFormatter={yAxisFormatter}
            width={isMobile ? 40 : 60}
          />
          {!isMobile && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={yAxisTick}
              axisLine={{ stroke: colors.grid }}
              tickFormatter={yAxisFormatter}
            />
          )}
          {!isMobile && (
            <Tooltip content={<IncomeTrendTooltip colors={colors} formatAmount={formatAmount} />} />
          )}
          {!isMobile && (
            <>
              <ReferenceLine
                yAxisId="left"
                y={0}
                stroke={colors.grid}
                strokeDasharray="4 2"
                strokeWidth={1.5}
              />
              <ReferenceLine
                yAxisId="right"
                y={0}
                stroke={colors.grid}
                strokeDasharray="4 2"
                strokeWidth={1}
                opacity={0.4}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="line"
                wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }}
                payload={legendPayload}
              />
            </>
          )}
          {!isMobile && (
            <>
              {/* Delta bars — rendered first so lines sit on top */}
              {hasPriorData && (
                <Bar
                  yAxisId="right"
                  dataKey="savedDelta"
                  name="savedDelta"
                  legendType="none"
                  maxBarSize={20}
                  opacity={0.35}
                  radius={[2, 2, 0, 0]}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={`delta-${entry.monthKey}`}
                      fill={
                        entry.savedDelta == null
                          ? 'transparent'
                          : entry.savedDelta >= 0
                            ? colors.success
                            : colors.danger
                      }
                    />
                  ))}
                </Bar>
              )}
              {/* Monthly saved this year — right axis, solid thinner */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="monthlySaved"
                name="monthlySaved"
                stroke={colors.primary}
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
              />
              {/* Prior year monthly saved — right axis, dashed muted */}
              {hasPriorData && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="priorSaved"
                  name="priorSaved"
                  stroke={priorLineColor}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  opacity={0.6}
                />
              )}
            </>
          )}
          {/* Cumulative cash flow — drawn as colored SVG via Customized */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="thisYear"
            name="thisYear"
            stroke={colors.success}
            strokeWidth={0}
            dot={false}
            activeDot={false}
            legendType="none"
          />
          <Customized
            component={(props: object) => (
              <ColoredCumulativeLine
                {...(props as ColoredCumulativeLineProps)}
                colors={colors}
                selectedMonth={dotSelectedMonth}
                onSelectMonth={handleDotSelect}
              />
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Brush mini-timeline — full all-time history */}
      {!isMobile && allTimeRows && allTimeRows.length > 1 && (
        <BrushOverview
          allTimeRows={allTimeRows}
          brushIndices={brushIndices}
          defaultBrushIndices={defaultBrushIndices}
          colors={colors}
          onBrushChange={(next) => {
            setBrushIndices(next)
            if (onBrushChange) {
              onBrushChange(allTimeRows.slice(next.start, next.end + 1))
            }
          }}
        />
      )}

      <div className="sr-only" aria-live="polite">
        {selectedMonth !== null && chartData.find((d) => d.monthKey === selectedMonth)
          ? `Selected: ${chartData.find((d) => d.monthKey === selectedMonth)?.month}, cumulative cash flow: ${formatAmount(chartData.find((d) => d.monthKey === selectedMonth)?.thisYear ?? 0)}`
          : 'No month selected'}
      </div>

      <label className="sr-only" htmlFor="income-trend-month-select">
        Select month to preview
      </label>
      <select
        id="income-trend-month-select"
        className="sr-only"
        value={selectedMonth ?? ''}
        onChange={(e) => {
          const val = e.target.value
          onSelectMonth(val === '' ? null : val)
        }}
        aria-label="Select month to preview"
      >
        <option value="">No month selected</option>
        {chartData.map((row) => (
          <option key={row.monthKey} value={row.monthKey}>
            {row.month} — {formatAmount(row.thisYear)} cash flow
          </option>
        ))}
      </select>
    </div>
  )
}
