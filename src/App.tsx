import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import OfflineStatusBadge from './components/pwa/OfflineStatusBadge'
import PWAInstallPrompt from './components/pwa/PWAInstallPrompt'
import PWAUpdatePrompt from './components/pwa/PWAUpdatePrompt'
import LoadingOverlay from './components/ui/LoadingOverlay'
import PageBanner from './components/ui/PageBanner'
import PullToRefreshContainer from './components/ui/PullToRefreshContainer'
import { ROUTES } from './constants/routes'
import { useAuth } from './context/authContext'
import { useSettings } from './context/settingsContext'
import { ToastProvider, useToasts } from './context/toastContext'
import AnalyticsPage from './features/analytics/AnalyticsPage'
import AuthPage from './features/auth/AuthPage'
import { DASHBOARD_VIEWS } from './features/dashboard/constants'
import Dashboard from './features/dashboard/Dashboard'
import ExpenseForm from './features/expenses/ExpenseForm'
import PayeesPage from './features/payees/PayeesPage'
import SettingsPage from './features/settings/SettingsPage'
import SummaryPage from './features/summary/SummaryPage'
import type { AnalyticsSessionState } from './features/analytics/hooks/useAnalytics'
import type { DashboardSessionState } from './features/dashboard/hooks/useDashboard'
import { useCategories, useExpenses, usePayees } from './hooks/useLocalData'
import { StorageService } from './services/storageService'
import { supabase } from './services/supabase'
import type { Expense, SyncStatus } from './types'
import { cn } from './utils/cn'
import { summarizeScheduleMaterializationNotices } from './utils/scheduleNotificationUtils'
import { parseTrendDrilldownParam, parseTrendMonthParam, parseYearParam } from './utils/urlParams'

function useScrollVisibility() {
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleScroll = useCallback(() => {
    setIsScrolling(true)
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
    }, 800)
  }, [])

  return { isScrolling, handleScroll }
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  )
}

function useScrollDirection() {
  const [direction, setDirection] = useState<'up' | 'down' | null>(null)
  const lastScrollY = useRef(0)
  const ticking = useRef(false)

  const reset = useCallback(() => {
    setDirection(null)
    lastScrollY.current = 0
  }, [])

  const onScroll = useCallback((el: HTMLDivElement) => {
    if (ticking.current) return
    ticking.current = true

    requestAnimationFrame(() => {
      const currentY = el.scrollTop

      if (currentY > lastScrollY.current && currentY > 10) {
        setDirection('down')
      } else if (currentY < lastScrollY.current) {
        setDirection('up')
      }

      lastScrollY.current = currentY
      ticking.current = false
    })
  }, [])

  return { direction, onScroll, reset }
}

