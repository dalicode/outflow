import { useMemo } from 'react'
import type {
  MonthKey,
  MonthlySummary,
  MultiMonthCategoryRow,
  MultiMonthFixedRow,
} from '../../types'
import PrivateValue from '../../components/privacy/PrivateValue'
import { useSettings } from '../../context/settingsContext'
import { cn } from '../../lib/cn'
import { getSavingsGradientColor } from '../../utils/colorHelpers'
import { getRemainingDisplayState } from '../../utils/remainingDisplayState'

interface MultiMonthViewTableProps {
  entityLabel: string
  rows: MultiMonthCategoryRow[]
  multiFixedRows: MultiMonthFixedRow[]
  monthSummaries: MonthlySummary[]
  monthKeys: MonthKey[]
  monthSpan: number
  showGrandTotal: boolean
  onRowClick: (name: string, monthIndex: number) => void
  onIncomeClick: (monthIndex: number) => void
  onSavingsClick: (monthIndex: number) => void
  formatAmount: (n: number) => string
  getNumberColorClass: (n: number) => string
  emptyMessage: string
}

export default function MultiMonthViewTable({
  entityLabel,
  rows,
  multiFixedRows,
  monthSummaries,
  monthKeys,
  monthSpan,
  showGrandTotal,
  onRowClick,
  onIncomeClick,
  onSavingsClick,
  formatAmount,
  getNumberColorClass,
  emptyMessage,
}: MultiMonthViewTableProps) {
  const { currentTheme } = useSettings()
  const reversedMonthKeys = useMemo(() => [...monthKeys].reverse(), [monthKeys])
  const editableAmountButtonClass =
    'font-semibold text-theme-text decoration-transparent underline-offset-2 transition-[color,text-decoration-color] hover:underline hover:decoration-current focus-visible:underline focus-visible:decoration-current'

  const now = new Date()
  const isFutureMonth = (mk: MonthKey | undefined) => {
    if (!mk) return false
    return (
      mk.year > now.getFullYear() || (mk.year === now.getFullYear() && mk.month > now.getMonth())
    )
  }

  const totalSavingsData = useMemo(() => {
    return monthSummaries.map((summary) => {
      const totalSavings = summary.autoSavings + summary.remaining
      const ratioPct = summary.income > 0 ? (totalSavings / summary.income) * 100 : 0
      const color = getSavingsGradientColor(ratioPct, summary.savingsRate)
      return { totalSavings, color }
    })
  }, [monthSummaries])

  const grandTotalSavings = useMemo(() => {
    const grandTotal = monthSummaries.reduce((s, m) => s + m.autoSavings + m.remaining, 0)
    const totalIncome = monthSummaries.reduce((s, m) => s + m.income, 0)
    const avgRate =
      monthSummaries.length > 0
        ? monthSummaries.reduce((s, m) => s + m.savingsRate, 0) / monthSummaries.length
        : 0
    const ratioPct = totalIncome > 0 ? (grandTotal / totalIncome) * 100 : 0
    const color = getSavingsGradientColor(ratioPct, avgRate)
    return { grandTotal, color }
  }, [monthSummaries])

  const remainingDisplayColors = useMemo(() => {
    return monthSummaries.map(
      (summary) => getRemainingDisplayState(summary, currentTheme.colors).remainingDisplayColor,
    )
  }, [currentTheme.colors, monthSummaries])

  const remainingGrandTotalDisplayColor = useMemo(() => {
    const grandTotalSummary: MonthlySummary = {
      income: monthSummaries.reduce((s, m) => s + m.income, 0),
      fixedExpensesTotal: monthSummaries.reduce((s, m) => s + m.fixedExpensesTotal, 0),
      savingsRate: 0,
      autoSavings: monthSummaries.reduce((s, m) => s + m.autoSavings, 0),
      remaining: monthSummaries.reduce((s, m) => s + m.remaining, 0),
      variableExpenses: monthSummaries.reduce((s, m) => s + m.variableExpenses, 0),
      fixedExpenses: [],
    }

    return getRemainingDisplayState(grandTotalSummary, currentTheme.colors).remainingDisplayColor
  }, [currentTheme.colors, monthSummaries])

  const colSpanCount = monthSpan > 1 ? 2 + monthSpan + (showGrandTotal ? 1 : 0) : 3

  return (
    <div className="w-full">
      <table className="w-full table-auto text-sm border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-left min-w-[8rem]">
              {entityLabel}
            </th>
            {monthSpan > 1 ? (
              <>
                <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-right tabular-nums">
                  Count
                </th>
                {reversedMonthKeys.map((mk, displayIdx) => (
                  <th
                    key={mk.key}
                    className={cn(
                      'table-header-cell text-right tabular-nums',
                      displayIdx === 0 && 'border-l border-theme-border',
                    )}
                  >
                    {mk.name}
                  </th>
                ))}
                {showGrandTotal && (
                  <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-right tabular-nums">
                    Total
                  </th>
                )}
              </>
            ) : (
              <>
                <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-right tabular-nums">
                  Count
                </th>
                <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-right tabular-nums">
                  Amount
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colSpanCount} className="px-3 py-12 text-center text-theme-muted w-full">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map(({ name, totalTransactions, monthlyAmounts }) => (
              <tr key={name} className="border-b border-theme-muted-subtle row-hover">
                <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text font-medium min-w-[8rem] overflow-hidden">
                  <span className="block min-w-[8rem] truncate">{name}</span>
                </td>
                {monthSpan > 1 ? (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      {totalTransactions}
                    </td>
                    {[...monthlyAmounts].reverse().map((amount, displayIdx) => {
                      const dataIdx = monthKeys.length - 1 - displayIdx
                      return (
                        <td
                          key={monthKeys[dataIdx].key}
                          className={cn(
                            'px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums',
                            displayIdx === 0 && 'border-l border-theme-border',
                          )}
                        >
                          {amount !== 0 ? (
                            <button
                              type="button"
                              onClick={() => onRowClick(name, dataIdx)}
                              className={cn(editableAmountButtonClass, getNumberColorClass(amount))}
                            >
                              {formatAmount(amount)}
                            </button>
                          ) : (
                            <span className="text-theme-muted">—</span>
                          )}
                        </td>
                      )
                    })}
                    {showGrandTotal && (
                      <td
                        className={cn(
                          'px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold',
                          getNumberColorClass(monthlyAmounts.reduce((s, v) => s + v, 0)),
                        )}
                      >
                        {formatAmount(monthlyAmounts.reduce((s, v) => s + v, 0))}
                      </td>
                    )}
                  </>
                ) : (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      {totalTransactions}
                    </td>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums">
                      {monthlyAmounts[0] !== 0 ? (
                        <button
                          type="button"
                          onClick={() => onRowClick(name, 0)}
                          className={cn(
                            editableAmountButtonClass,
                            getNumberColorClass(monthlyAmounts[0]),
                          )}
                        >
                          {formatAmount(monthlyAmounts[0])}
                        </button>
                      ) : (
                        <span className="text-theme-muted">—</span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))
          )}

          {multiFixedRows.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={colSpanCount}
                  className="table-header-cell px-1.5 sm:px-2 md:px-3 whitespace-nowrap min-w-[8rem] overflow-hidden"
                >
                  Fixed Expenses
                </td>
              </tr>
              {multiFixedRows.map((fe) => {
                const fixedGrandTotal = fe.monthlyAmounts.reduce((s, v) => (s ?? 0) + (v ?? 0), 0)
                return (
                  <tr key={fe.id} className="row-hover">
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text min-w-[8rem] overflow-hidden">
                      <span className="block min-w-[8rem] truncate">{fe.name}</span>
                    </td>
                    {monthSpan > 1 ? (
                      <>
                        <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                          —
                        </td>
                        {[...fe.monthlyAmounts].reverse().map((amount, displayIdx) => {
                          const dataIdx = monthKeys.length - 1 - displayIdx
                          return (
                            <td
                              key={monthKeys[dataIdx].key}
                              className={cn(
                                'px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-medium text-theme-text',
                                displayIdx === 0 && 'border-l border-theme-border',
                              )}
                            >
                              {amount !== null ? (
                                <PrivateValue>{formatAmount(amount)}</PrivateValue>
                              ) : (
                                '—'
                              )}
                            </td>
                          )
                        })}
                        {showGrandTotal && (
                          <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold text-theme-text">
                            <PrivateValue>{formatAmount(fixedGrandTotal ?? 0)}</PrivateValue>
                          </td>
                        )}
                      </>
                    ) : (
                      <>
                        <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                          —
                        </td>
                        <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-medium text-theme-text">
                          {fe.monthlyAmounts[0] !== null ? (
                            <PrivateValue>{formatAmount(fe.monthlyAmounts[0])}</PrivateValue>
                          ) : (
                            '—'
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </>
          )}

          {monthSummaries.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={colSpanCount}
                  className="table-header-cell px-1.5 sm:px-2 md:px-3 whitespace-nowrap min-w-[8rem] overflow-hidden"
                >
                  Budget Summary
                </td>
              </tr>

              {/* Income */}
              <tr className="row-hover">
                <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text font-medium min-w-[8rem] overflow-hidden">
                  <span className="block min-w-[8rem] truncate">Income</span>
                </td>
                {monthSpan > 1 ? (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      —
                    </td>
                    {[...monthSummaries].reverse().map((summary, displayIdx) => {
                      const dataIdx = monthSummaries.length - 1 - displayIdx
                      return (
                        <td
                          key={monthKeys[dataIdx].key}
                          className={cn(
                            'px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums',
                            displayIdx === 0 && 'border-l border-theme-border',
                          )}
                        >
                          {isFutureMonth(monthKeys[dataIdx]) ? (
                            <span
                              className="font-semibold text-theme-text cursor-not-allowed opacity-70"
                              title="Use Schedule to change future values"
                            >
                              <PrivateValue>{formatAmount(summary.income)}</PrivateValue>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onIncomeClick(dataIdx)}
                              className={cn('group', editableAmountButtonClass)}
                            >
                              <PrivateValue className="group-hover:underline group-focus-visible:underline">
                                {formatAmount(summary.income)}
                              </PrivateValue>
                            </button>
                          )}
                        </td>
                      )
                    })}
                    {showGrandTotal && (
                      <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold text-theme-text">
                        <PrivateValue>
                          {formatAmount(monthSummaries.reduce((s, m) => s + m.income, 0))}
                        </PrivateValue>
                      </td>
                    )}
                  </>
                ) : (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      —
                    </td>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums">
                      {isFutureMonth(monthKeys[0]) ? (
                        <span
                          className="font-semibold text-theme-text cursor-not-allowed opacity-70"
                          title="Use Schedule to change future values"
                        >
                          <PrivateValue>{formatAmount(monthSummaries[0].income)}</PrivateValue>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onIncomeClick(0)}
                          className={cn('group', editableAmountButtonClass)}
                        >
                          <PrivateValue className="group-hover:underline group-focus-visible:underline">
                            {formatAmount(monthSummaries[0].income)}
                          </PrivateValue>
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>

              {/* Auto Savings */}
              <tr className="row-hover">
                <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text font-medium min-w-[8rem] overflow-hidden">
                  <span className="block min-w-[8rem] truncate">Auto Savings</span>
                </td>
                {monthSpan > 1 ? (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      —
                    </td>
                    {[...monthSummaries].reverse().map((summary, displayIdx) => {
                      const dataIdx = monthSummaries.length - 1 - displayIdx
                      return (
                        <td
                          key={monthKeys[dataIdx].key}
                          className={cn(
                            'px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums',
                            displayIdx === 0 && 'border-l border-theme-border',
                          )}
                        >
                          {isFutureMonth(monthKeys[dataIdx]) ? (
                            <span
                              className="font-semibold text-theme-text cursor-not-allowed opacity-70"
                              title="Use Schedule to change future values"
                            >
                              <PrivateValue>{formatAmount(summary.autoSavings)}</PrivateValue>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSavingsClick(dataIdx)}
                              className={cn('group', editableAmountButtonClass)}
                            >
                              <PrivateValue className="group-hover:underline group-focus-visible:underline">
                                {formatAmount(summary.autoSavings)}
                              </PrivateValue>
                            </button>
                          )}
                        </td>
                      )
                    })}
                    {showGrandTotal && (
                      <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold text-theme-text">
                        <PrivateValue>
                          {formatAmount(monthSummaries.reduce((s, m) => s + m.autoSavings, 0))}
                        </PrivateValue>
                      </td>
                    )}
                  </>
                ) : (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      —
                    </td>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums">
                      {isFutureMonth(monthKeys[0]) ? (
                        <span
                          className="font-semibold text-theme-text cursor-not-allowed opacity-70"
                          title="Use Schedule to change future values"
                        >
                          <PrivateValue>{formatAmount(monthSummaries[0].autoSavings)}</PrivateValue>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSavingsClick(0)}
                          className={cn('group', editableAmountButtonClass)}
                        >
                          <PrivateValue className="group-hover:underline group-focus-visible:underline">
                            {formatAmount(monthSummaries[0].autoSavings)}
                          </PrivateValue>
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>

              {/* Total Expenses */}
              <tr className="row-hover">
                <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text font-medium min-w-[8rem] overflow-hidden">
                  <span className="block min-w-[8rem] truncate">Total Expenses</span>
                </td>
                {monthSpan > 1 ? (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      —
                    </td>
                    {[...monthSummaries].reverse().map((summary, displayIdx) => {
                      const totalExpenses = summary.fixedExpensesTotal + summary.variableExpenses
                      const dataIdx = monthSummaries.length - 1 - displayIdx
                      return (
                        <td
                          key={monthKeys[dataIdx].key}
                          className={cn(
                            'px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold',
                            totalExpenses < 0 ? 'text-theme-success' : 'text-theme-danger',
                            displayIdx === 0 && 'border-l border-theme-border',
                          )}
                        >
                          <PrivateValue>{formatAmount(totalExpenses)}</PrivateValue>
                        </td>
                      )
                    })}
                    {showGrandTotal && (
                      <td
                        className={cn(
                          'px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold',
                          monthSummaries.reduce(
                            (s, m) => s + m.fixedExpensesTotal + m.variableExpenses,
                            0,
                          ) < 0
                            ? 'text-theme-success'
                            : 'text-theme-danger',
                        )}
                      >
                        <PrivateValue>
                          {formatAmount(
                            monthSummaries.reduce(
                              (s, m) => s + m.fixedExpensesTotal + m.variableExpenses,
                              0,
                            ),
                          )}
                        </PrivateValue>
                      </td>
                    )}
                  </>
                ) : (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      —
                    </td>
                    <td
                      className={cn(
                        'px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold',
                        monthSummaries[0].fixedExpensesTotal + monthSummaries[0].variableExpenses <
                          0
                          ? 'text-theme-success'
                          : 'text-theme-danger',
                      )}
                    >
                      <PrivateValue>
                        {formatAmount(
                          monthSummaries[0].fixedExpensesTotal + monthSummaries[0].variableExpenses,
                        )}
                      </PrivateValue>
                    </td>
                  </>
                )}
              </tr>

              {/* Remaining */}
              <tr className="row-hover">
                <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text font-medium min-w-[8rem] overflow-hidden">
                  <span className="block min-w-[8rem] truncate">Remaining</span>
                </td>
                {monthSpan > 1 ? (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      —
                    </td>
                    {[...monthSummaries].reverse().map((summary, displayIdx) => {
                      const dataIdx = monthSummaries.length - 1 - displayIdx
                      const displayColor = remainingDisplayColors[dataIdx]
                      return (
                        <td
                          key={monthKeys[dataIdx].key}
                          className={cn(
                            'px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold',
                            displayIdx === 0 && 'border-l border-theme-border',
                          )}
                          style={{ color: displayColor }}
                        >
                          <PrivateValue>{formatAmount(summary.remaining)}</PrivateValue>
                        </td>
                      )
                    })}
                    {showGrandTotal && (
                      <td
                        className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold"
                        style={{ color: remainingGrandTotalDisplayColor }}
                      >
                        <PrivateValue>
                          {formatAmount(monthSummaries.reduce((s, m) => s + m.remaining, 0))}
                        </PrivateValue>
                      </td>
                    )}
                  </>
                ) : (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      —
                    </td>
                    <td
                      className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold"
                      style={{ color: remainingDisplayColors[0] }}
                    >
                      <PrivateValue>{formatAmount(monthSummaries[0].remaining)}</PrivateValue>
                    </td>
                  </>
                )}
              </tr>

              {/* Total Savings */}
              <tr className="row-hover">
                <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text font-medium min-w-[8rem] overflow-hidden">
                  <span className="block min-w-[8rem] truncate">Total Savings</span>
                </td>
                {monthSpan > 1 ? (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      —
                    </td>
                    {[...monthSummaries].reverse().map((_, displayIdx) => {
                      const dataIdx = monthSummaries.length - 1 - displayIdx
                      const { totalSavings, color } = totalSavingsData[dataIdx]
                      return (
                        <td
                          key={monthKeys[dataIdx].key}
                          className={cn(
                            'px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold',
                            displayIdx === 0 && 'border-l border-theme-border',
                          )}
                          style={{ color }}
                        >
                          <PrivateValue>{formatAmount(totalSavings)}</PrivateValue>
                        </td>
                      )
                    })}
                    {showGrandTotal && (
                      <td
                        className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold"
                        style={{ color: grandTotalSavings.color }}
                      >
                        <PrivateValue>{formatAmount(grandTotalSavings.grandTotal)}</PrivateValue>
                      </td>
                    )}
                  </>
                ) : (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      —
                    </td>
                    <td
                      className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold"
                      style={{ color: totalSavingsData[0]?.color }}
                    >
                      <PrivateValue>
                        {formatAmount(monthSummaries[0].autoSavings + monthSummaries[0].remaining)}
                      </PrivateValue>
                    </td>
                  </>
                )}
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
