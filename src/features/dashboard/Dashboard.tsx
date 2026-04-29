import { useState, useEffect, useMemo, useCallback, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "../../utils/cn";
import "./dashboard.css";
import Modal from "../../components/ui/Modal";
import { StorageService } from "../../services/storageService";
import { useSettings } from "../../context/settingsContext";
import { getMonthlyFinancialSummary } from "../../utils/financeEngine";
import ExpenseTable from "../expenses/ExpenseTable";
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
  const [viewMode, setViewMode] = useState<"expenses" | "categories">(
    "categories",
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [financialSummary, setFinancialSummary] =
    useState<MonthlySummary | null>(null);
  const [incomeRaw, setIncomeRaw] = useState("");
  const [incomeFreq, setIncomeFreq] = useState("monthly");
  const [reloadKey, setReloadKey] = useState(0);

  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [incomeDraft, setIncomeDraft] = useState("");
  const [incomeFreqDraft, setIncomeFreqDraft] = useState("monthly");
  const [incomeError, setIncomeError] = useState("");

  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [savingsDraft, setSavingsDraft] = useState("");
  const [savingsError, setSavingsError] = useState("");

  const FREQUENCIES = ["monthly", "biweekly", "weekly"] as const;
  const MULTIPLIERS: Record<string, number> = {
    monthly: 1,
    biweekly: 2.17,
    weekly: 4.33,
  };

  const openIncomeModal = () => {
    setIncomeDraft(incomeRaw ? String(incomeRaw) : "");
    setIncomeFreqDraft(incomeFreq || "monthly");
    setIncomeError("");
    setShowIncomeModal(true);
  };

  const closeIncomeModal = () => {
    setShowIncomeModal(false);
    setIncomeError("");
  };

  const submitIncome = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseFloat(incomeDraft);
    if (!incomeDraft || isNaN(parsed) || parsed <= 0) {
      setIncomeError("Enter a positive amount.");
      return;
    }
    setIncomeError("");
    handleIncomeSave({
      income: parsed,
      frequency: incomeFreqDraft,
      monthlyIncome: parsed * MULTIPLIERS[incomeFreqDraft],
    });
    setShowIncomeModal(false);
  };

  const openSavingsModal = () => {
    setSavingsDraft(String(financialSummary?.savingsRate ?? 0));
    setSavingsError("");
    setShowSavingsModal(true);
  };

  const closeSavingsModal = () => {
    setShowSavingsModal(false);
    setSavingsError("");
  };

  const submitSavings = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const n = Number(savingsDraft);
    if (isNaN(n) || n < 0 || n > 100) {
      setSavingsError("Enter a value between 0 and 100.");
      return;
    }
    setSavingsError("");
    handleSavingsRateSave(n);
    setShowSavingsModal(false);
  };

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
        incomeAmount,
        incomeFrequency,
      ] = await Promise.all([
        StorageService.getFixedExpenses(),
        StorageService.getSnapshotsForYear(selectedYear),
        StorageService.getSetting("monthlyIncome", 0),
        StorageService.getSetting("savingsRate", 0),
        StorageService.getActiveSchedules(),
        StorageService.getIncomeSnapshotsForYear(selectedYear),
        StorageService.getSavingsSnapshotsForYear(selectedYear),
        StorageService.getSetting("incomeAmount", ""),
        StorageService.getSetting("incomeFrequency", "monthly"),
      ]);

      setIncomeRaw(incomeAmount as string);
      setIncomeFreq(incomeFrequency as string);

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
  }, [selectedYear, selectedMonth, expenses, reloadKey]);

  const handleIncomeSave = async ({
    income,
    frequency,
    monthlyIncome,
  }: {
    income: number;
    frequency: string;
    monthlyIncome: number;
  }) => {
    await StorageService.setIncomeSnapshot(
      selectedYear,
      selectedMonth + 1,
      monthlyIncome,
    );
    const now = new Date();
    const isCurrentOrFuture =
      selectedYear > now.getFullYear() ||
      (selectedYear === now.getFullYear() && selectedMonth >= now.getMonth());
    if (isCurrentOrFuture) {
      await Promise.all([
        StorageService.setSetting("incomeAmount", income),
        StorageService.setSetting("incomeFrequency", frequency),
        StorageService.setSetting("monthlyIncome", monthlyIncome),
      ]);
    }
    setReloadKey((k) => k + 1);
  };

  const handleSavingsRateSave = async (rate: number) => {
    await StorageService.setSavingsSnapshot(
      selectedYear,
      selectedMonth + 1,
      rate,
    );
    const now = new Date();
    const isCurrentOrFuture =
      selectedYear > now.getFullYear() ||
      (selectedYear === now.getFullYear() && selectedMonth >= now.getMonth());
    if (isCurrentOrFuture) {
      await StorageService.setSetting("savingsRate", rate);
    }
    setReloadKey((k) => k + 1);
  };

  const navigateToMonth = useCallback((year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  }, []);

  const prevMonth = () => {
    if (selectedMonth === 0) {
      navigateToMonth(selectedYear - 1, 11);
    } else {
      navigateToMonth(selectedYear, selectedMonth - 1);
    }
  };
  const nextMonth = () => {
    if (selectedMonth === 11) {
      navigateToMonth(selectedYear + 1, 0);
    } else {
      navigateToMonth(selectedYear, selectedMonth + 1);
    }
  };

  const selectedKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  const monthStrip = useMemo(() => {
    const months = [];
    const center = new Date(selectedYear, selectedMonth);
    for (let i = -6; i <= 6; i++) {
      const d = new Date(center);
      d.setMonth(d.getMonth() + i);
      months.push({ year: d.getFullYear(), month: d.getMonth(), offset: i });
    }
    return months;
  }, [selectedYear, selectedMonth]);

  const yearFirstIndices = useMemo(() => {
    const map = new Map<number, number>();
    monthStrip.forEach((m, i) => {
      if (!map.has(m.year)) map.set(m.year, i);
    });
    return map;
  }, [monthStrip]);

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );
  const resolveName = (exp: Expense) =>
    catMap[exp.categoryId as number]?.name ?? exp.category ?? "Uncategorized";

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

  const categoryRows = useMemo(() => {
    const totals: Record<string, number> = {};
    const counts: Record<string, number> = {};
    monthlyExpenses.forEach((e) => {
      const n = resolveName(e);
      totals[n] = (totals[n] || 0) + e.amount;
      counts[n] = (counts[n] || 0) + 1;
    });
    return Object.entries(totals)
      .map(([name, total]) => ({
        name,
        count: counts[name] || 0,
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [monthlyExpenses, catMap]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-theme-text tracking-tight">
          Dashboard
        </h1>
      </div>
      {/* Category filter chips */}
      {viewMode === "expenses" && categoryRows.length > 0 && false && (
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
                  : "category-chip-inactive",
              )}
            >
              All
            </button>
            {categoryRows.map(({ name, total }) => {
              const isSelected = selectedCategories.has(name);
              return (
                <button
                  key={name}
                  onClick={() => {
                    const next = new Set(selectedCategories);
                    if (next.has(name)) next.delete(name);
                    else next.add(name);
                    setSelectedCategories(next);
                  }}
                  className={cn(
                    "category-chip",
                    isSelected
                      ? "category-chip-active"
                      : "category-chip-inactive",
                  )}
                >
                  <span>{name}</span>
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
        </div>
      )}

      {/* Month strip — outside table, centered */}
      <div className="flex items-center justify-center">
        <div className="month-strip-scroll">
          <button
            onClick={prevMonth}
            className="month-nav-btn"
            aria-label="Previous month"
          >
            <svg
              className="w-4 h-4"
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

          {monthStrip.map(({ year, month }, index) => {
            const isSelected =
              year === selectedYear && month === selectedMonth;
            const isRealCurrent =
              `${year}-${String(month + 1).padStart(2, "0")}` ===
              currentMonthKey();
            const monthName = new Date(year, month).toLocaleString(
              "default",
              { month: "short" },
            );
            const isFirstOfYear = yearFirstIndices.get(year) === index;

            const handleClick = () => {
              if (!isSelected) {
                setSelectedYear(year);
                setSelectedMonth(month);
              }
            };

            return (
              <div key={`${year}-${month}`} className="month-strip-item">
                <span
                  className={cn(
                    "year-label",
                    !isFirstOfYear && "invisible",
                  )}
                >
                  {year}
                </span>
                <button
                  onClick={handleClick}
                  className={cn(
                    "month-pill",
                    isSelected && "month-pill-selected",
                    !isSelected && isRealCurrent && "month-pill-current",
                  )}
                  aria-label={`${monthName} ${year}`}
                  aria-current={isSelected ? "date" : undefined}
                >
                  <span>{monthName}</span>
                </button>
              </div>
            );
          })}

          <button
            onClick={nextMonth}
            className="month-nav-btn"
            aria-label="Next month"
          >
            <svg
              className="w-4 h-4"
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
      </div>

      {/* Expenses Table Card */}
      <div className="flex justify-center">
        <section className="rounded-xl bg-theme-surface shadow-sm p-4 md:p-5 space-y-4 w-full md:max-w-3xl">
        {/* Action buttons + tabs header */}
        <div className="space-y-3">
          {/* Action buttons row */}
          {viewMode === "expenses" && (
            <div className="flex justify-end items-center gap-1.5">
              {selectedCategories.size > 0 && (
                <button
                  onClick={() => setSelectedCategories(new Set())}
                  className="text-[0.6875rem] font-medium px-2 py-1 rounded-md bg-theme-background text-theme-text border border-theme-border hover:bg-theme-border transition-colors"
                >
                  Reset Filter
                </button>
              )}
              {manageMode && selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDeleteClick}
                  className="text-[0.6875rem] font-medium px-2 py-1 rounded-md bg-theme-danger text-white hover:opacity-90 transition-opacity"
                >
                  Delete {selectedIds.size}
                </button>
              )}
              <button
                onClick={toggleManageMode}
                aria-label={manageMode ? "Done" : "Manage"}
                aria-pressed={manageMode}
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
                  manageMode
                    ? "bg-theme-primary text-white"
                    : "text-theme-muted hover:text-theme-text hover:bg-theme-background",
                )}
              >
                {manageMode ? (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                )}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-theme-background rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("categories")}
                className={cn(
                  "dashboard-tab",
                  viewMode === "categories" && "dashboard-tab-active",
                )}
              >
                Categories
              </button>
              <button
                onClick={() => setViewMode("expenses")}
                className={cn(
                  "dashboard-tab",
                  viewMode === "expenses" && "dashboard-tab-active",
                )}
              >
                Expenses
              </button>
            </div>
            <p className="text-sm text-theme-muted">
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
            <button onClick={confirmDelete} className="confirm-delete-btn">
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

        {viewMode === "categories" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="table-header-cell text-left">Category</th>
                  <th className="table-header-cell text-right tabular-nums">
                    Transactions
                  </th>
                  <th className="table-header-cell text-right tabular-nums">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-12 text-center text-theme-muted"
                    >
                      No expenses yet. Hit{" "}
                      <strong className="text-theme-primary">+</strong> to add
                      one.
                    </td>
                  </tr>
                ) : (
                  categoryRows.map(({ name, count, total }) => (
                    <tr
                      key={name}
                      className="border-b border-theme-muted/10 transition-colors duration-150 hover:bg-theme-primary/[0.03]"
                    >
                      <td className="px-3 py-2.5 text-theme-text whitespace-nowrap font-medium">
                        {name}
                      </td>
                      <td className="px-3 py-2.5 text-right text-theme-muted tabular-nums">
                        {count}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <button
                          onClick={() => {
                            setSelectedCategories(new Set([name]));
                            setViewMode("expenses");
                          }}
                          className={cn(
                            "font-semibold hover:underline",
                            getNumberColorClass(total),
                          )}
                        >
                          {formatAmount(total)}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {financialSummary &&
                  financialSummary.fixedExpensesTotal > 0 && (
                    <>
                      <tr>
                        <td
                          colSpan={3}
                          className="table-header-cell whitespace-nowrap"
                        >
                          Fixed Expenses
                        </td>
                      </tr>
                      {financialSummary.fixedExpenses.map((fe) => (
                        <tr key={fe.id}>
                          <td className="px-3 py-2.5 text-theme-text whitespace-nowrap">
                            {fe.name}
                          </td>
                          <td className="px-3 py-2.5 text-right text-theme-muted tabular-nums">
                            —
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium text-theme-text">
                            {formatAmount(fe.amount)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                {financialSummary && (
                  <>
                    <tr>
                      <td
                        colSpan={3}
                        className="table-header-cell whitespace-nowrap"
                      >
                        Budget Summary
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 text-theme-text whitespace-nowrap font-medium inline-flex items-center gap-1">
                        Income
                        <svg
                          className="w-3 h-3 text-theme-muted"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </td>
                      <td className="px-3 py-2.5 text-right text-theme-muted tabular-nums">
                        —
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <button
                          onClick={openIncomeModal}
                          className="font-semibold hover:underline text-theme-text"
                        >
                          {formatAmount(financialSummary.income)}
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 text-theme-text whitespace-nowrap font-medium inline-flex items-center gap-1">
                        Auto Savings
                        <svg
                          className="w-3 h-3 text-theme-muted"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </td>
                      <td className="px-3 py-2.5 text-right text-theme-muted tabular-nums">
                        —
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <button
                          onClick={openSavingsModal}
                          className="font-semibold hover:underline text-theme-text"
                        >
                          {formatAmount(financialSummary.autoSavings)}
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 text-theme-text whitespace-nowrap font-medium">
                        Remaining
                      </td>
                      <td className="px-3 py-2.5 text-right text-theme-muted tabular-nums">
                        —
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-right tabular-nums font-semibold",
                          getNumberColorClass(financialSummary.remaining),
                        )}
                      >
                        {formatAmount(financialSummary.remaining)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 text-theme-text whitespace-nowrap font-medium">
                        Total Savings
                      </td>
                      <td className="px-3 py-2.5 text-right text-theme-muted tabular-nums">
                        —
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-right tabular-nums font-semibold",
                          getNumberColorClass(
                            financialSummary.autoSavings +
                              financialSummary.remaining,
                          ),
                        )}
                      >
                        {formatAmount(
                          financialSummary.autoSavings +
                            financialSummary.remaining,
                        )}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        ) : (
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
        )}
        </section>
      </div>

      {/* Income edit modal */}
      <Modal
        isOpen={showIncomeModal}
        onClose={closeIncomeModal}
        title="Edit Income"
        size="sm"
      >
        <form onSubmit={submitIncome} className="space-y-4">
          {incomeError && (
            <p className="text-theme-danger text-xs">{incomeError}</p>
          )}
          <div className="flex gap-2">
            <input
              type="number"
              value={incomeDraft}
              onChange={(e) => setIncomeDraft(e.target.value)}
              placeholder="Amount"
              min="0.01"
              step="0.01"
              autoFocus
              className="input-theme px-3 py-2 text-sm flex-1"
            />
            <select
              value={incomeFreqDraft}
              onChange={(e) => setIncomeFreqDraft(e.target.value)}
              className="input-theme px-3 py-2 text-sm"
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="summary-save-btn">
              Save
            </button>
            <button
              type="button"
              onClick={closeIncomeModal}
              className="summary-cancel-btn rounded-theme-small"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Savings rate edit modal */}
      <Modal
        isOpen={showSavingsModal}
        onClose={closeSavingsModal}
        title="Edit Savings Rate"
        size="sm"
      >
        <form onSubmit={submitSavings} className="space-y-4">
          {savingsError && (
            <p className="text-theme-danger text-xs">{savingsError}</p>
          )}
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={savingsDraft}
              onChange={(e) => setSavingsDraft(e.target.value)}
              placeholder="e.g. 20"
              min="0"
              max="100"
              step="0.1"
              autoFocus
              className="input-theme px-3 py-2 text-sm w-28"
            />
            <span className="text-sm text-theme-muted">%</span>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="summary-save-btn">
              Save
            </button>
            <button
              type="button"
              onClick={closeSavingsModal}
              className="summary-cancel-btn rounded-theme-small"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
