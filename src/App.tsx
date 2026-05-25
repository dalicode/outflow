import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import OfflineStatusBadge from './components/pwa/OfflineStatusBadge'
import PWAInstallPrompt from './components/pwa/PWAInstallPrompt'
import PWAUpdatePrompt from './components/pwa/PWAUpdatePrompt'
import LoadingOverlay from './components/ui/LoadingOverlay'
import Modal from './components/ui/Modal'
import PageSectionFallback from './components/ui/PageSectionFallback'
import PullToRefreshContainer from './components/ui/PullToRefreshContainer'
import { installTestApi } from './test/testApi'
import { testApi } from './test/testApi'
import { ROUTES } from './constants/routes'
import { useAuth } from './context/authContext'
import { FinanceDataProvider, useFinanceActions } from './context/financeDataContext'
import { useSettings } from './context/settingsContext'
import { ToastProvider, useToasts } from './context/toastContext'
import Dashboard from './features/dashboard/Dashboard'
import ExpenseForm from './features/expenses/ExpenseForm'
import AnalyticsPage from './features/analytics/AnalyticsPage'
import PayeesPage from './features/payees/PayeesPage'
import SummaryPage from './features/summary/SummaryPage'
import { useAppRefresh } from './hooks/useAppRefresh'
import { useAppSessionState } from './hooks/useAppSessionState'
import { useCategories, useExpenses, usePayees } from './hooks/useLocalData'
import { useOptimisticExpenseDelete } from './hooks/useOptimisticExpenseDelete'
import { useStartupSnapshots } from './hooks/useStartupSnapshots'
import { StorageService } from './services/storageService'
import { supabase } from './services/supabase'
import type { Expense } from './types'
import { cn } from './utils/cn'

const AuthPage = lazy(() => import('./features/auth/AuthPage'))
const loadSettingsPage = () => import('./features/settings/SettingsPage')

const SettingsPage = lazy(loadSettingsPage)

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
      <FinanceDataProvider>
        <AppShell />
      </FinanceDataProvider>
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

function AppShell() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      installTestApi()
    }
  }, [])

  const {
    user,
    loading,
    syncStatus,
    syncCount,
    pullAppliedCount,
    syncNow,
    syncLocalThenPull,
    syncLocalChanges,
    signOut,
  } = useAuth()

  useEffect(() => {
    if (!import.meta.env.DEV) return
    testApi.setSyncHandlers(
      { syncNow, syncLocalThenPull, syncStatus, syncCount, pullAppliedCount },
      user?.id ?? null,
    )
  }, [pullAppliedCount, syncCount, syncLocalThenPull, syncNow, syncStatus, user?.id])
  const { loaded: settingsLoaded, save: saveSettings, loadSettings } = useSettings()
  const { expenses, setExpenses, refresh: refreshExpenses } = useExpenses()
  const { categories, refresh: refreshCategories } = useCategories()
  const { payees, refresh: refreshPayees } = usePayees()
  const { forceFinanceDataRefresh } = useFinanceActions()
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
  const { snapshotsReady, announceAppliedScheduleUpdates } = useStartupSnapshots({ showToast })
  const isReady = !loading && settingsLoaded && snapshotsReady

  // Ref that Dashboard registers its cycleView fn into, so Navbar can call it
  const cycleDashboardViewRef = useRef<(() => void) | null>(null)

  const {
    dashboardSession,
    analyticsSession,
    handleDashboardSessionChange,
    handleAnalyticsSessionChange,
  } = useAppSessionState()

  const handlePageScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      handleScroll()
      handleScrollDirection(e.currentTarget)
    },
    [handleScroll, handleScrollDirection],
  )

  const { handlePullRefresh } = useAppRefresh({
    pullAppliedCount,
    refreshExpenses,
    refreshCategories,
    refreshPayees,
    loadSettings,
    announceAppliedScheduleUpdates,
    showToast,
    syncNow,
    user,
    forceFinanceDataRefresh,
  })

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
        await StorageService.unarchiveCategory(payload.id as number)
        await refreshCategories()
        void syncLocalChanges()
      })
    } else if (action === 'merge') {
      // Merge already archives source + reassigns expenses in the repository.
      // Refresh both categories and expenses so tables update instantly.
      await refreshExpenses()
    }
    await refreshCategories()
    void syncLocalChanges()
    return newId
  }

  const handleAdd = async (expense: Omit<Expense, 'id'>) => {
    const newId = await StorageService.add(expense)
    setExpenses(await StorageService.getAll())
    void saveSettings({
      lastCheckInCompletedAt: new Date().toISOString(),
    }).catch((error) => console.warn('Check-in completion stamp failed:', error))
    setShowForm(false)
    void syncLocalChanges()
    return newId
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
      void syncLocalChanges()
    } catch (error) {
      if (previousExpense) {
        setExpenses((prev) =>
          prev.map((expense) => (expense.id === id ? (previousExpense as Expense) : expense)),
        )
      }
      throw error
    }
  }

  const { visibleExpenses, handleDelete, handleBulkDelete } = useOptimisticExpenseDelete({
    expenses,
    setExpenses,
    refreshExpenses,
    triggerSync: syncLocalChanges,
    showUndoToast,
  })

  useEffect(() => {
    if (user) setShowAuthModal(false)
  }, [user])

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
                  ? () => {
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
                      refreshExpenses={refreshExpenses}
                      triggerSync={syncLocalChanges}
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
                      <PayeesPage refreshExpenses={refreshExpenses} triggerSync={syncLocalChanges} />
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
                      <Suspense
                        fallback={
                          <PageSectionFallback
                            title="Loading settings…"
                            size="lg"
                            minHeightClassName="min-h-[24rem]"
                          />
                        }
                      >
                        <SettingsPage
                          expenses={visibleExpenses}
                          onImport={async () => setExpenses(await StorageService.getAll())}
                          onRefreshAll={async () => {
                            await refreshExpenses()
                            await refreshCategories()
                            await refreshPayees()
                            forceFinanceDataRefresh()
                          }}
                          triggerSync={syncLocalChanges}
                          syncNow={syncNow}
                          syncLocalThenPull={syncLocalThenPull}
                          syncLocalChanges={syncLocalChanges}
                          showSignIn={!!supabase && !user}
                          onSignIn={() => setShowAuthModal(true)}
                        />
                      </Suspense>
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
                refreshCategories={refreshCategories}
                refreshPayees={refreshPayees}
                refreshExpenses={refreshExpenses}
                triggerSync={syncLocalChanges}
              />
            )}
            {showAuthModal && (
              <Modal isOpen={true} onClose={() => setShowAuthModal(false)} title="" size="sm">
                <Suspense
                  fallback={
                    <div className="relative min-h-32">
                      <LoadingOverlay isOpen={true} inline message="Loading sign in…" />
                    </div>
                  }
                >
                  <AuthPage
                    onClose={() => setShowAuthModal(false)}
                    onSignInSuccess={(email) => {
                      showToast({
                        message: `Welcome back${email ? `, ${email}` : ''}.`,
                        tone: 'success',
                        durationMs: 3500,
                      })
                    }}
                  />
                </Suspense>
              </Modal>
            )}
          </>
        )}
      </div>
    </BrowserRouter>
  )
}
