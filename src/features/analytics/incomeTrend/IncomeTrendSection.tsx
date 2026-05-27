import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '../../../context/settingsContext'
import { useViewportWidth } from '../../../hooks/useViewportWidth'
import type { AnalyticsData, Category, Expense, Payee } from '../../../types'
import type { AllTimeRow } from '../utils/analyticsTrendUtils'
import {
  buildAllYearsTrendRows,
  buildRangeAnalyticsData,
  buildYearTrendRows,
} from '../utils/analyticsTrendUtils'
import {
  RankedCategoryTable,
  RankedCategoryViz,
  RankedPayeeTable,
  RankedPayeeViz,
} from '../AnalyticsCharts'
import PrivateValue from '../../../components/privacy/PrivateValue'
import IncomeFlowBar from '../IncomeFlowBar'
import ViewToggle from '../ViewToggle'
import { useThemeColors } from '../hooks/useThemeColors'
import IncomeTrendExpensePreview from './IncomeTrendExpensePreview'
import IncomeTrendMonthDrilldown from './IncomeTrendMonthDrilldown'
import IncomeTrendMonthPreview from './IncomeTrendMonthPreview'
import IncomeTrendYearChart from './IncomeTrendYearChart'

interface IncomeTrendSectionProps {
  data: AnalyticsData
  expenses: Expense[]
  categories: Category[]
  payees: Payee[]
  year: number
  currentYear: number
  currentMonth: number
  priorYearsData: AnalyticsData[]
  trendKey: string | null
  trendDrilldown: boolean
  onTrendStateChange: (patch: { trendKey?: string | null; trendDrilldown?: boolean }) => void
  monthCount: number
  isCurrentYear: boolean
  multiYearData: AnalyticsData[]
  panToYear?: number | null
  panToYearVersion?: number // increment to force re-pan even to the same year
  onBrushWindowChange?: (window: AllTimeRow[]) => void
}

