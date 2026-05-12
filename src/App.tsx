import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Modal from './components/ui/Modal'
import OfflineStatusBadge from './components/pwa/OfflineStatusBadge'
import PWAInstallPrompt from './components/pwa/PWAInstallPrompt'
import PWAUpdatePrompt from './components/pwa/PWAUpdatePrompt'
import LoadingOverlay from './components/ui/LoadingOverlay'
import PullToRefreshContainer from './components/ui/PullToRefreshContainer'
import { installTestApi } from './test/testApi'
import { ROUTES } from './constants/routes'
import { useAuth } from './context/authContext'
import { useSettings } from './context/settingsContext'
import { ToastProvider, useToasts } from './context/toastContext'
import { DASHBOARD_VIEWS } from './features/dashboard/constants'
import type { AnalyticsSessionState } from './features/analytics/hooks/useAnalytics'
import type { DashboardSessionState } from './features/dashboard/hooks/useDashboard'
import { useCategories, useExpenses, usePayees } from './hooks/useLocalData'
import { StorageService } from './services/storageService'
import { supabase } from './services/supabase'
import type { Expense } from './types'
import { cn } from './utils/cn'
import { summarizeScheduleMaterializationNotices } from './utils/scheduleNotificationUtils'
import { parseTrendDrilldownParam, parseTrendMonthParam, parseYearParam } from './utils/urlParams'

