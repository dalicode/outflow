import { useMemo } from 'react'
import AnalyticsBreakdownTable from './AnalyticsBreakdownTable'
import EmptyState from '../../../components/ui/EmptyState'
import type { AnalyticsData } from '../../../types'
import { fmtFull } from '../../../utils/analyticsFormatting'
import { cn } from '../../../lib/cn'
import { fmtChange } from '../utils/analyticsChartUtils'

interface RankedCategoryTableProps {
  data: AnalyticsData
  focusMonth: number | null
  focusLabel: string
}

export function RankedCategoryTable({ data, focusMonth, focusLabel }: RankedCategoryTableProps) {
  const rows = useMemo(() => {
    if (focusMonth == null) {
      const yearVariableTotal = (data.variableRows || []).reduce(
        (sum, row) => sum + row.yearTotal,
        0,
      )
      return (data.variableRows || [])
        .filter((row) => row.yearTotal > 0)
        .map((row) => ({
          key: row.key,
          name: row.name,
          focus: row.yearTotal,
          previous: 0,
          total: row.yearTotal,
          share: yearVariableTotal > 0 ? (row.yearTotal / yearVariableTotal) * 100 : 0,
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
        }
      })
      .filter((row) => row.focus > 0 || row.total > 0)
      .sort((a, b) => b.focus - a.focus || b.total - a.total)
      .slice(0, 8)
  }, [data.variableRows, data.monthlyVariableTotals, focusMonth])

  if (rows.length === 0) return <EmptyState chartHeight message="No category data" />

  return (
    <AnalyticsBreakdownTable
      headers={[
        { key: 'category', label: 'Category' },
        { key: 'focus', label: focusLabel },
        { key: 'previous', label: 'Previous' },
        { key: 'delta', label: 'Delta' },
        { key: 'share', label: 'Share' },
        { key: 'year-total', label: 'Year total' },
      ]}
    >
      {rows.map((row) => {
        const delta = row.focus - row.previous
        return (
          <tr key={row.key}>
            <td className="font-semibold text-theme-text">{row.name}</td>
            <td className="tabular-nums">{fmtFull(row.focus)}</td>
            <td className="tabular-nums">{fmtFull(row.previous)}</td>
            <td
              className={cn(
                'tabular-nums',
                delta === 0
                  ? 'text-theme-muted'
                  : delta > 0
                    ? 'text-theme-danger'
                    : 'text-theme-success',
              )}
            >
              {fmtChange(delta)}
            </td>
            <td className="tabular-nums">{`${row.share.toFixed(1)}%`}</td>
            <td className="tabular-nums">{fmtFull(row.total)}</td>
          </tr>
        )
      })}
    </AnalyticsBreakdownTable>
  )
}

interface RankedPayeeTableProps {
  data: AnalyticsData
  focusMonth: number | null
  focusLabel: string
}

export function RankedPayeeTable({ data, focusMonth, focusLabel }: RankedPayeeTableProps) {
  const rows = useMemo(() => {
    if (focusMonth == null) {
      const yearPayeeTotal = (data.payeeRows || []).reduce((sum, row) => sum + row.yearTotal, 0)
      return (data.payeeRows || [])
        .filter((row) => row.yearTotal > 0)
        .map((row) => ({
          key: row.key,
          name: row.name,
          focus: row.yearTotal,
          previous: 0,
          total: row.yearTotal,
          share: yearPayeeTotal > 0 ? (row.yearTotal / yearPayeeTotal) * 100 : 0,
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
        }
      })
      .filter((row) => row.focus > 0 || row.total > 0)
      .sort((a, b) => b.focus - a.focus || b.total - a.total)
      .slice(0, 8)
  }, [data.payeeRows, focusMonth])

  if (rows.length === 0) return <EmptyState chartHeight message="No payee data" />

  return (
    <AnalyticsBreakdownTable
      headers={[
        { key: 'payee', label: 'Payee' },
        { key: 'focus', label: focusLabel },
        { key: 'previous', label: 'Previous' },
        { key: 'delta', label: 'Delta' },
        { key: 'share', label: 'Share' },
        { key: 'year-total', label: 'Year total' },
      ]}
    >
      {rows.map((row) => {
        const delta = row.focus - row.previous
        return (
          <tr key={row.key}>
            <td className="font-semibold text-theme-text">{row.name}</td>
            <td className="tabular-nums">{fmtFull(row.focus)}</td>
            <td className="tabular-nums">{fmtFull(row.previous)}</td>
            <td
              className={cn(
                'tabular-nums',
                delta === 0
                  ? 'text-theme-muted'
                  : delta > 0
                    ? 'text-theme-danger'
                    : 'text-theme-success',
              )}
            >
              {fmtChange(delta)}
            </td>
            <td className="tabular-nums">{`${row.share.toFixed(1)}%`}</td>
            <td className="tabular-nums">{fmtFull(row.total)}</td>
          </tr>
        )
      })}
    </AnalyticsBreakdownTable>
  )
}
