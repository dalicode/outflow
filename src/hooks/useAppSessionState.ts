import { useCallback, useEffect, useState } from 'react'
import type { AnalyticsSessionState } from '../features/analytics/hooks/useAnalytics'
import { DASHBOARD_VIEWS } from '../features/dashboard/constants'
import type { DashboardSessionState } from '../features/dashboard/hooks/useDashboard'
import { parseTrendDrilldownParam, parseTrendMonthParam, parseYearParam } from '../utils/urlParams'

export function useAppSessionState(): {
  dashboardSession: DashboardSessionState
  analyticsSession: AnalyticsSessionState
  handleDashboardSessionChange: (patch: Partial<DashboardSessionState>) => void
  handleAnalyticsSessionChange: (patch: Partial<AnalyticsSessionState>) => void
} {
  const now = new Date()
  const currentYear = now.getFullYear()

  const [dashboardSession, setDashboardSession] = useState<DashboardSessionState>({
    selectedYear: currentYear,
    selectedMonth: now.getMonth(),
    monthSpan: 1,
    showGrandTotal: false,
    viewMode: DASHBOARD_VIEWS.CATEGORIES,
    filters: {
      filterGlobal: '',
      filterDateFrom: '',
      filterDateTo: '',
      filterDescription: '',
      filterAmount: '',
      selectedCategories: [],
      selectedPayees: [],
    },
    splitParentExpansionOverrides: {},
  })

  const [analyticsSession, setAnalyticsSession] = useState<AnalyticsSessionState>(() => {
    const params = new URLSearchParams(window.location.search)
    const year = parseYearParam(params.get('year'), currentYear)
    const trendMonthParsed = parseTrendMonthParam(params.get('trendMonth'))
    const trendKey =
      trendMonthParsed && trendMonthParsed.year === year ? params.get('trendMonth') : null
    const trendDrilldown =
      trendKey !== null && parseTrendDrilldownParam(params.get('trendDrilldown'))

    return {
      year,
      trendKey,
      trendDrilldown,
    }
  })

  const handleDashboardSessionChange = useCallback((patch: Partial<DashboardSessionState>) => {
    setDashboardSession((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleAnalyticsSessionChange = useCallback(
    (patch: Partial<AnalyticsSessionState>) => {
      setAnalyticsSession((prev) => {
        const next = { ...prev, ...patch }
        const params = new URLSearchParams(window.location.search)

        if (next.year !== currentYear) {
          params.set('year', String(next.year))
        } else {
          params.delete('year')
        }

        if (next.trendKey !== null) {
          params.set('trendMonth', next.trendKey)
        } else {
          params.delete('trendMonth')
          params.delete('trendDrilldown')
        }

        if (next.trendDrilldown && next.trendKey !== null) {
          params.set('trendDrilldown', '1')
        } else {
          params.delete('trendDrilldown')
        }

        const newSearch = params.toString()
        const newUrl = newSearch
          ? `${window.location.pathname}?${newSearch}`
          : window.location.pathname

        const isDrilldownEntry = next.trendDrilldown && !prev.trendDrilldown
        if (isDrilldownEntry) {
          history.pushState(null, '', newUrl)
        } else {
          history.replaceState(null, '', newUrl)
        }

        return next
      })
    },
    [currentYear],
  )

  useEffect(() => {
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search)
      const trendDrilldown = parseTrendDrilldownParam(params.get('trendDrilldown'))

      if (!trendDrilldown && analyticsSession.trendDrilldown) {
        setAnalyticsSession((prev) => ({
          ...prev,
          trendDrilldown: false,
        }))
      }
    }

    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [analyticsSession.trendDrilldown])

  return {
    dashboardSession,
    analyticsSession,
    handleDashboardSessionChange,
    handleAnalyticsSessionChange,
  }
}
