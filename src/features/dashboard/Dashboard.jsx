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

  // Load raw data and compute via engine — single source of truth
  useEffect(() => {
    const loadData = async () => {
      const now = new Date();
      const isCurrentOrFuture =
        selectedYear > now.getFullYear() ||
        (selectedYear === now.getFullYear() && selectedMonth >= now.getMonth());

      const [allFixed, allSnapshots, globalIncome, globalRate, incomeRules, savingsRules, schedules] =
        await Promise.all([
          StorageService.getFixedExpenses(),
          StorageService.getSnapshotsForYear(selectedYear),
          StorageService.getSetting("monthlyIncome", 0),
          StorageService.getSetting("savingsRate", 0),
          StorageService.getSetting("yearlyIncomeOverrides", {}),
          StorageService.getSetting("yearlySavingsOverrides", {}),
          StorageService.getActiveSchedules(),
        ]);

      // For current/future months, active definitions act as virtual snapshots
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
        incomeRules,
        savingsRules,
        globalIncome,
        globalSavingsRate: globalRate,
        schedules,
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

  const label = new Date(selectedYear, selectedMonth).toLocaleString(
    "default",
    { month: "long", year: "numeric" },
  );

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
      {financialSummary && (
        <BudgetInsights summary={financialSummary} />
      )}

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
        <div className="relative flex items-center justify-center">
          <div className="flex items-center gap-3">
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
                <span className={getNumberColorClass(financialSummary?.variableExpenses ?? 0)}>
                  {formatAmount(financialSummary?.variableExpenses ?? 0)}
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
          </div>

          {/* Floating manage button */}
          <button
            onClick={toggleManageMode}
            aria-label={manageMode ? "Done" : "Manage"}
            aria-pressed={manageMode}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-theme-small transition-colors focus:outline-none focus:ring-2 focus:ring-theme-primary/40 z-10 ${
              manageMode
                ? "text-white"
                : "text-theme-muted hover:text-theme-text hover:bg-theme-background"
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