function ScrollablePage({
  children,
  onScroll,
  onRouteChange,
  bottomSpacerClassName,
  onRefresh,
}: {
  children: React.ReactNode
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
  onRouteChange?: () => void
  bottomSpacerClassName?: string
  onRefresh: () => Promise<void>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const showBottomSpacer = bottomSpacerClassName !== 'h-0'

  useEffect(() => {
    ref.current?.scrollTo({ top: 0, behavior: 'auto' })
    onRouteChange?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRouteChange]) // location.key changes on back/forward too

  return (
    <PullToRefreshContainer ref={ref} className="h-full" onScroll={onScroll} onRefresh={onRefresh}>
      {children}
      {showBottomSpacer && (
        <div
          className={cn('sm:hidden', bottomSpacerClassName ?? 'mobile-bottom-spacer')}
          aria-hidden="true"
        />
      )}
    </PullToRefreshContainer>
  )
}

function SyncDot({ status }: { status: SyncStatus }) {
  if (!supabase) return null
  const styles: Record<string, string> = {
    idle: 'bg-theme-success',
    syncing: 'bg-yellow-400 animate-pulse',
    offline: 'bg-theme-muted',
    error: 'bg-theme-danger',
  }
  const labels: Record<string, string> = {
    idle: 'Synced',
    syncing: 'Syncing…',
    offline: 'Offline',
    error: 'Sync error',
  }
  return (
    <span className="flex items-center gap-1 text-xs text-theme-muted" title={labels[status]}>
      <span className={`w-2 h-2 rounded-theme-small ${styles[status] ?? styles.idle}`} />
      <span className="hidden lg:inline">{labels[status]}</span>
    </span>
  )
}

function AppShell() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      import('./test/testApi').then(({ installTestApi }) => installTestApi())
    }
  }, [])

  const { user, loading, syncStatus, triggerSync, signOut } = useAuth()
  const { loaded: settingsLoaded, save: saveSettings } = useSettings()
  const { expenses, setExpenses, refresh: refreshExpenses } = useExpenses()
  const { categories, refresh: refreshCategories } = useCategories()
  const { payees, refresh: refreshPayees } = usePayees()
  const { showToast, showUndoToast } = useToasts()
  const [showForm, setShowForm] = useState(false)
  const { isScrolling, handleScroll } = useScrollVisibility()
  const {
    direction,
    onScroll: handleScrollDirection,
    reset: resetScrollDirection,
  } = useScrollDirection()
  const [mobileSelectionActive, setMobileSelectionActive] = useState(false)
  const [snapshotsReady, setSnapshotsReady] = useState(false)
  const [pendingExpenseDeleteIds, setPendingExpenseDeleteIds] = useState<number[]>([])
  const [deleteBanner, setDeleteBanner] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [deleteBannerKey, setDeleteBannerKey] = useState(0)
  const pendingExpenseDeleteTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const announceAppliedScheduleUpdates = useCallback(
    (notices: Awaited<ReturnType<typeof StorageService.materializePendingSnapshots>>) => {
      if (!notices || notices.length === 0) return
      showToast({
        message: summarizeScheduleMaterializationNotices(notices),
        tone: 'success',
        durationMs: 6500,
      })
    },
    [showToast],
  )

  // Ref that Dashboard registers its cycleView fn into, so Navbar can call it
  const cycleDashboardViewRef = useRef<(() => void) | null>(null)

  // Session state — persists across route changes within the same app session
  const now = new Date()
  const [dashboardSession, setDashboardSession] = useState<DashboardSessionState>({
    selectedYear: now.getFullYear(),
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
  })
  const [analyticsSession, setAnalyticsSession] = useState<AnalyticsSessionState>(() => {
    const params = new URLSearchParams(window.location.search)
    const year = parseYearParam(params.get('year'), now.getFullYear())
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

        if (next.year !== now.getFullYear()) {
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
    [now],
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

  const handlePageScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      handleScroll()
      handleScrollDirection(e.currentTarget)
    },
    [handleScroll, handleScrollDirection],
  )

  useEffect(() => {
    if (syncStatus === 'idle') {
      refreshExpenses()
      refreshCategories()
      refreshPayees()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus, refreshPayees, refreshExpenses, refreshCategories])

  useEffect(() => {
    const init = async () => {
      const hasVisited = localStorage.getItem('outflow:hasVisited') === 'true'
      const minLoadTime = (window as unknown as { outflowTestApi?: unknown }).outflowTestApi
        ? 0
        : hasVisited
          ? 1500
          : 3000
      const startTime = Date.now()

      const appliedNotices = await StorageService.materializePendingSnapshots?.().catch(
        console.error,
      )
      await StorageService.rolloverSnapshots?.().catch(console.error)

      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, minLoadTime - elapsed)
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining))
      }

      setSnapshotsReady(true)
      announceAppliedScheduleUpdates(appliedNotices ?? [])
      if (!hasVisited) {
        localStorage.setItem('outflow:hasVisited', 'true')
      }
    }
    init()
  }, [announceAppliedScheduleUpdates])

  const handlePullRefresh = useCallback(async () => {
    try {
      const appliedNotices = await StorageService.materializePendingSnapshots?.().catch(
        console.error,
      )
      await StorageService.rolloverSnapshots?.().catch(console.error)
      await Promise.all([refreshExpenses(), refreshCategories(), refreshPayees()])

      announceAppliedScheduleUpdates(appliedNotices ?? [])

      if (navigator.onLine && supabase && user) {
        triggerSync?.()
      }
    } catch (error) {
      console.error('Pull refresh failed:', error)
      showToast({
        message: "Refresh didn't finish. Try again in a moment.",
        tone: 'warning',
        durationMs: 4000,
      })
    }
  }, [
    refreshCategories,
    refreshExpenses,
    refreshPayees,
    announceAppliedScheduleUpdates,
    showToast,
    triggerSync,
    user,
  ])

  const handleCategoriesChange = async (
    action: 'add' | 'update' | 'delete',
    payload: { id?: number; name?: string },
  ): Promise<number | undefined> => {
    let newId: number | undefined
    if (action === 'add' && payload.name) {
      newId = await StorageService.addCategory(payload.name)
    } else if (action === 'update' && payload.id != null && payload.name) {
      await StorageService.updateCategory(payload.id, { name: payload.name })
    } else if (action === 'delete' && payload.id != null) {
      const archivedCategory = categories.find((category) => category.id === payload.id)
      await StorageService.deleteCategory(payload.id)
      showUndoToast(`${archivedCategory?.name ?? 'Category'} archived.`, async () => {
        await StorageService.updateCategory(payload.id as number, {
          isArchived: false,
          archivedAt: undefined,
          mergedIntoCategoryId: null,
        })
        await refreshCategories()
        triggerSync?.()
      })
    }
    await refreshCategories()
    triggerSync?.()
    return newId
  }

  const handleAdd = async (expense: Omit<Expense, 'id'>) => {
    await StorageService.add(expense)
    setExpenses(await StorageService.getAll())
    void saveSettings({
      lastCheckInCompletedAt: new Date().toISOString(),
    }).catch((error) => console.warn('Check-in completion stamp failed:', error))
    setShowForm(false)
    triggerSync?.()
  }

  const handleUpdate = async (id: number, changes: Partial<Expense>) => {
    let previousExpense: Expense | null = null

    setExpenses((prev) =>
      prev.map((expense) => {
        if (expense.id !== id) return expense
        previousExpense = expense
        return { ...expense, ...changes }
      }),
    )

    try {
      await StorageService.update(id, changes)
      triggerSync?.()
    } catch (error) {
      if (previousExpense) {
        setExpenses((prev) =>
          prev.map((expense) => (expense.id === id ? (previousExpense as Expense) : expense)),
        )
      }
      throw error
    }
  }

  const handleDelete = async (id: number) => {
    const expense = expenses.find((item) => item.id === id)
    if (!expense) return
    const removedIndex = expenses.findIndex((item) => item.id === id)

    const timer = setTimeout(async () => {
      try {
        await StorageService.remove(id)
        triggerSync?.()
        await refreshExpenses()
      } finally {
        pendingExpenseDeleteTimersRef.current = pendingExpenseDeleteTimersRef.current.filter(
          (item) => item !== timer,
        )
        setPendingExpenseDeleteIds((current) => current.filter((pendingId) => pendingId !== id))
      }
    }, 4500)

    pendingExpenseDeleteTimersRef.current.push(timer)
    setPendingExpenseDeleteIds((current) => [...new Set([...current, id])])
    setExpenses((prev) => prev.filter((item) => item.id !== id))
    showUndoToast(`Deleted ${expense.description?.trim() || 'expense'}.`, async () => {
      clearTimeout(timer)
      pendingExpenseDeleteTimersRef.current = pendingExpenseDeleteTimersRef.current.filter(
        (item) => item !== timer,
      )
      setPendingExpenseDeleteIds((current) => current.filter((pendingId) => pendingId !== id))
      setExpenses((prev) => {
        if (prev.some((item) => item.id === id)) return prev
        const restored = [...prev]
        restored.splice(Math.min(removedIndex, restored.length), 0, expense)
        return restored
      })
    })
  }

  const handleBulkDelete = async (ids: number[]) => {
    const selected = expenses.filter((expense) => ids.includes(expense.id as number))
    if (selected.length === 0) return

    const selectedIdSet = new Set(ids)
    const positions = selected.map((expense) => ({
      expense,
      index: expenses.findIndex((item) => item.id === expense.id),
    }))

    const timer = setTimeout(async () => {
      try {
        await StorageService.removeMany(ids)
        triggerSync?.()
        await refreshExpenses()
      } finally {
        pendingExpenseDeleteTimersRef.current = pendingExpenseDeleteTimersRef.current.filter(
          (item) => item !== timer,
        )
        setPendingExpenseDeleteIds((current) =>
          current.filter((pendingId) => !selectedIdSet.has(pendingId)),
        )
      }
    }, 4500)

    pendingExpenseDeleteTimersRef.current.push(timer)
    setPendingExpenseDeleteIds((current) => [...new Set([...current, ...ids])])
    setExpenses((prev) => prev.filter((expense) => !selectedIdSet.has(expense.id as number)))
    setDeleteBannerKey((k) => k + 1)
    setDeleteBanner({ message: `Deleted ${selected.length} expenses`, type: 'success' })
    showUndoToast(`Deleted ${selected.length} expenses.`, async () => {
      clearTimeout(timer)
      pendingExpenseDeleteTimersRef.current = pendingExpenseDeleteTimersRef.current.filter(
        (item) => item !== timer,
      )
      setPendingExpenseDeleteIds((current) =>
        current.filter((pendingId) => !selectedIdSet.has(pendingId)),
      )
      setExpenses((prev) => {
        const restored = [...prev]
        positions
          .slice()
          .sort((a, b) => a.index - b.index)
          .forEach(({ expense, index }) => {
            if (restored.some((item) => item.id === expense.id)) return
            restored.splice(Math.min(index, restored.length), 0, expense)
          })
        return restored
      })
    })
  }

  useEffect(
    () => () => {
      pendingExpenseDeleteTimersRef.current.forEach((timer) => {
        clearTimeout(timer)
      })
      pendingExpenseDeleteTimersRef.current = []
    },
    [],
  )

  const visibleExpenses = useMemo(
    () => expenses.filter((expense) => !pendingExpenseDeleteIds.includes(expense.id as number)),
    [expenses, pendingExpenseDeleteIds],
  )

  if (supabase && !loading && !user) return <AuthPage />

  const isReady = !loading && settingsLoaded && snapshotsReady

  return (
    <BrowserRouter>
      <div className="h-dvh bg-theme-background text-theme-text antialiased flex">
        {/* iPhone PWA status bar cover — fills safe-area-inset-top with app background */}
        <div
          className="fixed inset-x-0 top-0 z-[100] bg-theme-background sm:hidden"
          style={{ height: 'env(safe-area-inset-top, 0px)' }}
          aria-hidden="true"
        />
        {!isReady ? (
          <LoadingOverlay
            isOpen={true}
            message="Loading Outflow…"
            subMessage="Initializing your data"
          />
        ) : (
          <>
            <PWAUpdatePrompt />
            <PWAInstallPrompt />
            <OfflineStatusBadge />
            <Navbar
              onAddExpense={() => setShowForm(true)}
              syncDot={<SyncDot status={syncStatus} />}
              onSignOut={supabase ? signOut : undefined}
              userEmail={user?.email}
              scrollDirection={direction}
              isScrolling={isScrolling}
              hidden={mobileSelectionActive}
              onCycleDashboardView={() => cycleDashboardViewRef.current?.()}
            />
            <PageBanner
              key={deleteBannerKey}
              message={deleteBanner?.message ?? ''}
              type={deleteBanner?.type ?? 'success'}
            />
            <main
              className={cn(
                'flex-1 min-w-0 overflow-hidden bg-theme-background',
                isScrolling && 'is-scrolling',
              )}
            >
              <Routes>
                <Route
                  path={ROUTES.DASHBOARD}
                  element={
                    <Dashboard
                      expenses={visibleExpenses}
                      categories={categories}
                      payees={payees}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onBulkDelete={handleBulkDelete}
                      onAddExpense={() => setShowForm(true)}
                      onSelectionChange={setMobileSelectionActive}
                      onScroll={handlePageScroll}
                      refreshCategories={refreshCategories}
                      refreshPayees={refreshPayees}
                      registerCycleView={(fn) => {
                        cycleDashboardViewRef.current = fn
                      }}
                      sessionState={dashboardSession}
                      onSessionStateChange={handleDashboardSessionChange}
                      onRefresh={handlePullRefresh}
                    />
                  }
                />
                <Route
                  path={ROUTES.SUMMARY}
                  element={
                    <ScrollablePage
                      onScroll={handlePageScroll}
                      onRouteChange={resetScrollDirection}
                      bottomSpacerClassName="mobile-bottom-spacer-sm"
                      onRefresh={handlePullRefresh}
                    >
                      <SummaryPage expenses={visibleExpenses} />
                    </ScrollablePage>
                  }
                />
                <Route
                  path={ROUTES.ANALYTICS}
                  element={
                    <ScrollablePage
                      onScroll={handlePageScroll}
                      onRouteChange={resetScrollDirection}
                      onRefresh={handlePullRefresh}
                      bottomSpacerClassName="mobile-bottom-spacer-sm"
                    >
                      <AnalyticsPage
                        expenses={visibleExpenses}
                        categories={categories}
                        payees={payees}
                        sessionState={analyticsSession}
                        onSessionStateChange={handleAnalyticsSessionChange}
                      />
                    </ScrollablePage>
                  }
                />
                <Route
                  path={ROUTES.PAYEES}
                  element={
                    <ScrollablePage
                      onScroll={handlePageScroll}
                      onRouteChange={resetScrollDirection}
                      onRefresh={handlePullRefresh}
                      bottomSpacerClassName="mobile-bottom-spacer-sm"
                    >
                      <PayeesPage />
                    </ScrollablePage>
                  }
                />
                <Route
                  path={ROUTES.SETTINGS}
                  element={
                    <ScrollablePage
                      onScroll={handlePageScroll}
                      onRouteChange={resetScrollDirection}
                      onRefresh={handlePullRefresh}
                      bottomSpacerClassName="mobile-bottom-spacer-sm"
                    >
                      <SettingsPage
                        expenses={visibleExpenses}
                        onImport={async () => setExpenses(await StorageService.getAll())}
                        onRefreshAll={async () => {
                          await refreshExpenses()
                          await refreshCategories()
                          await refreshPayees()
                        }}
                        triggerSync={triggerSync}
                      />
                    </ScrollablePage>
                  }
                />
              </Routes>
            </main>
            {showForm && (
              <ExpenseForm
                onAdd={handleAdd}
                onClose={() => setShowForm(false)}
                categories={categories}
                onCategoriesChange={handleCategoriesChange}
                refreshPayees={refreshPayees}
              />
            )}
          </>
        )}
      </div>
    </BrowserRouter>
  )
}
