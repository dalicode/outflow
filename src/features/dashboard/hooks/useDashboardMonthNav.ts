import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MonthSpan } from '../constants'
import { MONTH_SPANS, VIEWPORT_THRESHOLDS } from '../constants'
import { partsToMonthKey } from '../../../utils/urlParams'
import { useMaxVisible } from '../../../hooks/useMaxVisible'
import { useViewportWidth } from '../../../hooks/useViewportWidth'

export function useDashboardMonthNav(
  initialYear?: number,
  initialMonth?: number,
  initialMonthSpan?: MonthSpan,
  initialShowGrandTotal?: boolean,
  onYearChange?: (y: number) => void,
  onMonthChange?: (m: number) => void,
  onMonthSpanChange?: (s: MonthSpan) => void,
  onShowGrandTotalChange?: (v: boolean) => void,
) {
  const now = new Date()

  const [selectedYear, setSelectedYear] = useState(initialYear ?? now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? now.getMonth())
  const [monthSpan, setMonthSpanState] = useState<MonthSpan>(initialMonthSpan ?? 1)
  const [showGrandTotal, setShowGrandTotalState] = useState(initialShowGrandTotal ?? false)

  const viewportWidth = useViewportWidth()
  const maxVisible = useMaxVisible(viewportWidth)
  const stripMaxVisible = maxVisible + (monthSpan > 3 ? monthSpan * 2 : 0)

  const isSpanSelectorVisible = viewportWidth >= VIEWPORT_THRESHOLDS[1]

  const maxAvailableSpan = useMemo(() => {
    const allowed = MONTH_SPANS.filter((n) => viewportWidth >= VIEWPORT_THRESHOLDS[n])
    return allowed.length > 0 ? allowed[allowed.length - 1] : 1
  }, [viewportWidth])

  // Auto-downgrade span when viewport shrinks below threshold
  useEffect(() => {
    const target = isSpanSelectorVisible ? maxAvailableSpan : 1
    if (monthSpan > target) {
      setMonthSpanState(target as MonthSpan)
    }
  }, [monthSpan, maxAvailableSpan, isSpanSelectorVisible])

  const navigateToMonth = useCallback(
    (year: number, month: number) => {
      setSelectedYear(year)
      setSelectedMonth(month)
      onYearChange?.(year)
      onMonthChange?.(month)
    },
    [onYearChange, onMonthChange],
  )

  const goToPreviousMonth = useCallback(() => {
    if (selectedMonth === 0) {
      navigateToMonth(selectedYear - 1, 11)
    } else {
      navigateToMonth(selectedYear, selectedMonth - 1)
    }
  }, [selectedMonth, selectedYear, navigateToMonth])

  const goToNextMonth = useCallback(() => {
    if (selectedMonth === 11) {
      navigateToMonth(selectedYear + 1, 0)
    } else {
      navigateToMonth(selectedYear, selectedMonth + 1)
    }
  }, [selectedMonth, selectedYear, navigateToMonth])

  const jumpBackMonths = useCallback(() => {
    const d = new Date(selectedYear, selectedMonth)
    d.setMonth(d.getMonth() - stripMaxVisible)
    navigateToMonth(d.getFullYear(), d.getMonth())
  }, [selectedYear, selectedMonth, stripMaxVisible, navigateToMonth])

  const jumpToCurrentMonth = useCallback(() => {
    const today = new Date()
    navigateToMonth(today.getFullYear(), today.getMonth())
  }, [navigateToMonth])

  const setMonthSpan = useCallback(
    (span: MonthSpan) => {
      setMonthSpanState(span)
      onMonthSpanChange?.(span)
    },
    [onMonthSpanChange],
  )

  const setShowGrandTotal = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      setShowGrandTotalState((prev) => {
        const next = typeof v === 'function' ? v(prev) : v
        onShowGrandTotalChange?.(next)
        return next
      })
    },
    [onShowGrandTotalChange],
  )

  const isAtCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth()

  const selectedMonthKey = partsToMonthKey(selectedYear, selectedMonth)

  const monthStrip = useMemo(() => {
    const months = []
    const center = new Date(selectedYear, selectedMonth)
    const half = 100
    for (let i = -half; i <= half; i++) {
      const d = new Date(center)
      d.setMonth(d.getMonth() + i)
      months.push({ year: d.getFullYear(), month: d.getMonth(), offset: i })
    }
    return months
  }, [selectedYear, selectedMonth])

  const yearFirstIndices = useMemo(() => {
    const map = new Map<number, number>()
    monthStrip.forEach((m, i) => {
      if (!map.has(m.year)) map.set(m.year, i)
    })
    return map
  }, [monthStrip])

  return {
    selectedYear,
    selectedMonth,
    monthSpan,
    showGrandTotal,
    stripMaxVisible,
    isSpanSelectorVisible,
    isAtCurrentMonth,
    selectedMonthKey,
    monthStrip,
    yearFirstIndices,
    setSelectedYear,
    setSelectedMonth,
    setMonthSpan,
    setShowGrandTotal,
    goToPreviousMonth,
    goToNextMonth,
    jumpBackMonths,
    jumpToCurrentMonth,
    navigateToMonth,
    viewportWidth,
  }
}
