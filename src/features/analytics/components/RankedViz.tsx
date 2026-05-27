import { useMemo } from 'react'
import EmptyState from '../../../components/ui/EmptyState'
import type { AnalyticsData } from '../../../types'
import { getCategoryColor } from '../../../utils/summaryColorUtils'
import type { ThemeColors } from '../hooks/useThemeColors'

interface RankedVizProps {
  data: AnalyticsData
  focusMonth: number | null
  colors: ThemeColors
  formatAmount: (n: number) => string
}

export function RankedCategoryViz({ data, focusMonth, colors, formatAmount }: RankedVizProps) {
  const rows = useMemo(() => {
    if (focusMonth == null) {
      const yearVariableTotal = (data.variableRows || []).reduce((s, r) => s + r.yearTotal, 0)
      return (data.variableRows || [])
        .filter((row) => row.yearTotal > 0)
        .map((row) => ({
          key: row.key,
          name: row.name,
          focus: row.yearTotal,
          previous: 0,
          total: row.yearTotal,
          share: yearVariableTotal > 0 ? (row.yearTotal / yearVariableTotal) * 100 : 0,
          delta: 0,
        }))
        .sort((a, b) => b.focus - a.focus)
        .slice(0, 8)
    }
    const focusTotal = data.monthlyVariableTotals[focusMonth] || 0
    return (data.variableRows || [])
      .map((row) => {
        const focus = row.amounts[focusMonth] || 0
        const previous = focusMonth > 0 ? row.amounts[focusMonth - 1] || 0 : 0
        return {
          key: row.key,
          name: row.name,
          focus,
          previous,
          total: row.yearTotal,
          share: focusTotal > 0 ? (focus / focusTotal) * 100 : 0,
          delta: focus - previous,
        }
      })
      .filter((row) => row.focus > 0 || row.total > 0)
      .sort((a, b) => b.focus - a.focus || b.total - a.total)
      .slice(0, 8)
  }, [data.variableRows, data.monthlyVariableTotals, focusMonth])

  if (rows.length === 0) return <EmptyState chartHeight message="No category data" />

  const maxAmount = rows[0]?.focus ?? 0

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const barWidth = maxAmount > 0 ? (row.focus / maxAmount) * 100 : 0
        const color = getCategoryColor(row.name)
        const hasDelta = row.previous > 0
        const deltaPositive = row.delta > 0

        return (
          <div key={row.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-theme-text truncate">{row.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasDelta && row.delta !== 0 && (
                  <span
                    className="text-[0.6875rem] font-medium tabular-nums"
                    style={{
                      color: deltaPositive ? colors.danger : colors.success,
                    }}
                  >
                    {deltaPositive ? '+' : '−'}
                    {formatAmount(Math.abs(row.delta))}
                  </span>
                )}
                <span className="text-xs text-theme-muted tabular-nums w-8 text-right">
                  {row.share.toFixed(0)}%
                </span>
                <span className="text-sm font-medium text-theme-text tabular-nums w-20 text-right">
                  {formatAmount(row.focus)}
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-theme-background overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barWidth}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function RankedPayeeViz({ data, focusMonth, colors, formatAmount }: RankedVizProps) {
  const rows = useMemo(() => {
    if (focusMonth == null) {
      const yearPayeeTotal = (data.payeeRows || []).reduce((s, r) => s + r.yearTotal, 0)
      return (data.payeeRows || [])
        .filter((row) => row.yearTotal > 0)
        .map((row) => ({
          key: row.key,
          name: row.name,
          focus: row.yearTotal,
          previous: 0,
          total: row.yearTotal,
          share: yearPayeeTotal > 0 ? (row.yearTotal / yearPayeeTotal) * 100 : 0,
          delta: 0,
        }))
        .sort((a, b) => b.focus - a.focus)
        .slice(0, 8)
    }
    const focusTotal = data.payeeRows.reduce((sum, row) => sum + (row.amounts[focusMonth] || 0), 0)
    return (data.payeeRows || [])
      .map((row) => {
        const focus = row.amounts[focusMonth] || 0
        const previous = focusMonth > 0 ? row.amounts[focusMonth - 1] || 0 : 0
        return {
          key: row.key,
          name: row.name,
          focus,
          previous,
          total: row.yearTotal,
          share: focusTotal > 0 ? (focus / focusTotal) * 100 : 0,
          delta: focus - previous,
        }
      })
      .filter((row) => row.focus > 0 || row.total > 0)
      .sort((a, b) => b.focus - a.focus || b.total - a.total)
      .slice(0, 8)
  }, [data.payeeRows, focusMonth])

  if (rows.length === 0) return <EmptyState chartHeight message="No payee data" />

  const maxAmount = rows[0]?.focus ?? 0

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const barWidth = maxAmount > 0 ? (row.focus / maxAmount) * 100 : 0
        const hasDelta = row.previous > 0
        const deltaPositive = row.delta > 0

        return (
          <div key={row.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-theme-primary" />
                <span className="text-sm text-theme-text truncate">{row.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasDelta && row.delta !== 0 && (
                  <span
                    className="text-[0.6875rem] font-medium tabular-nums"
                    style={{
                      color: deltaPositive ? colors.danger : colors.success,
                    }}
                  >
                    {deltaPositive ? '+' : '−'}
                    {formatAmount(Math.abs(row.delta))}
                  </span>
                )}
                <span className="text-xs text-theme-muted tabular-nums w-8 text-right">
                  {row.share.toFixed(0)}%
                </span>
                <span className="text-sm font-medium text-theme-text tabular-nums w-20 text-right">
                  {formatAmount(row.focus)}
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-theme-background overflow-hidden">
              <div
                className="h-full rounded-full bg-theme-primary transition-all duration-500"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
