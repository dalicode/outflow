// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { StorageService } from "../../services/storageService";
import { useSettings } from "../../context/settingsContext";
import { getMonthlyFinancialSummary } from "../../utils/financeEngine";
import ExpenseTable from "../expenses/ExpenseTable";
import BudgetInsights from "./BudgetInsights";

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

export default function Dashboard({
  expenses,
  categories,
  onUpdate,
  onDelete,
  onBulkDelete,
}) {
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
  const [financialSummary, setFinancialSummary] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const now = new Date();
      const isCurrentOrFuture =
        selectedYear > now.getFullYear() ||
        (selectedYear === now.getFullYear() && selectedMonth >= now.getMonth());

      const [allFixed, allSnapshots, globalIncome, globalRate, schedules, incomeSnaps, savingsSnaps] =
        await Promise.all([
          StorageService.getFixedExpenses(),
          StorageService.getSnapshotsForYear(selectedYear),
          StorageService.getSetting("monthlyIncome", 0),
          StorageService.getSetting("savingsRate", 0),
          StorageService.getActiveSchedules(),
          StorageService.getIncomeSnapshotsForYear(selectedYear),
          StorageService.getSavingsSnapshotsForYear(selectedYear),
        ]);

      let monthSnapshots;
      if (isCurrentOrFuture) {
        const active = allFixed.filter((f) => f.isArchived !== true);
        monthSnapshots = active.map((f) => ({
          fixedExpenseId: f.id,
          year: selectedYear,
          month: selectedMonth + 1,
          amountSnapshot: f.amount,
          nameSnapshot: f.name,
        }));
      } else {
        monthSnapshots = allSnapshots.filter((s) => s.month === selectedMonth + 1);
      }

      const data = {
        expenses,
        snapshots: monthSnapshots,
        fixedExpenses: allFixed,
        globalIncome,
        globalSavingsRate: globalRate,
        schedules,
        incomeSnapshots: incomeSnaps,
        savingsSnapshots: savingsSnaps,
      };

      const summary = getMonthlyFinancialSummary(selectedYear, selectedMonth, data);
      setFinancialSummary(summary);
    };
    loadData();
  }, [selectedYear, selectedMonth, expenses]);

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

  const categoryTotals = useMemo(() => {
    const map = {};
    monthlyExpenses.forEach((e) => {
      const n = resolveName(e);
      map[n] = (map[n] || 0) + e.amount;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [monthlyExpenses, catMap]);

  const label = new Date(selectedYear, selectedMonth).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-theme-text tracking-tight">Dashboard</h1>
      </div>
      {/* Budget Insights */}
      {financialSummary && <BudgetInsights summary={financialSummary} />}

      {/* Category filter chips */}
      {categoryTotals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-theme-text tracking-tight mb-3">
            Filter by Category
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategories(new Set())}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategories.size === 0
                  ? "bg-theme-primary text-white"
                      : "bg-theme-surface text-theme-muted shadow-sm hover:text-theme-text"
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
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                    isSelected
                      ? "bg-theme-primary text-white"
                  : "bg-theme-surface text-theme-muted shadow-sm hover:text-theme-text"
                  }`}
                >
                  <span>{cat}</span>
                  <span className={isSelected ? "text-white/80" : getNumberColorClass(total)}>
                    {formatAmount(total)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Expenses Table Card */}
      <section className="rounded-xl bg-theme-surface shadow-sm p-4 md:p-5 space-y-4">
        {/* Month nav header */}
        <div className="relative flex items-center justify-center">
          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-theme-background text-theme-muted hover:text-theme-text transition-colors"
              aria-label="Previous month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <span className={`text-lg font-semibold ${isCurrentMonth ? "text-theme-primary" : "text-theme-text"}`}>
                {label}
              </span>
              {isCurrentMonth && (
                <span className="ml-2 text-xs bg-theme-primary/10 text-theme-primary px-2 py-0.5 rounded-full font-medium">
                  current
                </span>
              )}
              <p className="text-sm text-theme-muted mt-0.5">
                {monthlyExpenses.length} transaction{monthlyExpenses.length !== 1 ? "s" : ""} ·{" "}
                <span className={getNumberColorClass(financialSummary?.variableExpenses ?? 0)}>
                  {formatAmount(financialSummary?.variableExpenses ?? 0)}
                </span>
              </p>
            </div>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-theme-background text-theme-muted hover:text-theme-text transition-colors"
              aria-label="Next month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Manage button */}
          <button
            onClick={toggleManageMode}
            aria-label={manageMode ? "Done" : "Manage"}
            aria-pressed={manageMode}
            className={`absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-theme-primary/40 z-10 ${
              manageMode
                ? "bg-theme-primary text-white"
                : "text-theme-muted hover:text-theme-text hover:bg-theme-background"
            }`}
          >
            {manageMode ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            )}
          </button>

          {manageMode && selectedIds.size > 0 && (
            <button
              onClick={handleBulkDeleteClick}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-theme-danger text-white hover:opacity-90 transition-opacity z-10"
            >
              Delete {selectedIds.size}
            </button>
          )}
        </div>

        {/* Confirm delete modal */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
            <div className="bg-theme-surface rounded-xl p-6 w-full max-w-xs space-y-4 shadow-lg">
              <h3 className="text-base font-semibold text-theme-text">Confirm Delete</h3>
              <p className="text-sm text-theme-muted">
                Are you sure you want to delete{" "}
                <strong className="text-theme-text">{selectedIds.size}</strong>{" "}
                expense{selectedIds.size !== 1 ? "s" : ""}?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-theme-danger hover:opacity-90 text-white text-sm font-semibold py-2.5 rounded-lg transition-opacity focus:outline-none focus:ring-2 focus:ring-theme-danger/50"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 bg-theme-background hover:bg-theme-border text-theme-text text-sm font-semibold py-2.5 rounded-lg transition-colors border border-theme-border focus:outline-none focus:ring-2 focus:ring-theme-primary/40"
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
