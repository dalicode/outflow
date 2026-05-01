import { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import { StorageService } from "./services/storageService";
import { useAuth } from "./context/authContext";
import { useSettings } from "./context/settingsContext";
import { supabase } from "./services/supabase";
import { useExpenses, useCategories } from "./hooks/useLocalData";
import { cn } from "./utils/cn";
import { ROUTES } from "./constants/routes";
import Navbar from "./components/layout/Navbar";
import ExpenseForm from "./features/expenses/ExpenseForm";
import Dashboard from "./features/dashboard/Dashboard";
import SummaryPage from "./features/summary/SummaryPage";
import AnalyticsPage from "./features/analytics/AnalyticsPage";
import AuthPage from "./features/auth/AuthPage";
import SettingsPage from "./features/settings/SettingsPage";
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

function useScrollDirection() {
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

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

  return { direction, onScroll };
}

function ScrollablePage({
  children,
  onScroll,
}: {
  children: React.ReactNode;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}) {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div
      ref={ref}
      className="h-full overflow-y-auto scrollbar-auto-hide"
      onScroll={onScroll}
    >
      {children}
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

export default function App() {
  const { user, loading, syncStatus, triggerSync, signOut } = useAuth();
  const { loaded: settingsLoaded } = useSettings();
  const { expenses, setExpenses, refresh: refreshExpenses } = useExpenses();
  const {
    categories,
    setCategories,
    refresh: refreshCategories,
  } = useCategories();
  const [showForm, setShowForm] = useState(false);
  const { isScrolling, handleScroll } = useScrollVisibility();
  const { direction, onScroll: handleScrollDirection } = useScrollDirection();
  const [mobileSelectionActive, setMobileSelectionActive] = useState(false);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus]);

  useEffect(() => {
    StorageService.materializePendingSnapshots?.().catch(console.error);
  }, []);

  const handleCategoriesChange = async (
    action: "add" | "update" | "delete",
    payload: { id?: number; name?: string },
  ) => {
    if (action === "add" && payload.name)
      await StorageService.addCategory(payload.name);
    else if (action === "update" && payload.id != null && payload.name)
      await StorageService.updateCategory(payload.id, { name: payload.name });
    else if (action === "delete" && payload.id != null)
      await StorageService.deleteCategory(payload.id);
    await refreshCategories();
    triggerSync?.();
  };

  const handleAdd = async (expense: Omit<Expense, "id">) => {
    await StorageService.add(expense);
    setExpenses(await StorageService.getAll());
    setShowForm(false);
    triggerSync?.();
  };

  const handleUpdate = async (id: number, changes: Partial<Expense>) => {
    await StorageService.update(id, changes);
    setExpenses(await StorageService.getAll());
    triggerSync?.();
  };

  const handleDelete = async (id: number) => {
    await StorageService.remove(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    triggerSync?.();
  };

  const handleBulkDelete = async (ids: number[]) => {
    await StorageService.removeMany(ids);
    setExpenses((prev) => prev.filter((e) => !ids.includes(e.id as number)));
    triggerSync?.();
  };

  if (supabase && !loading && !user) return <AuthPage />;

  const isReady = !loading && settingsLoaded;

  return (
    <BrowserRouter>
      <div className="h-dvh bg-theme-background flex">
        {!isReady ? (
          <div
            className="flex-1 p-10"
            style={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", Arial, sans-serif',
            }}
          >
            <p className="text-lg font-bold mb-3">Loading…</p>
            <p>Auth loading: {String(loading)}</p>
            <p>Settings loaded: {String(settingsLoaded)}</p>
            <p>Supabase configured: {String(!!supabase)}</p>
            <p className="mt-3 text-xs text-gray-500">
              If this persists, check the browser console for errors.
            </p>
          </div>
        ) : (
          <>
            <Navbar
              onAddExpense={() => setShowForm(true)}
              syncDot={<SyncDot status={syncStatus} />}
              onSignOut={supabase ? signOut : undefined}
              userEmail={user?.email}
              scrollDirection={direction}
              hidden={mobileSelectionActive}
            />
            <main
              className={cn(
                "flex-1 min-w-0 overflow-hidden",
                isScrolling && "is-scrolling"
              )}
            >
              <Routes>
                <Route
                  path={ROUTES.DASHBOARD}
                  element={
                    <Dashboard
                      expenses={expenses}
                      categories={categories}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onBulkDelete={handleBulkDelete}
                      onSelectionChange={setMobileSelectionActive}
                      onScroll={handlePageScroll}
                    />
                  }
                />
                <Route
                  path={ROUTES.SUMMARY}
                  element={
                    <ScrollablePage onScroll={handlePageScroll}>
                      <SummaryPage expenses={expenses} />
                    </ScrollablePage>
                  }
                />
                <Route
                  path={ROUTES.ANALYTICS}
                  element={
                    <ScrollablePage onScroll={handlePageScroll}>
                      <AnalyticsPage
                        expenses={expenses}
                        categories={categories}
                      />
                    </ScrollablePage>
                  }
                />
                <Route
                  path={ROUTES.SETTINGS}
                  element={
                    <ScrollablePage onScroll={handlePageScroll}>
                      <SettingsPage
                        expenses={expenses}
                        onImport={async () =>
                          setExpenses(await StorageService.getAll())
                        }
                        onRefreshAll={async () => {
                          await refreshExpenses();
                          await refreshCategories();
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
              />
            )}
          </>
        )}
      </div>
    </BrowserRouter>
  );
}
