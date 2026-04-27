import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useSearchParams,
} from "react-router-dom";
import { StorageService } from "./StorageService";
import { useAuth } from "./AuthContext";
import { useSettings } from "./SettingsContext";
import { supabase } from "./supabase";
import Navbar from "./Navbar";
import ExpenseForm from "./ExpenseForm";
import ExpenseTable from "./ExpenseTable";
import SummaryPage from "./SummaryPage";
import AnalyticsPage from "./AnalyticsPage";
import AuthPage from "./AuthPage";
import SettingsPage from "./SettingsPage";

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

// ── Sync status dot ───────────────────────────────────────────────────────────
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
      className="flex items-center gap-1 text-xs text-white/70"
      title={labels[status]}
    >
      <span
        className={`w-2 h-2 rounded-theme-small ${styles[status] ?? styles.idle}`}
      />
      <span className="hidden sm:inline">{labels[status]}</span>
    </span>
  );
}

// ── Budget insight cards ──────────────────────────────────────────────────────
function BudgetInsights({
  monthTotal,
  monthlyIncome,
  savingsRate,
  totalFixed,
  fixedExpenses,
}) {
  const { formatAmount, getNumberColorClass } = useSettings();
  if (!monthlyIncome) return null;
  const available = monthlyIncome - totalFixed;
  const savings = Math.max(0, available * (savingsRate / 100));
  const remaining = available - savings - monthTotal;
  const totalSavings = savings + remaining;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-theme-muted uppercase tracking-widest">
        Budget Insights
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Monthly Spending", value: monthTotal, tone: "warning" },
          { label: "Auto Savings", value: savings, tone: "positive" },
          {
            label: "Remaining Budget",
            value: remaining,
            tone: remaining >= 0 ? "positive" : "negative",
          },
          {
            label: "Total Savings",
            value: totalSavings,
            tone: totalSavings >= 0 ? "positive" : "negative",
          },
        ].map(({ label, value, tone }) => {
          const toneClasses = {
            warning: "text-yellow-600",
            positive: "positive-number",
            negative: "negative-number",
            primary: "text-theme-primary",
          };
          return (
            <div
              key={label}
              className="bg-theme-surface rounded-theme-large shadow-sm px-4 py-3 border border-theme-border"
            >
              <p className="text-xs text-theme-muted uppercase tracking-widest mb-2">
                {label}
              </p>
              <p className={`text-xl font-semibold ${toneClasses[tone]}`}>
                {formatAmount(value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Fixed Expenses summary card */}
      {fixedExpenses.length > 0 && (
        <div className="bg-theme-surface rounded-theme-large shadow-sm px-4 py-3 space-y-2 border border-theme-border">
          <div className="flex justify-between items-center">
            <p className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
              Fixed Expenses
            </p>
            <p className="text-lg font-semibold text-orange-600">
              {formatAmount(totalFixed)}
            </p>
          </div>
          <ul className="divide-y divide-theme-border">
            {fixedExpenses.map((f) => (
              <li key={f.id} className="flex justify-between py-1 text-sm">
                <span className="text-theme-text">{f.name}</span>
                <span
                  className={`text-theme-text font-medium ${getNumberColorClass(f.amount)}`}
                >
                  {formatAmount(f.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ expenses, categories, onUpdate, onDelete, onBulkDelete }) {
  const now = new Date();
  const { formatAmount, getNumberColorClass } = useSettings();
  const [searchParams] = useSearchParams();
  const [selectedYear, setSelectedYear] = useState(
    () => parseInt(searchParams.get("year")) || now.getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const m = parseInt(searchParams.get("month"));
    return isNaN(m) ? now.getMonth() : m;
  });
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [savingsRate, setSavingsRate] = useState(0);
  const [totalFixed, setTotalFixed] = useState(0);
  const [fixedExpensesList, setFixedExpensesList] = useState([]);

  useEffect(() => {
    Promise.all([
      StorageService.getSetting("monthlyIncome", 0),
      StorageService.getSetting("savingsRate", 0),
      StorageService.getFixedExpenses(),
    ]).then(([income, rate, fixed]) => {
      setMonthlyIncome(income);
      setSavingsRate(rate);
      setFixedExpensesList(fixed);
      setTotalFixed(fixed.reduce((s, f) => s + f.amount, 0));
    });
  }, []);

  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else setSelectedMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else setSelectedMonth((m) => m + 1);
  };

  const selectedKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const isCurrentMonth = selectedKey === currentMonthKey();

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );
  const resolveName = (exp) =>
    catMap[exp.categoryId]?.name ?? exp.category ?? "Uncategorized";

  const monthlyExpenses = useMemo(
    () => expenses.filter((e) => e.date.startsWith(selectedKey)),
    [expenses, selectedKey],
  );

  const filtered = useMemo(
    () =>
      selectedCategories.size === 0
        ? monthlyExpenses
        : monthlyExpenses.filter((e) => selectedCategories.has(resolveName(e))),
    [monthlyExpenses, selectedCategories, catMap],
  );

  const toggleManageMode = useCallback(() => {
    setManageMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
        setShowConfirm(false);
      }
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((e) => e.id));
    });
  }, [filtered]);

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedIds.size === 0) return;
    setShowConfirm(true);
  }, [selectedIds]);

  const confirmDelete = useCallback(() => {
    onBulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowConfirm(false);
  }, [selectedIds, onBulkDelete]);

  const monthTotal = useMemo(
    () => monthlyExpenses.reduce((s, e) => s + e.amount, 0),
    [monthlyExpenses],
  );

  const categoryTotals = useMemo(() => {
    const map = {};
    monthlyExpenses.forEach((e) => {
      const n = resolveName(e);
      map[n] = (map[n] || 0) + e.amount;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [monthlyExpenses, catMap]);

  const label = new Date(selectedYear, selectedMonth).toLocaleString(
    "default",
    { month: "long", year: "numeric" },
  );

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
      <BudgetInsights
        monthTotal={monthTotal}
        monthlyIncome={monthlyIncome}
        savingsRate={savingsRate}
        totalFixed={totalFixed}
        fixedExpenses={fixedExpensesList}
      />

      {categoryTotals.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
            Spending by Category
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategories(new Set())}
              className={`px-3 py-1.5 rounded-theme-medium text-sm font-medium transition-colors ${
                selectedCategories.size === 0
                  ? "bg-theme-primary text-white"
                  : "bg-theme-surface text-theme-muted border border-theme-border hover:bg-theme-background"
              }`}
            >
              All
            </button>
            {categoryTotals.map(([cat, total]) => {
              const isSelected = selectedCategories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => {
                    const next = new Set(selectedCategories);
                    if (next.has(cat)) next.delete(cat);
                    else next.add(cat);
                    setSelectedCategories(next);
                  }}
                  className={`px-3 py-1.5 rounded-theme-medium text-sm font-medium transition-colors flex items-center gap-2 ${
                    isSelected
                      ? "bg-theme-primary text-white"
                      : "bg-theme-surface text-theme-muted border border-theme-border hover:bg-theme-background"
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={
                      isSelected ? "text-white/80" : getNumberColorClass(total)
                    }
                  >
                    {formatAmount(total)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="bg-theme-surface rounded-theme-large shadow-sm p-4 space-y-4 border border-theme-border">
        <div className="relative flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-2 rounded-theme-small hover:bg-theme-background text-theme-muted hover:text-theme-text transition-colors"
            aria-label="Previous month"
          >
            &#8592;
          </button>
          <div className="text-center">
            <span
              className={`text-lg font-semibold ${isCurrentMonth ? "text-theme-primary" : "text-theme-text"}`}
            >
              {label}
            </span>
            {isCurrentMonth && (
              <span className="ml-2 text-xs bg-theme-primary/10 text-theme-primary px-2 py-0.5 rounded-theme-medium">
                current
              </span>
            )}
            <p className="text-sm text-theme-muted mt-0.5">
              {monthlyExpenses.length} transaction
              {monthlyExpenses.length !== 1 ? "s" : ""} ·{" "}
              <span className={getNumberColorClass(monthTotal)}>
                {formatAmount(monthTotal)}
              </span>
            </p>
          </div>
          <button
            onClick={nextMonth}
            className="p-2 rounded-theme-small hover:bg-theme-background text-theme-muted hover:text-theme-text transition-colors"
            aria-label="Next month"
          >
            &#8594;
          </button>

          {/* Floating manage button — does not affect flex flow */}
          <button
            onClick={toggleManageMode}
            aria-label={manageMode ? "Done" : "Manage"}
            aria-pressed={manageMode}
            className={`absolute right-8 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-theme-small transition-colors focus:outline-none focus:ring-2 focus:ring-theme-primary/40 z-10 ${
              manageMode ? "text-white" : "text-theme-muted"
            }`}
          >
            {manageMode ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            )}
          </button>

          {/* Floating bulk-delete button — sits left of manage button */}
          {manageMode && selectedIds.size > 0 && (
            <button
              onClick={handleBulkDeleteClick}
              className="absolute right-12 top-1/2 -translate-y-1/2 text-xs font-medium px-2.5 py-1.5 rounded-theme-small bg-theme-danger text-white hover:opacity-90 transition-opacity z-10"
            >
              Delete {selectedIds.size}
            </button>
          )}
        </div>

        {showConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
            <div className="modal-theme p-5 w-full max-w-xs space-y-4">
              <h3 className="text-base font-semibold text-theme-text">
                Confirm Delete
              </h3>
              <p className="text-sm text-theme-muted">
                Are you sure you want to delete{" "}
                <strong className="text-theme-text">{selectedIds.size}</strong>{" "}
                expense{selectedIds.size !== 1 ? "s" : ""}?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-theme-danger hover:opacity-90 text-white text-sm font-medium py-2 rounded-theme-small transition-opacity focus:outline-none focus:ring-2 focus:ring-theme-danger/50"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 bg-theme-background hover:bg-theme-border text-theme-text text-sm font-medium py-2 rounded-theme-small transition-colors border border-theme-border focus:outline-none focus:ring-2 focus:ring-theme-primary/40"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <ExpenseTable
          expenses={filtered}
          onUpdate={onUpdate}
          onDelete={onDelete}
          categories={categories}
          manageMode={manageMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      </section>
    </main>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading, syncStatus, triggerSync, signOut } = useAuth();
  const { loaded: settingsLoaded } = useSettings();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    Promise.all([StorageService.getAll(), StorageService.getCategories()]).then(
      ([exps, cats]) => {
        setExpenses(exps);
        setCategories(cats);
      },
    );
  }, []);

  // Re-load local data after a sync pull so UI reflects merged state
  useEffect(() => {
    if (syncStatus === "idle") {
      Promise.all([
        StorageService.getAll(),
        StorageService.getCategories(),
      ]).then(([exps, cats]) => {
        setExpenses(exps);
        setCategories(cats);
      });
    }
  }, [syncStatus]);

  const refreshCategories = () =>
    StorageService.getCategories().then(setCategories);

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

  // Show auth page only when Supabase is configured and user is not logged in
  if (supabase && !loading && !user) return <AuthPage />;
  if (loading || !settingsLoaded) return null;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-theme-background">
        <Navbar
          onAddExpense={() => setShowForm(true)}
          syncDot={<SyncDot status={syncStatus} />}
          onSignOut={supabase ? signOut : null}
          userEmail={user?.email}
        />
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
              <AnalyticsPage expenses={expenses} categories={categories} />
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
              />
            }
          />
        </Routes>
        {showForm && (
          <ExpenseForm
            onAdd={handleAdd}
            onClose={() => setShowForm(false)}
            categories={categories}
            onCategoriesChange={handleCategoriesChange}
          />
        )}
      </div>
    </BrowserRouter>
  );
}
