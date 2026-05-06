import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import { StorageService } from "./services/storageService";
import { useAuth } from "./context/authContext";
import { useSettings } from "./context/settingsContext";
import { ToastProvider, useToasts } from "./context/toastContext";
import { supabase } from "./services/supabase";
import { useExpenses, useCategories, usePayees } from "./hooks/useLocalData";
import { cn } from "./utils/cn";
import { ROUTES } from "./constants/routes";
import Navbar from "./components/layout/Navbar";
import OfflineStatusBadge from "./components/pwa/OfflineStatusBadge";
import PWAUpdatePrompt from "./components/pwa/PWAUpdatePrompt";
import PWAInstallPrompt from "./components/pwa/PWAInstallPrompt";
import LoadingOverlay from "./components/ui/LoadingOverlay";
import ExpenseForm from "./features/expenses/ExpenseForm";
import Dashboard from "./features/dashboard/Dashboard";
import SummaryPage from "./features/summary/SummaryPage";
import AnalyticsPage from "./features/analytics/AnalyticsPage";
import PayeesPage from "./features/payees/PayeesPage";
import AuthPage from "./features/auth/AuthPage";
import SettingsPage from "./features/settings/SettingsPage";
import { DASHBOARD_VIEWS } from "./features/dashboard/constants";
import type { DashboardSessionState } from "./hooks/useDashboard";
import type { AnalyticsSessionState } from "./hooks/useAnalytics";
import type { SyncStatus } from "./types";
import type { Expense } from "./types";

function useScrollVisibility() {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 800);
  }, []);

  return { isScrolling, handleScroll };
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}

function useScrollDirection() {
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const reset = useCallback(() => {
    setDirection(null);
    lastScrollY.current = 0;
  }, []);

  const onScroll = useCallback((el: HTMLDivElement) => {
    if (ticking.current) return;
    ticking.current = true;

    requestAnimationFrame(() => {
      const currentY = el.scrollTop;

      if (currentY > lastScrollY.current && currentY > 10) {
        setDirection("down");
      } else if (currentY < lastScrollY.current) {
        setDirection("up");
      }

      lastScrollY.current = currentY;
      ticking.current = false;
    });
  }, []);

  return { direction, onScroll, reset };
}

