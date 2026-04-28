// @ts-nocheck
import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { StorageService } from "./services/storageService";
import { useAuth } from "./context/authContext";
import { useSettings } from "./context/settingsContext";
import { supabase } from "./services/supabase";
import { useExpenses, useCategories } from "./hooks/useLocalData";
import Navbar from "./components/layout/Navbar";
import ExpenseForm from "./features/expenses/ExpenseForm";
import Dashboard from "./features/dashboard/Dashboard";
import SummaryPage from "./features/summary/SummaryPage";
import AnalyticsPage from "./features/analytics/AnalyticsPage";
import AuthPage from "./features/auth/AuthPage";
import SettingsPage from "./features/settings/SettingsPage";

function SyncDot({ status }) {
  if (!supabase) return null;
  const styles = {
    idle: "bg-theme-success",
    syncing: "bg-yellow-400 animate-pulse",
    offline: "bg-theme-muted",
    error: "bg-theme-danger",
  };
  const labels = {
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

  useEffect(() => {
    if (syncStatus === "idle") {
      refreshExpenses();
      refreshCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus]);

  useEffect(() => {
    StorageService.materializePendingSnapshots?.().catch(console.error)
  }, [])

  const handleCategoriesChange = async (action, payload) => {
    if (action === "add") await StorageService.addCategory(payload.name);
    else if (action === "update")
      await StorageService.updateCategory(payload.id, { name: payload.name });
    else if (action === "delete")
      await StorageService.deleteCategory(payload.id);
    await refreshCategories();
    triggerSync?.();
  };

  const handleAdd = async (expense) => {
    await StorageService.add(expense);
    setExpenses(await StorageService.getAll());
    setShowForm(false);
    triggerSync?.();
  };

  const handleUpdate = async (id, changes) => {
    await StorageService.update(id, changes);
    setExpenses(await StorageService.getAll());
    triggerSync?.();
  };

  const handleDelete = async (id) => {
    await StorageService.remove(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    triggerSync?.();
  };

  const handleBulkDelete = async (ids) => {
    await StorageService.removeMany(ids);
    setExpenses((prev) => prev.filter((e) => !ids.includes(e.id)));
    triggerSync?.();
  };

  if (supabase && !loading && !user) return <AuthPage />;

  const isReady = !loading && settingsLoaded;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-theme-background flex">
        {!isReady ? (
          <div className="flex-1 p-10" style={{ fontFamily: "system-ui, sans-serif" }}>
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
              onSignOut={supabase ? signOut : null}
              userEmail={user?.email}
            />
            <main className="flex-1 min-w-0 pb-24 sm:pb-0">
              <Routes>
                <Route
                  path="/"
                  element={
                    <Dashboard
                      expenses={expenses}
                      categories={categories}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onBulkDelete={handleBulkDelete}
                    />
                  }
                />
                <Route
                  path="/summary"
                  element={<SummaryPage expenses={expenses} />}
                />
                <Route
                  path="/analytics"
                  element={
                    <AnalyticsPage
                      expenses={expenses}
                      categories={categories}
                    />
                  }
                />
                <Route
                  path="/settings"
                  element={
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