const AnalyticsPage = lazy(() => import('./features/analytics/AnalyticsPage'))
const AuthPage = lazy(() => import('./features/auth/AuthPage'))
const Dashboard = lazy(() => import('./features/dashboard/Dashboard'))
const ExpenseForm = lazy(() => import('./features/expenses/ExpenseForm'))
const PayeesPage = lazy(() => import('./features/payees/PayeesPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))
const SummaryPage = lazy(() => import('./features/summary/SummaryPage'))

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

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
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

function RouteLoadingFallback() {
  return (
    <div className="flex h-full items-start justify-center bg-theme-background px-4 pt-8 sm:pt-10">
      <div className="flex min-h-24 w-full max-w-3xl items-center justify-center rounded-theme-medium border border-theme-border bg-theme-surface px-4 py-5 shadow-sm">
        <div className="flex items-center gap-3 text-sm font-medium text-theme-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-theme-primary border-t-transparent"
            aria-hidden="true"
          />
          <span>Loading view</span>
        </div>
      </div>
    </div>
  )
}

function AppShell() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      installTestApi()
    }
  }, [])

  const { user, loading, syncStatus, syncCount, triggerSync, signOut } = useAuth()
  const { loaded: settingsLoaded, save: saveSettings, loadSettings } = useSettings()
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
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [mobileSelectionActive, setMobileSelectionActive] = useState(false)
  const [snapshotsReady, setSnapshotsReady] = useState(false)
  const [pendingExpenseDeleteIds, setPendingExpenseDeleteIds] = useState<number[]>([])
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

  // Refresh all local data after every sync so the UI reflects cloud changes
  // without requiring a manual page reload.
  useEffect(() => {
    if (syncCount === 0) return
    refreshExpenses()
    refreshCategories()
    refreshPayees()
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncCount, refreshPayees, refreshExpenses, refreshCategories, loadSettings])

  useEffect(() => {
    const init = async () => {
      const hasVisited = localStorage.getItem('outflow:hasVisited') === 'true'
      const fakeDelay = (window as unknown as { outflowTestApi?: unknown }).outflowTestApi
        ? 0
        : hasVisited
          ? 0 // returning user: no delay needed
          : 800 // first visit: brief animation
      const startTime = Date.now()

      const appliedNotices = await StorageService.materializePendingSnapshots?.().catch(
        console.error,
      )
      await StorageService.rolloverSnapshots?.().catch(console.error)

      const remaining = Math.max(0, fakeDelay - (Date.now() - startTime))
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
    action: 'add' | 'update' | 'delete' | 'merge',
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
    } else if (action === 'merge') {
      // Merge already archives source + reassigns expenses in the repository.
      // Refresh both categories and expenses so tables update instantly.
      await refreshExpenses()
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
    }, 2000)

    pendingExpenseDeleteTimersRef.current.push(timer)
    setPendingExpenseDeleteIds((current) => [...new Set([...current, id])])
    setExpenses((prev) => prev.filter((item) => item.id !== id))
    showUndoToast(`Deleted ${expense.description?.trim() || 'expense'}.`, async () => {
      clearTimeout(timer)
      pendingExpenseDeleteTimersRef.current = pendingExpenseDeleteTimersRef.current.filter(
        (item) => item !== timer,
      )

      // Remove from pending delete set, and detect if timer already fired
      let timerFired = false
      setPendingExpenseDeleteIds((current) => {
        timerFired = !current.includes(id)
        return current.filter((pendingId) => pendingId !== id)
      })

      if (timerFired) {
        // Timer already fired — expense was deleted from DB and synced.
        // Re-create it locally and push the re-creation to the cloud.
        await StorageService.add(expense)
        triggerSync?.()
      }
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
    }, 2000)

    pendingExpenseDeleteTimersRef.current.push(timer)
    setPendingExpenseDeleteIds((current) => [...new Set([...current, ...ids])])
    setExpenses((prev) => prev.filter((expense) => !selectedIdSet.has(expense.id as number)))
    showUndoToast(`Deleted ${selected.length} expenses.`, async () => {
      clearTimeout(timer)
      pendingExpenseDeleteTimersRef.current = pendingExpenseDeleteTimersRef.current.filter(
        (item) => item !== timer,
      )

      let timerFired = false
      setPendingExpenseDeleteIds((current) => {
        timerFired = !ids.some((id) => current.includes(id))
        return current.filter((pendingId) => !selectedIdSet.has(pendingId))
      })

      if (timerFired) {
        // Timer already fired — expenses were deleted from DB and synced.
        // Re-create them locally and push the re-creation to the cloud.
        for (const expense of selected) {
          await StorageService.add(expense)
        }
        triggerSync?.()
      }
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

  useEffect(() => {
    if (user) setShowAuthModal(false)
  }, [user])

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
              onSignOut={
                supabase && user
                  ? (_e) => {
                      signOut().then(({ error }) => {
                        if (error) {
                          showToast({ message: 'Sign out failed', tone: 'danger' })
                        } else {
                          showToast({ message: 'Signed out', tone: 'success', durationMs: 3000 })
                        }
                      })
                    }
                  : undefined
              }
              onSignIn={() => setShowAuthModal(true)}
              showSignIn={!!supabase && !user}
              userEmail={user?.email}
              scrollDirection={direction}
              isScrolling={isScrolling}
              hidden={mobileSelectionActive}
              onCycleDashboardView={() => cycleDashboardViewRef.current?.()}
              syncStatus={syncStatus}
            />
            <main
              className={cn(
                'flex-1 min-w-0 overflow-hidden bg-theme-background relative',
                isScrolling && 'is-scrolling',
              )}
            >
              <Suspense fallback={<RouteLoadingFallback />}>
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
                        <PayeesPage refreshExpenses={refreshExpenses} />
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
                          showSignIn={!!supabase && !user}
                          onSignIn={() => setShowAuthModal(true)}
                        />
                      </ScrollablePage>
                    }
                  />
                </Routes>
              </Suspense>
            </main>
            {showForm && (
              <Suspense fallback={<LoadingOverlay isOpen={true} message="Loading form..." />}>
                <ExpenseForm
                  onAdd={handleAdd}
                  onClose={() => setShowForm(false)}
                  categories={categories}
                  onCategoriesChange={handleCategoriesChange}
                  refreshPayees={refreshPayees}
                  refreshExpenses={refreshExpenses}
                />
              </Suspense>
            )}
            {showAuthModal && (
              <Modal isOpen={true} onClose={() => setShowAuthModal(false)} title="" size="sm">
                <Suspense fallback={<div className="py-8 text-center text-sm text-theme-muted">Loading sign in...</div>}>
                  <AuthPage onClose={() => setShowAuthModal(false)} />
                </Suspense>
              </Modal>
            )}
          </>
        )}
      </div>
    </BrowserRouter>
  )
}