function ScrollablePage({
  children,
  onScroll,
  onRouteChange,
  bottomSpacerClassName,
}: {
  children: React.ReactNode;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onRouteChange?: () => void;
  bottomSpacerClassName?: string;
}) {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const showBottomSpacer = bottomSpacerClassName !== "h-0";

  useEffect(() => {
    ref.current?.scrollTo({ top: 0, behavior: "auto" });
    onRouteChange?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.key]); // location.key changes on back/forward too

  return (
    <div
      ref={ref}
      className="h-full overflow-y-auto overscroll-contain scrollbar-auto-hide"
      onScroll={onScroll}
    >
      {children}
      {showBottomSpacer && (
        <div
          className={cn("sm:hidden", bottomSpacerClassName ?? "mobile-bottom-spacer")}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function SyncDot({ status }: { status: SyncStatus }) {
  if (!supabase) return null;
  const styles: Record<string, string> = {
    idle: "bg-theme-success",
    syncing: "bg-yellow-400 animate-pulse",
    offline: "bg-theme-muted",
    error: "bg-theme-danger",
  };
  const labels: Record<string, string> = {
    idle: "Synced",
    syncing: "Syncing…",
    offline: "Offline",
    error: "Sync error",
  };
  return (
    <span
      className="flex items-center gap-1 text-xs text-theme-muted"
      title={labels[status]}
    >
      <span
        className={`w-2 h-2 rounded-theme-small ${styles[status] ?? styles.idle}`}
      />
      <span className="hidden lg:inline">{labels[status]}</span>
    </span>
  );
}

function AppShell() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      import("./test/testApi").then(({ installTestApi }) => installTestApi());
    }
  }, []);

  const { user, loading, syncStatus, triggerSync, signOut } = useAuth();
  const { loaded: settingsLoaded, save: saveSettings } = useSettings();
  const { expenses, setExpenses, refresh: refreshExpenses } = useExpenses();
  const {
    categories,
    setCategories,
    refresh: refreshCategories,
  } = useCategories();
  const { payees, refresh: refreshPayees } = usePayees();
  const { showUndoToast } = useToasts();
  const [showForm, setShowForm] = useState(false);
  const { isScrolling, handleScroll } = useScrollVisibility();
  const { direction, onScroll: handleScrollDirection, reset: resetScrollDirection } = useScrollDirection();
  const [mobileSelectionActive, setMobileSelectionActive] = useState(false);
  const [snapshotsReady, setSnapshotsReady] = useState(false);
  const [pendingExpenseDeleteIds, setPendingExpenseDeleteIds] = useState<number[]>(
    [],
  );
  const pendingExpenseDeleteTimersRef = useRef<ReturnType<typeof setTimeout>[]>(
    [],
  );

  // Ref that Dashboard registers its cycleView fn into, so Navbar can call it
  const cycleDashboardViewRef = useRef<(() => void) | null>(null);

  // Session state — persists across route changes within the same app session
  const now = new Date();
  const [dashboardSession, setDashboardSession] =
    useState<DashboardSessionState>({
      selectedYear: now.getFullYear(),
      selectedMonth: now.getMonth(),
      monthSpan: 1,
      showGrandTotal: false,
      viewMode: DASHBOARD_VIEWS.CATEGORIES,
      filters: {
        filterGlobal: "",
        filterDateFrom: "",
        filterDateTo: "",
        filterDescription: "",
        filterAmount: "",
        selectedCategories: [],
        selectedPayees: [],
      },
    });
  const [analyticsSession, setAnalyticsSession] =
    useState<AnalyticsSessionState>({
      year: now.getFullYear(),
      selectedMonth: null,
    });

  const handleDashboardSessionChange = useCallback(
    (patch: Partial<DashboardSessionState>) => {
      setDashboardSession((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const handleAnalyticsSessionChange = useCallback(
    (patch: Partial<AnalyticsSessionState>) => {
      setAnalyticsSession((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const handlePageScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      handleScroll();
      handleScrollDirection(e.currentTarget);
    },
    [handleScroll, handleScrollDirection],
  );

  useEffect(() => {
    if (syncStatus === "idle") {
      refreshExpenses();
      refreshCategories();
      refreshPayees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus]);

  useEffect(() => {
    const init = async () => {
      const hasVisited = localStorage.getItem("outflow:hasVisited") === "true";
      const minLoadTime = (window as unknown as { outflowTestApi?: unknown }).outflowTestApi ? 0 : (hasVisited ? 1500 : 3000);
      const startTime = Date.now();

      await StorageService.materializePendingSnapshots?.().catch(console.error);
      await StorageService.rolloverSnapshots?.().catch(console.error);

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minLoadTime - elapsed);
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining));
      }

      setSnapshotsReady(true);
      if (!hasVisited) {
        localStorage.setItem("outflow:hasVisited", "true");
      }
    };
    init();
  }, []);

  const handleCategoriesChange = async (
    action: "add" | "update" | "delete",
    payload: { id?: number; name?: string },
  ): Promise<number | undefined> => {
    let newId: number | undefined;
    if (action === "add" && payload.name) {
      newId = await StorageService.addCategory(payload.name);
    } else if (action === "update" && payload.id != null && payload.name) {
      await StorageService.updateCategory(payload.id, { name: payload.name });
    } else if (action === "delete" && payload.id != null) {
      const archivedCategory = categories.find((category) => category.id === payload.id);
      await StorageService.deleteCategory(payload.id);
      showUndoToast(`${archivedCategory?.name ?? "Category"} archived.`, async () => {
        await StorageService.updateCategory(payload.id as number, {
          isArchived: false,
          archivedAt: undefined,
          mergedIntoCategoryId: null,
        });
        await refreshCategories();
        triggerSync?.();
      });
    }
    await refreshCategories();
    triggerSync?.();
    return newId;
  };

  const handleAdd = async (expense: Omit<Expense, "id">) => {
    await StorageService.add(expense);
    setExpenses(await StorageService.getAll());
    void saveSettings({ lastCheckInCompletedAt: new Date().toISOString() }).catch(
      (error) => console.warn("Check-in completion stamp failed:", error),
    );
    setShowForm(false);
    triggerSync?.();
  };

  const handleUpdate = async (id: number, changes: Partial<Expense>) => {
    let previousExpense: Expense | null = null;

    setExpenses((prev) =>
      prev.map((expense) => {
        if (expense.id !== id) return expense;
        previousExpense = expense;
        return { ...expense, ...changes };
      }),
    );

    try {
      await StorageService.update(id, changes);
      triggerSync?.();
    } catch (error) {
      if (previousExpense) {
        setExpenses((prev) =>
          prev.map((expense) =>
            expense.id === id ? previousExpense! : expense,
          ),
        );
      }
      throw error;
    }
  };

  const handleDelete = async (id: number) => {
    const expense = expenses.find((item) => item.id === id);
    if (!expense) return;
    const removedIndex = expenses.findIndex((item) => item.id === id);

    const timer = setTimeout(async () => {
      try {
        await StorageService.remove(id);
        triggerSync?.();
        await refreshExpenses();
      } finally {
        pendingExpenseDeleteTimersRef.current =
          pendingExpenseDeleteTimersRef.current.filter((item) => item !== timer);
        setPendingExpenseDeleteIds((current) =>
          current.filter((pendingId) => pendingId !== id),
        );
      }
    }, 4500);

    pendingExpenseDeleteTimersRef.current.push(timer);
    setPendingExpenseDeleteIds((current) => [...new Set([...current, id])]);
    setExpenses((prev) => prev.filter((item) => item.id !== id));
    showUndoToast(`Deleted ${expense.description?.trim() || "expense"}.`, async () => {
      clearTimeout(timer);
      pendingExpenseDeleteTimersRef.current =
        pendingExpenseDeleteTimersRef.current.filter((item) => item !== timer);
      setPendingExpenseDeleteIds((current) =>
        current.filter((pendingId) => pendingId !== id),
      );
      setExpenses((prev) => {
        if (prev.some((item) => item.id === id)) return prev;
        const restored = [...prev];
        restored.splice(Math.min(removedIndex, restored.length), 0, expense);
        return restored;
      });
    });
  };

  const handleBulkDelete = async (ids: number[]) => {
    const selected = expenses.filter((expense) =>
      ids.includes(expense.id as number),
    );
    if (selected.length === 0) return;

    const selectedIdSet = new Set(ids);
    const positions = selected.map((expense) => ({
      expense,
      index: expenses.findIndex((item) => item.id === expense.id),
    }));

    const timer = setTimeout(async () => {
      try {
        await StorageService.removeMany(ids);
        triggerSync?.();
        await refreshExpenses();
      } finally {
        pendingExpenseDeleteTimersRef.current =
          pendingExpenseDeleteTimersRef.current.filter((item) => item !== timer);
        setPendingExpenseDeleteIds((current) =>
          current.filter((pendingId) => !selectedIdSet.has(pendingId)),
        );
      }
    }, 4500);

    pendingExpenseDeleteTimersRef.current.push(timer);
    setPendingExpenseDeleteIds((current) => [...new Set([...current, ...ids])]);
    setExpenses((prev) =>
      prev.filter((expense) => !selectedIdSet.has(expense.id as number)),
    );
    showUndoToast(`Deleted ${selected.length} expenses.`, async () => {
      clearTimeout(timer);
      pendingExpenseDeleteTimersRef.current =
        pendingExpenseDeleteTimersRef.current.filter((item) => item !== timer);
      setPendingExpenseDeleteIds((current) =>
        current.filter((pendingId) => !selectedIdSet.has(pendingId)),
      );
      setExpenses((prev) => {
        const restored = [...prev];
        positions
          .slice()
          .sort((a, b) => a.index - b.index)
          .forEach(({ expense, index }) => {
            if (restored.some((item) => item.id === expense.id)) return;
            restored.splice(Math.min(index, restored.length), 0, expense);
          });
        return restored;
      });
    });
  };

  useEffect(
    () => () => {
      pendingExpenseDeleteTimersRef.current.forEach((timer) =>
        clearTimeout(timer),
      );
      pendingExpenseDeleteTimersRef.current = [];
    },
    [],
  );

  const visibleExpenses = useMemo(
    () =>
      expenses.filter(
        (expense) => !pendingExpenseDeleteIds.includes(expense.id as number),
      ),
    [expenses, pendingExpenseDeleteIds],
  );

  if (supabase && !loading && !user) return <AuthPage />;

  const isReady = !loading && settingsLoaded && snapshotsReady;

  return (
    <BrowserRouter>
      <div className="h-dvh bg-theme-background flex">
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
            <main
              className={cn(
                "flex-1 min-w-0 overflow-hidden bg-theme-background",
                isScrolling && "is-scrolling",
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
                        cycleDashboardViewRef.current = fn;
                      }}
                      sessionState={dashboardSession}
                      onSessionStateChange={handleDashboardSessionChange}
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
                    >
                      <SummaryPage expenses={visibleExpenses} />
                    </ScrollablePage>
                  }
                />
                <Route
                  path={ROUTES.ANALYTICS}
                  element={
                    <ScrollablePage onScroll={handlePageScroll} onRouteChange={resetScrollDirection}>
                      <AnalyticsPage
                        expenses={visibleExpenses}
                        categories={categories}
                        sessionState={analyticsSession}
                        onSessionStateChange={handleAnalyticsSessionChange}
                      />
                    </ScrollablePage>
                  }
                />
                <Route
                  path={ROUTES.PAYEES}
                  element={
                    <ScrollablePage onScroll={handlePageScroll} onRouteChange={resetScrollDirection}>
                      <PayeesPage />
                    </ScrollablePage>
                  }
                />
                <Route
                  path={ROUTES.SETTINGS}
                  element={
                    <ScrollablePage onScroll={handlePageScroll} onRouteChange={resetScrollDirection}>
                      <SettingsPage
                        expenses={visibleExpenses}
                        onImport={async () =>
                          setExpenses(await StorageService.getAll())
                        }
                        onRefreshAll={async () => {
                          await refreshExpenses();
                          await refreshCategories();
                          await refreshPayees();
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
  );
}
