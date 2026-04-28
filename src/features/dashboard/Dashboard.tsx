import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "../../utils/cn";
import "./dashboard.css";
import Modal from "../../components/ui/Modal";
import { StorageService } from "../../services/storageService";
import { useSettings } from "../../context/settingsContext";
import { getMonthlyFinancialSummary } from "../../utils/financeEngine";
import ExpenseTable from "../expenses/ExpenseTable";
import BudgetInsights from "./BudgetInsights";
import type { Expense, Category, MonthlySummary } from "../../types";

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

interface DashboardProps {
  expenses: Expense[];
  categories: Category[];
  onUpdate: (id: number, changes: Partial<Expense>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onBulkDelete: (ids: number[]) => Promise<void>;
}

export default function Dashboard({
  expenses,
  categories,
  onUpdate,
  onDelete,
  onBulkDelete,
}: DashboardProps) {
  const now = new Date();
  const { formatAmount, getNumberColorClass } = useSettings();
  const [searchParams] = useSearchParams();
  const [selectedYear, setSelectedYear] = useState(
    () => parseInt(searchParams.get("year") || "", 10) || now.getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const m = parseInt(searchParams.get("month") || "", 10);
    return isNaN(m) ? now.getMonth() : m;
  });
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [financialSummary, setFinancialSummary] =
    useState<MonthlySummary | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const now = new Date();
      const isCurrentOrFuture =
        selectedYear > now.getFullYear() ||
        (selectedYear === now.getFullYear() && selectedMonth >= now.getMonth());

      const [
        allFixed,
        allSnapshots,
        globalIncome,
        globalRate,
        schedules,
        incomeSnaps,
        savingsSnaps,
      ] = await Promise.all([
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
          fixedExpenseId: f.id as number,
          year: selectedYear,
          month: selectedMonth + 1,
          amountSnapshot: f.amount,
          nameSnapshot: f.name,
        }));
      } else {
        monthSnapshots = allSnapshots.filter(
          (s) => s.month === selectedMonth + 1,
        );
      }

      const data = {
        expenses,
        snapshots: monthSnapshots,
        fixedExpenses: allFixed,
        globalIncome: globalIncome as number,
        globalSavingsRate: globalRate as number,
        schedules,
        incomeSnapshots: incomeSnaps,
        savingsSnapshots: savingsSnaps,
      };

      const summary = getMonthlyFinancialSummary(
        selectedYear,
        selectedMonth,
        data,
      );
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
  const resolveName = (exp: Expense) =>
    catMap[exp.categoryId as number]?.name ??
    exp.category ??
    "Uncategorized";

  const monthlyExpenses = useMemo(
    () => expenses.filter((e) => e.date.startsWith(selectedKey)),
    [expenses, selectedKey],
  );

  const filtered = useMemo(
    () =>
      selectedCategories.size === 0
        ? monthlyExpenses
        : monthlyExpenses.filter((e) =>
            selectedCategories.has(resolveName(e)),
          ),
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

  const toggleSelect = useCallback((id: number) => {
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
      return new Set(filtered.map((e) => e.id as number));
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
    const map: Record<string, number> = {};
    monthlyExpenses.forEach((e) => {
      const n = resolveName(e);
      map[n] = (map[n] || 0) + e.amount;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [monthlyExpenses, catMap]);

  const label = new Date(selectedYear, selectedMonth).toLocaleString(
    "default",
    {
      month: "long",
      year: "numeric",
    },
  );

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-theme-text tracking-tight">
          Dashboard
        </h1>
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
              className={cn(
                "category-chip",
                selectedCategories.size === 0
                  ? "category-chip-active"
                  : "category-chip-inactive"
              )}
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
                  className={cn(
                    "category-chip",
                    isSelected
                      ? "category-chip-active"
                      : "category-chip-inactive"
                  )}
                >
                  <span>{cat}</span>
                  <span
                    className={
                      isSelected
                        ? "text-white/80"
                        : getNumberColorClass(total)
                    }
                  >
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
            className="month-nav-btn"
            aria-label="Previous month"
          >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div className="text-center">
              <span
                className={cn(
                  "text-lg font-semibold",
                  isCurrentMonth ? "text-theme-primary" : "text-theme-text"
                )}
              >
                {label}
              </span>
              {isCurrentMonth && (
                <span className="current-badge">
                  current
                </span>
              )}
              <p className="text-sm text-theme-muted mt-0.5">
                {monthlyExpenses.length} transaction
                {monthlyExpenses.length !== 1 ? "s" : ""} ·{" "}
                <span
                  className={getNumberColorClass(
                    financialSummary?.variableExpenses ?? 0,
                  )}
                >
                  {formatAmount(financialSummary?.variableExpenses ?? 0)}
                </span>
              </p>
            </div>
            <button
            onClick={nextMonth}
            className="month-nav-btn"
            aria-label="Next month"
          >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Manage button */}
          <button
            onClick={toggleManageMode}
            aria-label={manageMode ? "Done" : "Manage"}
            aria-pressed={manageMode}
            className={cn(
              "dashboard-manage-btn",
              manageMode
                ? "bg-theme-primary text-white"
                : "text-theme-muted hover:text-theme-text hover:bg-theme-background"
            )}
          >
            {manageMode ? (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            )}
          </button>

          {manageMode && selectedIds.size > 0 && (
            <button
              onClick={handleBulkDeleteClick}
              className="bulk-delete-btn"
            >
              Delete {selectedIds.size}
            </button>
          )}
        </div>

        {/* Confirm delete modal */}
        <Modal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          title="Confirm Delete"
          size="sm"
        >
          <p className="text-sm text-theme-muted">
            Are you sure you want to delete{" "}
            <strong className="text-theme-text">{selectedIds.size}</strong>{" "}
            expense{selectedIds.size !== 1 ? "s" : ""}?
          </p>
          <div className="flex gap-3">
            <button
              onClick={confirmDelete}
              className="confirm-delete-btn"
            >
              Delete
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="confirm-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </Modal>

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