export default function IncomeTrendSection({
  data,
  expenses,
  categories,
  payees,
  year,
  currentYear,
  currentMonth,
  priorYearsData,
  trendKey,
  trendDrilldown,
  onTrendStateChange,
  monthCount,
  isCurrentYear,
  multiYearData,
  panToYear,
  panToYearVersion,
  onBrushWindowChange,
}: IncomeTrendSectionProps) {
  const { formatAmount, formatDate } = useSettings()
  const colors = useThemeColors()
  const isMobile = useViewportWidth() < 640

  const trendRows = useMemo(
    () => buildYearTrendRows(data, expenses, year, currentYear, currentMonth, priorYearsData),
    [data, expenses, year, currentYear, currentMonth, priorYearsData],
  )

  // Build prior year rows for YTD comparison (last year, same months)
  const priorYearRows = useMemo(() => {
    const priorData = priorYearsData[priorYearsData.length - 1]
    if (!priorData || priorData.loading) return null
    const priorYear = year - 1
    // For current year: only show prior year up to the same month (apples-to-apples)
    // For past years: show all 12 months of the prior year
    const priorCurrentMonth = isCurrentYear ? currentMonth : 11
    return buildYearTrendRows(
      priorData,
      expenses.filter((e) => e.date?.startsWith(`${priorYear}-`)),
      priorYear,
      priorYear, // treat prior year as its own "current year" so all months show
      priorCurrentMonth,
      priorYearsData.slice(0, -1), // prior years before the comparison year
    )
  }, [priorYearsData, year, isCurrentYear, currentMonth, expenses])

  // All-time rows for the brush mini-timeline
  const allTimeRows = useMemo(() => {
    const allYears = [...multiYearData.map((d) => ({ year: d.year, data: d })), { year, data }]
      .sort((a, b) => a.year - b.year)
      // deduplicate — keep the last entry for each year (current year's `data` wins)
      .filter((entry, idx, arr) => idx === arr.findLastIndex((e) => e.year === entry.year))
    return buildAllYearsTrendRows(allYears, currentYear, currentMonth)
  }, [multiYearData, year, data, currentYear, currentMonth])

  // Brush window state — null means "use the selected year" (default)
  const [brushWindow, setBrushWindow] = useState<AllTimeRow[] | null>(null)

  // Reset brush when year changes
  const prevYear = useRef(year)
  if (prevYear.current !== year) {
    prevYear.current = year
    setBrushWindow(null)
  }

  // Pan/reset brush to a specific year when requested from outside.
  // panToYearVersion increments on every click so the same year can be re-selected.
  const prevPanVersion = useRef(panToYearVersion)
  if (prevPanVersion.current !== panToYearVersion && panToYear != null) {
    prevPanVersion.current = panToYearVersion
    const yearSlice = allTimeRows.filter((r) => r.year === panToYear)
    if (yearSlice.length > 0) {
      setBrushWindow(yearSlice)
      onBrushWindowChange?.(yearSlice)
    }
  }

  const handleBrushChange = useCallback(
    (window: AllTimeRow[]) => {
      // If the window exactly matches the selected year, treat as default (no filter)
      const isDefaultWindow =
        window.length > 0 &&
        window.every((r) => r.year === year) &&
        window.length === trendRows.length
      const next = isDefaultWindow ? null : window
      setBrushWindow(next)
      onBrushWindowChange?.(next ?? [])
      // Clear month selection when brush spans multiple years — month index is ambiguous
      if (next?.some((r) => r.year !== next[0].year)) {
        onTrendStateChange({ trendKey: null, trendDrilldown: false })
      }
    },
    [year, trendRows.length, onBrushWindowChange, onTrendStateChange],
  )

  // Build the all-years lookup for range data computation
  const allYearsLookup = useMemo(() => {
    const allYears = [
      ...multiYearData.map((d) => ({ year: d.year, data: d })),
      { year, data },
    ].filter((entry, idx, arr) => idx === arr.findLastIndex((e) => e.year === entry.year))
    return allYears
  }, [multiYearData, year, data])

  // Compute range-filtered AnalyticsData when brush is active
  const rangeData = useMemo(() => {
    if (!brushWindow || brushWindow.length === 0) return data
    return buildRangeAnalyticsData(brushWindow, allYearsLookup)
  }, [brushWindow, data, allYearsLookup])

  // Range-filtered expenses
  const rangeExpenses = useMemo(() => {
    if (!brushWindow || brushWindow.length === 0) return expenses
    const keys = new Set(brushWindow.map((r) => r.monthKey))
    return expenses.filter((e) => e.date && keys.has(e.date.slice(0, 7)))
  }, [brushWindow, expenses])

  // Range-filtered monthly arrays (for IncomeFlowBar)
  const rangeMonthlyIncome = rangeData.monthlyIncome
  const rangeMonthlyFixed = rangeData.monthlyFixedTotals
  const rangeMonthlyVariable = rangeData.monthlyVariableTotals
  const rangeMonthlyRemaining = rangeData.monthlyRemaining
  const rangeMonthlySavings = rangeData.monthlySavings
  const rangeMonthCount = brushWindow ? brushWindow.length : monthCount
  const rangeIsCurrentYear = !brushWindow && isCurrentYear

  // Range label for the header
  const rangeLabel = useMemo(() => {
    if (!brushWindow || brushWindow.length === 0) return null
    const first = brushWindow[0]
    const last = brushWindow[brushWindow.length - 1]
    if (first.monthKey === last.monthKey) return first.label
    return `${first.label} – ${last.label}`
  }, [brushWindow])

  const ytdSaved = useMemo(() => {
    if (brushWindow && brushWindow.length > 0) {
      // Sum saved from rangeData (already covers the brush window)
      return (rangeData.monthlyTotalSavings as (number | null)[]).reduce<number>(
        (s, v) => s + (v ?? 0),
        0,
      )
    }
    return trendRows.reduce((sum, r) => sum + r.saved, 0)
  }, [brushWindow, rangeData, trendRows])

  const priorYtdSaved = useMemo(() => {
    if (brushWindow && brushWindow.length > 0) {
      // For each month in the brush window, look up the same month one year prior
      // from allTimeRows
      return brushWindow.reduce<number | null>((sum, row) => {
        const priorKey = `${row.year - 1}-${String(row.monthIndex + 1).padStart(2, '0')}`
        const priorRow = allTimeRows.find((r) => r.monthKey === priorKey)
        if (priorRow == null) return null // prior year data missing — can't compare
        return (sum ?? 0) + priorRow.saved
      }, 0)
    }
    return priorYearRows?.reduce((sum, r) => sum + r.saved, 0) ?? null
  }, [brushWindow, allTimeRows, priorYearRows])

  const ytdDelta = priorYtdSaved != null ? ytdSaved - priorYtdSaved : null
  const ytdDeltaPct =
    ytdDelta != null && priorYtdSaved !== 0 && priorYtdSaved != null
      ? (ytdDelta / Math.abs(priorYtdSaved)) * 100
      : null

  const yearTopExpenses = useMemo(() => {
    return rangeExpenses.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, 20)
  }, [rangeExpenses])

  // Spending spikes: months above average + the category that drove the biggest jump
  const spendingSpikes = useMemo(() => {
    const activeRows = brushWindow
      ? brushWindow.map((r, i) => ({
          monthLabel: r.label,
          monthIndex: i,
          expenses: rangeData.monthlyTotals[i] ?? 0,
        }))
      : trendRows.map((r) => ({
          monthLabel: r.monthLabel,
          monthIndex: r.monthIndex,
          expenses: r.expenses,
        }))
    if (activeRows.length < 2) return []
    const avg = activeRows.reduce((s, r) => s + r.expenses, 0) / activeRows.length
    if (avg === 0) return []

    return activeRows
      .filter((r) => r.expenses > avg * 1.1)
      .map((r) => {
        const topCat =
          (rangeData.variableRows ?? [])
            .map((row) => {
              const thisMonth = row.amounts[r.monthIndex] ?? 0
              const prevMonth = r.monthIndex > 0 ? (row.amounts[r.monthIndex - 1] ?? 0) : 0
              return {
                name: row.name,
                amount: thisMonth,
                delta: thisMonth - prevMonth,
              }
            })
            .filter((c) => c.amount > 0)
            .sort((a, b) => b.delta - a.delta)[0] ?? null
        return {
          monthLabel: r.monthLabel,
          expenses: r.expenses,
          aboveAvgPct: ((r.expenses - avg) / avg) * 100,
          topCat,
        }
      })
      .sort((a, b) => b.aboveAvgPct - a.aboveAvgPct)
      .slice(0, 5)
  }, [brushWindow, trendRows, rangeData])

  // When brush is active on a single year, the active rows are the brush window
  // rows (re-indexed 0..n-1). Otherwise use the current year's trendRows.
  const activeTrendRows = useMemo(() => {
    if (!brushWindow || brushWindow.length === 0) return trendRows
    const spansMultiple = brushWindow.some((r) => r.year !== brushWindow[0].year)
    if (spansMultiple) return trendRows
    return brushWindow.map((r, i) => ({
      monthIndex: i,
      monthKey: r.monthKey,
      monthLabel: r.label,
      income: r.income,
      expenses: r.expenses,
      saved: r.saved,
      savingsRate: r.savingsRate,
      expenseCount: 0,
      hasData: r.hasData,
      cumulativeRemaining: r.cumulativeRemaining,
    }))
  }, [brushWindow, trendRows])

  const selectedTrendYear = trendKey ? parseInt(trendKey.split('-')[0], 10) : null
  const selectedTrendMonthIndex = trendKey ? parseInt(trendKey.split('-')[1], 10) - 1 : null

  const selectedTrendRow = useMemo(() => {
    if (!trendKey) return null
    // Brush mode — look up from all-time data
    if (brushWindow) {
      const row = allTimeRows?.find((r) => r.monthKey === trendKey)
      if (row) return row
    }
    // Single-year mode — look up from trend rows
    return activeTrendRows.find((r) => r.monthKey === trendKey) ?? null
  }, [trendKey, brushWindow, allTimeRows, activeTrendRows])

  const previewRef = useRef<HTMLDivElement>(null)

  const [catViz, setCatViz] = useState(true)
  const [payeeViz, setPayeeViz] = useState(true)

  useEffect(() => {
    if (trendKey !== null && !trendDrilldown && previewRef.current) {
      previewRef.current.focus()
    }
  }, [trendKey, trendDrilldown])

  return (
    <section
      className="rounded-theme-large border border-theme-border bg-theme-surface overflow-hidden"
      data-testid="income-trend-section"
      aria-labelledby="income-trend-heading"
    >
      {data.loading ? (
        <div className="px-4 py-8 sm:px-5 flex items-center justify-center">
          <span className="text-xs text-theme-muted">Loading…</span>
        </div>
      ) : trendDrilldown &&
        selectedTrendRow &&
        selectedTrendYear != null &&
        selectedTrendMonthIndex != null ? (
        <IncomeTrendMonthDrilldown
          data={rangeData}
          expenses={rangeExpenses}
          categories={categories}
          payees={payees}
          year={selectedTrendYear}
          monthIndex={selectedTrendMonthIndex}
          cumulativeRemaining={selectedTrendRow.cumulativeRemaining}
          colors={colors}
          formatAmount={formatAmount}
          formatDate={formatDate}
          onBack={() => onTrendStateChange({ trendDrilldown: false })}
          multiYearData={multiYearData}
        />
      ) : (
        <>
          <div className="px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
            <h2
              id="income-trend-heading"
              className="text-sm font-semibold text-theme-text tracking-tight"
            >
              Savings & Cash Flow
            </h2>
            <p className="text-xs text-theme-muted mt-0.5">
              {isMobile
                ? 'Cumulative savings'
                : 'Monthly savings vs last year · cumulative surplus or deficit'}
              {rangeLabel && (
                <span className="ml-2 font-medium text-theme-primary">· {rangeLabel}</span>
              )}
            </p>

            {/* YTD savings delta stat */}
            <div className="flex items-baseline gap-3 mt-3 flex-wrap">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-theme-muted">Savings:</span>
                <span
                  className="text-base font-bold tabular-nums"
                  style={{
                    color: ytdSaved >= 0 ? colors.success : colors.danger,
                  }}
                >
                  <PrivateValue>{formatAmount(ytdSaved)}</PrivateValue>
                </span>
              </div>
              {ytdDelta != null && (
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{
                      color: ytdDelta >= 0 ? colors.success : colors.danger,
                    }}
                  >
                    {ytdDelta >= 0 ? '↑' : '↓'}{' '}
                    <PrivateValue>{formatAmount(Math.abs(ytdDelta))}</PrivateValue>
                  </span>
                  <span className="text-xs text-theme-muted">
                    vs{' '}
                    {brushWindow && brushWindow.length > 0
                      ? `${brushWindow[0].label.replace(/\d+$/, String(brushWindow[0].year - 1).slice(2))} – ${brushWindow[brushWindow.length - 1].label.replace(/\d+$/, String(brushWindow[brushWindow.length - 1].year - 1).slice(2))}`
                      : year - 1}
                  </span>
                  {ytdDeltaPct != null && (
                    <span
                      className="text-xs font-medium tabular-nums"
                      style={{
                        color: ytdDelta >= 0 ? colors.success : colors.danger,
                      }}
                    >
                      ({ytdDelta >= 0 ? '+' : ''}
                      {ytdDeltaPct.toFixed(1)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="px-4 pb-2 sm:px-5">
            <IncomeTrendYearChart
              rows={trendRows}
              priorRows={priorYearRows}
              priorYear={year - 1}
              selectedMonth={trendKey}
              onSelectMonth={(key) => {
                onTrendStateChange({ trendKey: key })
              }}
              colors={colors}
              formatAmount={formatAmount}
              allTimeRows={allTimeRows}
              selectedYear={year}
              onBrushChange={handleBrushChange}
              externalBrushWindow={brushWindow}
              externalBrushVersion={panToYearVersion}
            />
          </div>

          {/* Month preview — only when a dot is selected */}
          {selectedTrendRow && (
            <IncomeTrendMonthPreview
              ref={previewRef}
              row={selectedTrendRow}
              prevCumulativeRemaining={
                selectedTrendMonthIndex != null && selectedTrendMonthIndex > 0
                  ? (activeTrendRows.find(
                      (r) =>
                        r.monthIndex === selectedTrendMonthIndex - 1 &&
                        r.monthKey?.startsWith(String(selectedTrendYear)),
                    )?.cumulativeRemaining ?? null)
                  : null
              }
              colors={colors}
              formatAmount={formatAmount}
              onViewMonth={() => onTrendStateChange({ trendDrilldown: true })}
              onDismiss={() => onTrendStateChange({ trendKey: null, trendDrilldown: false })}
            />
          )}

          <div className="px-4 pb-4 sm:px-5 border-t border-theme-border pt-4">
            <IncomeFlowBar
              yearIncome={rangeData.yearTotalIncome}
              yearFixed={rangeData.yearFixedTotal}
              yearVariable={rangeData.yearVariableTotal}
              yearSavings={rangeData.yearSavings}
              yearRemaining={rangeData.yearRemaining}
              monthlyIncome={rangeMonthlyIncome}
              monthlyFixed={rangeMonthlyFixed}
              monthlyVariable={rangeMonthlyVariable}
              monthlySavings={rangeMonthlySavings}
              monthlyRemaining={rangeMonthlyRemaining}
              selectedMonth={brushWindow ? null : selectedTrendMonthIndex}
              monthCount={rangeMonthCount}
              isCurrentYear={rangeIsCurrentYear}
              year={year}
              formatAmount={formatAmount}
            />
          </div>

          {/* Category Movement + Payee Concentration */}
          <div className="px-4 py-4 sm:px-5 border-t border-theme-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Category Movement
                  </h3>
                  <ViewToggle isViz={catViz} onToggle={() => setCatViz((v) => !v)} />
                </div>
                {catViz ? (
                  <RankedCategoryViz
                    data={rangeData}
                    focusMonth={null}
                    colors={colors}
                    formatAmount={formatAmount}
                  />
                ) : (
                  <RankedCategoryTable data={rangeData} focusMonth={null} focusLabel="Year total" />
                )}
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Payee Concentration
                  </h3>
                  <ViewToggle isViz={payeeViz} onToggle={() => setPayeeViz((v) => !v)} />
                </div>
                {payeeViz ? (
                  <RankedPayeeViz
                    data={rangeData}
                    focusMonth={null}
                    colors={colors}
                    formatAmount={formatAmount}
                  />
                ) : (
                  <RankedPayeeTable data={rangeData} focusMonth={null} focusLabel="Year total" />
                )}
              </div>
            </div>
          </div>

          {/* Year top expenses + spending spikes — two column layout */}
          <div className="px-4 py-4 sm:px-5 border-t border-theme-border grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Spending Spikes */}
            <div>
              <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
                Spending Spikes
              </h3>
              {spendingSpikes.length === 0 ? (
                <p className="text-xs text-theme-muted py-2 text-center">
                  No unusual months this year
                </p>
              ) : (
                <ul className="divide-y divide-theme-border">
                  {spendingSpikes.map((spike) => (
                    <li
                      key={spike.monthLabel}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-theme-text truncate">
                          {spike.monthLabel}
                          {spike.topCat && (
                            <span className="text-theme-muted font-normal">
                              {' '}
                              · ↑ {spike.topCat.name}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-theme-muted truncate">
                          +{spike.aboveAvgPct.toFixed(0)}% above avg
                          {spike.topCat && spike.topCat.delta > 0 && (
                            <span className="text-theme-danger">
                              {' '}
                              · +{formatAmount(spike.topCat.delta)}
                            </span>
                          )}
                          {spike.topCat && spike.topCat.delta === spike.topCat.amount && (
                            <span> · new</span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums shrink-0 text-theme-danger">
                        {spike.topCat
                          ? formatAmount(spike.topCat.amount)
                          : formatAmount(spike.expenses)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Top Expenses */}
            <div>
              <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
                Top Expenses
              </h3>
              <IncomeTrendExpensePreview
                expenses={yearTopExpenses}
                categories={categories}
                payees={payees}
                formatAmount={formatAmount}
                formatDate={formatDate}
              />
            </div>
          </div>
        </>
      )}
    </section>
  )
}
