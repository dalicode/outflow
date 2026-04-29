import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "../../utils/cn";
import "./dashboard.css";
import Modal from "../../components/ui/Modal";
import { StorageService } from "../../services/storageService";
import { useSettings } from "../../context/settingsContext";
import { getMonthlyFinancialSummary } from "../../utils/financeEngine";
import {
  getMonthKeys,
  computeMultiMonthCategoryRows,
  computeMultiMonthFixedRows,
} from "../../utils/dashboardHelpers";
import { getSavingsGradientColor } from "../../utils/colorHelpers";
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
  const { formatAmount, getNumberColorClass, formatDate } = useSettings();
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

  const [editingMonthIndex, setEditingMonthIndex] = useState<number>(0);

  const [monthSpan, setMonthSpan] = useState<1 | 2 | 3 | 6 | 12>(1);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1920,
  );

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const SPAN_THRESHOLDS: Record<number, number> = {
    1: 640,
    2: 768,
    3: 896,
    6: 1280,
    12: 1920,
  };

  const showSpanSelector = viewportWidth >= SPAN_THRESHOLDS[1];

  const maxAvailableSpan = useMemo(() => {
    const allowed = [1, 2, 3, 6, 12].filter(
      (n) => viewportWidth >= SPAN_THRESHOLDS[n],
    );
    return allowed.length > 0 ? allowed[allowed.length - 1] : 1;
  }, [viewportWidth, SPAN_THRESHOLDS]);

  useEffect(() => {
    const target = showSpanSelector ? maxAvailableSpan : 1;
    if (monthSpan > target) {
      setMonthSpan(target as 1 | 2 | 3 | 6 | 12);
    }
  }, [monthSpan, maxAvailableSpan, showSpanSelector]);
  const [showGrandTotal, setShowGrandTotal] = useState(false);
  const [monthSummaries, setMonthSummaries] = useState<MonthlySummary[]>([]);
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(
    null,
  );
  const [drilldownMonthIndex, setDrilldownMonthIndex] = useState<number>(0);

  const FREQUENCIES = ["monthly", "biweekly", "weekly"] as const;
  const MULTIPLIERS: Record<string, number> = {
    monthly: 1,
    biweekly: 2.17,
    weekly: 4.33,
  };

  const openIncomeModal = (monthIndex: number = 0) => {
    const summary = monthSummaries[monthIndex];
    setEditingMonthIndex(monthIndex);
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
    handleIncomeSave(
      {
        income: parsed,
        frequency: incomeFreqDraft,
        monthlyIncome: parsed * MULTIPLIERS[incomeFreqDraft],
      },
      editingMonthIndex,
    );
    setShowIncomeModal(false);
  };

  const openSavingsModal = (monthIndex: number = 0) => {
    const summary = monthSummaries[monthIndex];
    setEditingMonthIndex(monthIndex);
    setSavingsDraft(String(summary?.savingsRate ?? 0));
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
    handleSavingsRateSave(n, editingMonthIndex);
    setShowSavingsModal(false);
  };

  useEffect(() => {
    const loadData = async () => {
      const now = new Date();
      const monthKeys = getMonthKeys(selectedYear, selectedMonth, monthSpan);

      // Determine which years we need snapshots for
      const neededYears = Array.from(new Set(monthKeys.map((m) => m.year)));

      const [
        allFixed,
        globalIncome,
        globalRate,
        schedules,
        incomeAmount,
        incomeFrequency,
      ] = await Promise.all([
        StorageService.getFixedExpenses(),
        StorageService.getSetting("monthlyIncome", 0),
        StorageService.getSetting("savingsRate", 0),
        StorageService.getActiveSchedules(),
        StorageService.getSetting("incomeAmount", ""),
        StorageService.getSetting("incomeFrequency", "monthly"),
      ]);

      setIncomeRaw(incomeAmount as string);
      setIncomeFreq(incomeFrequency as string);

      // Load snapshots for all needed years
      const allSnapshotsByYear: Record<
        number,
        Awaited<ReturnType<typeof StorageService.getSnapshotsForYear>>
      > = {};
      const incomeSnapsByYear: Record<
        number,
        Awaited<ReturnType<typeof StorageService.getIncomeSnapshotsForYear>>
      > = {};
      const savingsSnapsByYear: Record<
        number,
        Awaited<ReturnType<typeof StorageService.getSavingsSnapshotsForYear>>
      > = {};

      await Promise.all(
        neededYears.map(async (year) => {
          const [snaps, incSnaps, savSnaps] = await Promise.all([
            StorageService.getSnapshotsForYear(year),
            StorageService.getIncomeSnapshotsForYear(year),
            StorageService.getSavingsSnapshotsForYear(year),
          ]);
          allSnapshotsByYear[year] = snaps;
          incomeSnapsByYear[year] = incSnaps;
          savingsSnapsByYear[year] = savSnaps;
        }),
      );

      // Compute summary for each month in the span
      const summaries: MonthlySummary[] = monthKeys.map((mk) => {
        const isCurrentOrFuture =
          mk.year > now.getFullYear() ||
          (mk.year === now.getFullYear() && mk.month >= now.getMonth());

        const allSnapshots = allSnapshotsByYear[mk.year] || [];
        let monthSnapshots;
        if (isCurrentOrFuture) {
          const active = allFixed.filter((f) => f.isArchived !== true);
          monthSnapshots = active.map((f) => ({
            fixedExpenseId: f.id as number,
            year: mk.year,
            month: mk.month + 1,
            amountSnapshot: f.amount,
            nameSnapshot: f.name,
          }));
        } else {
          monthSnapshots = allSnapshots.filter((s) => s.month === mk.month + 1);
        }

        const data = {
          expenses,
          snapshots: monthSnapshots,
          fixedExpenses: allFixed,
          globalIncome: globalIncome as number,
          globalSavingsRate: globalRate as number,
          schedules,
          incomeSnapshots: incomeSnapsByYear[mk.year] || [],
          savingsSnapshots: savingsSnapsByYear[mk.year] || [],
        };

        return getMonthlyFinancialSummary(mk.year, mk.month, data);
      });

      setMonthSummaries(summaries);
      setFinancialSummary(summaries[0]);
    };
    loadData();
  }, [selectedYear, selectedMonth, expenses, reloadKey, monthSpan]);

  const handleIncomeSave = async (
    {
      income,
      frequency,
      monthlyIncome,
    }: {
      income: number;
      frequency: string;
      monthlyIncome: number;
    },
    monthIndex: number = 0,
  ) => {
    const mk = monthKeys[monthIndex];
    await StorageService.setIncomeSnapshot(
      mk.year,
      mk.month + 1,
      monthlyIncome,
    );
    const now = new Date();
    const isCurrentOrFuture =
      mk.year > now.getFullYear() ||
      (mk.year === now.getFullYear() && mk.month >= now.getMonth());
    if (isCurrentOrFuture) {
      await Promise.all([
        StorageService.setSetting("incomeAmount", income),
        StorageService.setSetting("incomeFrequency", frequency),
        StorageService.setSetting("monthlyIncome", monthlyIncome),
      ]);
    }
    setReloadKey((k) => k + 1);
  };

  const handleSavingsRateSave = async (
    rate: number,
    monthIndex: number = 0,
  ) => {
    const mk = monthKeys[monthIndex];
    await StorageService.setSavingsSnapshot(mk.year, mk.month + 1, rate);
    const now = new Date();
    const isCurrentOrFuture =
      mk.year > now.getFullYear() ||
      (mk.year === now.getFullYear() && mk.month >= now.getMonth());
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
    const baseHalf = monthSpan >= 12 ? 12 : monthSpan >= 6 ? 9 : 6;
    const half =
      viewportWidth < 640
        ? Math.min(baseHalf, 4)
        : viewportWidth < 1024
          ? Math.min(baseHalf, 6)
          : baseHalf;
    for (let i = -half; i <= half; i++) {
      const d = new Date(center);
      d.setMonth(d.getMonth() + i);
      months.push({ year: d.getFullYear(), month: d.getMonth(), offset: i });
    }
    return months;
  }, [selectedYear, selectedMonth, monthSpan, viewportWidth]);

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

  const monthKeys = useMemo(
    () => getMonthKeys(selectedYear, selectedMonth, monthSpan),
    [selectedYear, selectedMonth, monthSpan],
  );

  // For the expenses tab: all expenses across the selected month span
  const spanExpenses = useMemo(() => {
    const keys = new Set(monthKeys.map((m) => m.key));
    return expenses
      .filter((e) => keys.has(e.date.slice(0, 7)))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses, monthKeys]);

  const filtered = useMemo(
    () =>
      selectedCategories.size === 0
        ? spanExpenses
        : spanExpenses.filter((e) => selectedCategories.has(resolveName(e))),
    [spanExpenses, selectedCategories, resolveName],
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

  const multiCategoryRows = useMemo(
    () => computeMultiMonthCategoryRows(expenses, monthKeys, resolveName),
    [expenses, monthKeys, resolveName],
  );

  const multiFixedRows = useMemo(
    () => computeMultiMonthFixedRows(monthSummaries),
    [monthSummaries],
  );

  const handleCategoryClick = useCallback(
    (name: string, monthIndex: number) => {
      if (drilldownCategory === name && drilldownMonthIndex === monthIndex) {
        setDrilldownCategory(null);
      } else {
        setDrilldownCategory(name);
        setDrilldownMonthIndex(monthIndex);
      }
    },
    [drilldownCategory, drilldownMonthIndex],
  );

  const drilldownExpenses = useMemo(() => {
    if (!drilldownCategory) return [];
    const mk = monthKeys[drilldownMonthIndex];
    return expenses
      .filter((e) => {
        const matchesMonth = e.date.startsWith(mk.key);
        const matchesCategory = resolveName(e) === drilldownCategory;
        return matchesMonth && matchesCategory;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [
    drilldownCategory,
    drilldownMonthIndex,
    expenses,
    monthKeys,
    resolveName,
  ]);

  const spanVariableTotal = useMemo(
    () => monthSummaries.reduce((s, m) => s + m.variableExpenses, 0),
    [monthSummaries],
  );

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
    <main
      className={cn(
        "mx-auto px-4 py-6 space-y-6",
        monthSpan === 12 ? "max-w-none" : "max-w-7xl",
      )}
    >
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

      {showSpanSelector && (
        <div className="flex justify-center">
          <div className="flex gap-1 bg-theme-background rounded-lg p-0.5">
            {[1, 2, 3, 6, 12]
              .filter((n) => viewportWidth >= SPAN_THRESHOLDS[n])
              .map((n) => (
                <button
                  key={n}
                  onClick={() =>
                    setMonthSpan(n as 1 | 2 | 3 | 6 | 12)
                  }
                  className={cn(
                    "dashboard-tab",
                    monthSpan === n && "dashboard-tab-active",
                  )}
                >
                  {n}M
                </button>
              ))}
            {monthSpan > 1 && (
              <button
                onClick={() => setShowGrandTotal((prev) => !prev)}
                className={cn(
                  "dashboard-tab",
                  showGrandTotal && "dashboard-tab-active",
                )}
              >
                Total
              </button>
            )}
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
            const isSelected = year === selectedYear && month === selectedMonth;
            const pillKey = `${year}-${String(month + 1).padStart(2, "0")}`;
            const isRealCurrent = pillKey === currentMonthKey();
            const isInSpan =
              monthSpan > 1 && monthKeys.some((mk) => mk.key === pillKey);
            const monthName = new Date(year, month).toLocaleString("default", {
              month: "short",
            });
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
                  className={cn("year-label", !isFirstOfYear && "invisible")}
                >
                  {year}
                </span>
                <button
                  onClick={handleClick}
                  className={cn(
                    "month-pill",
                    (isSelected || isInSpan) && "month-pill-selected",
                    !isSelected &&
                      !isInSpan &&
                      isRealCurrent &&
                      "month-pill-current",
                  )}
                  aria-label={`${monthName} ${year}`}
                  aria-current={isSelected ? "date" : undefined}
                >
                  <span className={cn(!isSelected && isInSpan && "opacity-70")}>
                    {monthName}
                  </span>
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
        <section
          className={cn(
            "rounded-xl bg-theme-surface shadow-sm p-4 md:p-5 space-y-4 w-full",
            monthSpan <= 3 && "md:max-w-3xl",
            monthSpan === 6 && "md:max-w-6xl",
            monthSpan === 12 && "md:max-w-none",
          )}
        >
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
                {spanExpenses.length} transaction
                {spanExpenses.length !== 1 ? "s" : ""} ·{" "}
                <span
                  className={getNumberColorClass(spanVariableTotal)}
                >
                  {formatAmount(spanVariableTotal)}
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
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="table-header-cell text-left">Category</th>
                      {monthSpan > 1 ? (
                        <>
                          <th className="table-header-cell text-right tabular-nums">
                            Transactions
                          </th>
                          {[...monthKeys].reverse().map((mk, displayIdx) => (
                            <th
                              key={mk.key}
                              className={cn(
                                "table-header-cell text-right tabular-nums",
                                displayIdx === 0 && "border-l border-theme-border",
                              )}
                            >
                              {mk.name}
                            </th>
                          ))}
                          {showGrandTotal && (
                            <th className="table-header-cell text-right tabular-nums">
                              Total
                            </th>
                          )}
                        </>
                      ) : (
                        <>
                          <th className="table-header-cell text-right tabular-nums">
                            Transactions
                          </th>
                          <th className="table-header-cell text-right tabular-nums">
                            Amount
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {multiCategoryRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={
                            monthSpan > 1
                              ? 2 + monthSpan + (showGrandTotal ? 1 : 0)
                              : 3
                          }
                          className="px-3 py-12 text-center text-theme-muted"
                        >
                          No expenses yet. Hit{" "}
                          <strong className="text-theme-primary">+</strong> to
                          add one.
                        </td>
                      </tr>
                    ) : (
                      multiCategoryRows.map(
                        ({ name, totalTransactions, monthlyAmounts }) => (
                          <tr
                            key={name}
                            className="border-b border-theme-muted/10 transition-colors duration-150 hover:bg-theme-primary/[0.03]"
                          >
                            <td className="px-3 py-1.5 text-theme-text whitespace-nowrap font-medium">
                              {name}
                            </td>
                            {monthSpan > 1 ? (
                              <>
                                <td className="px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                  {totalTransactions}
                                </td>
                                {[...monthlyAmounts]
                                  .reverse()
                                  .map((amount, displayIdx) => {
                                    const dataIdx =
                                      monthKeys.length - 1 - displayIdx;
                                    return (
                                      <td
                                        key={displayIdx}
                                        className={cn(
                                          "px-3 py-1.5 text-right tabular-nums",
                                          displayIdx === 0 && "border-l border-theme-border",
                                        )}
                                      >
                                        {amount !== 0 ? (
                                          <button
                                            onClick={() =>
                                              handleCategoryClick(name, dataIdx)
                                            }
                                            className={cn(
                                              "font-semibold hover:underline",
                                              getNumberColorClass(amount),
                                            )}
                                          >
                                            {formatAmount(amount)}
                                          </button>
                                        ) : (
                                          <span className="text-theme-muted">
                                            —
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                {showGrandTotal && (
                                  <td
                                    className={cn(
                                      "px-3 py-1.5 text-right tabular-nums font-semibold",
                                      getNumberColorClass(
                                        monthlyAmounts.reduce((s, v) => s + v, 0),
                                      ),
                                    )}
                                  >
                                    {formatAmount(
                                      monthlyAmounts.reduce((s, v) => s + v, 0),
                                    )}
                                  </td>
                                )}
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                  {totalTransactions}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums">
                                  {monthlyAmounts[0] !== 0 ? (
                                    <button
                                      onClick={() =>
                                        handleCategoryClick(name, 0)
                                      }
                                      className={cn(
                                        "font-semibold hover:underline",
                                        getNumberColorClass(monthlyAmounts[0]),
                                      )}
                                    >
                                      {formatAmount(monthlyAmounts[0])}
                                    </button>
                                  ) : (
                                    <span className="text-theme-muted">—</span>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        ),
                      )
                    )}
                    {multiFixedRows.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={
                              monthSpan > 1
                                ? 2 + monthSpan + (showGrandTotal ? 1 : 0)
                                : 3
                            }
                            className="table-header-cell whitespace-nowrap"
                          >
                            Fixed Expenses
                          </td>
                        </tr>
                        {multiFixedRows.map((fe) => {
                          const fixedGrandTotal = fe.monthlyAmounts.reduce(
                            (s, v) => s + (v ?? 0),
                            0,
                          );
                          return (
                            <tr key={fe.id}>
                              <td className="px-3 py-1.5 text-theme-text whitespace-nowrap">
                                {fe.name}
                              </td>
                              {monthSpan > 1 ? (
                                <>
                                  <td className="px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                    —
                                  </td>
                                  {[...fe.monthlyAmounts]
                                    .reverse()
                                    .map((amount, displayIdx) => (
                                      <td
                                        key={displayIdx}
                                        className={cn(
                                          "px-3 py-1.5 text-right tabular-nums font-medium text-theme-text",
                                          displayIdx === 0 && "border-l border-theme-border",
                                        )}
                                      >
                                        {amount !== null ? (
                                          formatAmount(amount)
                                        ) : (
                                          <span className="text-theme-muted">
                                            —
                                          </span>
                                        )}
                                      </td>
                                    ))}
                                  {showGrandTotal && (
                                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-theme-text">
                                      {formatAmount(fixedGrandTotal)}
                                    </td>
                                  )}
                                </>
                              ) : (
                                <>
                                  <td className="px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                    —
                                  </td>
                                  <td className="px-3 py-1.5 text-right tabular-nums font-medium text-theme-text">
                                    {fe.monthlyAmounts[0] !== null
                                      ? formatAmount(fe.monthlyAmounts[0])
                                      : "—"}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </>
                    )}
                    {monthSummaries.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={
                              monthSpan > 1
                                ? 2 + monthSpan + (showGrandTotal ? 1 : 0)
                                : 3
                            }
                            className="table-header-cell whitespace-nowrap"
                          >
                            Budget Summary
                          </td>
                        </tr>
                        {/* Income */}
                        <tr>
                          <td className="px-3 py-1.5 text-theme-text whitespace-nowrap font-medium inline-flex items-center gap-1">
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
                          {monthSpan > 1 ? (
                            <>
                              <td className="px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                —
                              </td>
                              {[...monthSummaries]
                                .reverse()
                                .map((summary, displayIdx) => {
                                  const dataIdx =
                                    monthSummaries.length - 1 - displayIdx;
                                  return (
                                    <td
                                      key={displayIdx}
                                      className={cn(
                                        "px-3 py-1.5 text-right tabular-nums",
                                        displayIdx === 0 && "border-l border-theme-border",
                                      )}
                                    >
                                      <button
                                        onClick={() => openIncomeModal(dataIdx)}
                                        className="font-semibold hover:underline text-theme-text"
                                      >
                                        {formatAmount(summary.income)}
                                      </button>
                                    </td>
                                  );
                                })}
                              {showGrandTotal && (
                                <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-theme-text">
                                  {formatAmount(
                                    monthSummaries.reduce(
                                      (s, m) => s + m.income,
                                      0,
                                    ),
                                  )}
                                </td>
                              )}
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                —
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                <button
                                  onClick={() => openIncomeModal(0)}
                                  className="font-semibold hover:underline text-theme-text"
                                >
                                  {formatAmount(monthSummaries[0].income)}
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                        {/* Auto Savings */}
                        <tr>
                          <td className="px-3 py-1.5 text-theme-text whitespace-nowrap font-medium inline-flex items-center gap-1">
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
                          {monthSpan > 1 ? (
                            <>
                              <td className="px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                —
                              </td>
                              {[...monthSummaries]
                                .reverse()
                                .map((summary, displayIdx) => {
                                  const dataIdx =
                                    monthSummaries.length - 1 - displayIdx;
                                  return (
                                    <td
                                      key={displayIdx}
                                      className={cn(
                                        "px-3 py-1.5 text-right tabular-nums",
                                        displayIdx === 0 && "border-l border-theme-border",
                                      )}
                                    >
                                      <button
                                        onClick={() =>
                                          openSavingsModal(dataIdx)
                                        }
                                        className="font-semibold hover:underline text-theme-text"
                                      >
                                        {formatAmount(summary.autoSavings)}
                                      </button>
                                    </td>
                                  );
                                })}
                              {showGrandTotal && (
                                <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-theme-text">
                                  {formatAmount(
                                    monthSummaries.reduce(
                                      (s, m) => s + m.autoSavings,
                                      0,
                                    ),
                                  )}
                                </td>
                              )}
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                —
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                <button
                                  onClick={() => openSavingsModal(0)}
                                  className="font-semibold hover:underline text-theme-text"
                                >
                                  {formatAmount(monthSummaries[0].autoSavings)}
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                        {/* Remaining */}
                        <tr>
                          <td className="px-3 py-1.5 text-theme-text whitespace-nowrap font-medium">
                            Remaining
                          </td>
                          {monthSpan > 1 ? (
                            <>
                              <td className="px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                —
                              </td>
                              {[...monthSummaries]
                                .reverse()
                                .map((summary, displayIdx) => {
                                  const v = summary.remaining;
                                  return (
                                    <td
                                      key={displayIdx}
                                      className={cn(
                                        "px-3 py-1.5 text-right tabular-nums font-semibold",
                                        v > 0
                                          ? "text-theme-success"
                                          : v < 0
                                            ? "text-theme-danger"
                                            : "text-theme-text",
                                        displayIdx === 0 &&
                                          "border-l border-theme-border",
                                      )}
                                    >
                                      {formatAmount(v)}
                                    </td>
                                  );
                                })}
                              {showGrandTotal && (
                                <td
                                  className={cn(
                                    "px-3 py-1.5 text-right tabular-nums font-semibold",
                                    (() => {
                                      const v = monthSummaries.reduce(
                                        (s, m) => s + m.remaining,
                                        0,
                                      );
                                      return v > 0
                                        ? "text-theme-success"
                                        : v < 0
                                          ? "text-theme-danger"
                                          : "text-theme-text";
                                    })(),
                                  )}
                                >
                                  {formatAmount(
                                    monthSummaries.reduce(
                                      (s, m) => s + m.remaining,
                                      0,
                                    ),
                                  )}
                                </td>
                              )}
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                —
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-1.5 text-right tabular-nums font-semibold",
                                  (() => {
                                    const v = monthSummaries[0].remaining;
                                    return v > 0
                                      ? "text-theme-success"
                                      : v < 0
                                        ? "text-theme-danger"
                                        : "text-theme-text";
                                  })(),
                                )}
                              >
                                {formatAmount(monthSummaries[0].remaining)}
                              </td>
                            </>
                          )}
                        </tr>
                        {/* Total Savings */}
                        <tr>
                          <td className="px-3 py-1.5 text-theme-text whitespace-nowrap font-medium">
                            Total Savings
                          </td>
                          {monthSpan > 1 ? (
                            <>
                              <td className="px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                —
                              </td>
                              {[...monthSummaries]
                                .reverse()
                                .map((summary, displayIdx) => {
                                  const totalSavings =
                                    summary.autoSavings + summary.remaining;
                                  const ratioPct =
                                    summary.income > 0
                                      ? (totalSavings / summary.income) * 100
                                      : 0;
                                  const color = getSavingsGradientColor(
                                    ratioPct,
                                    summary.savingsRate,
                                  );
                                  return (
                                    <td
                                      key={displayIdx}
                                      className={cn(
                                        "px-3 py-1.5 text-right tabular-nums font-semibold",
                                        displayIdx === 0 &&
                                          "border-l border-theme-border",
                                      )}
                                      style={{ color }}
                                    >
                                      {formatAmount(totalSavings)}
                                    </td>
                                  );
                                })}
                              {showGrandTotal && (
                                <td
                                  className="px-3 py-1.5 text-right tabular-nums font-semibold"
                                  style={{
                                    color: (() => {
                                      const grandTotal = monthSummaries.reduce(
                                        (s, m) =>
                                          s + m.autoSavings + m.remaining,
                                        0,
                                      );
                                      const totalIncome = monthSummaries.reduce(
                                        (s, m) => s + m.income,
                                        0,
                                      );
                                      const avgRate =
                                        monthSummaries.reduce(
                                          (s, m) => s + m.savingsRate,
                                          0,
                                        ) / monthSummaries.length;
                                      const ratioPct =
                                        totalIncome > 0
                                          ? (grandTotal / totalIncome) * 100
                                          : 0;
                                      return getSavingsGradientColor(
                                        ratioPct,
                                        avgRate,
                                      );
                                    })(),
                                  }}
                                >
                                  {formatAmount(
                                    monthSummaries.reduce(
                                      (s, m) =>
                                        s + m.autoSavings + m.remaining,
                                      0,
                                    ),
                                  )}
                                </td>
                              )}
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                —
                              </td>
                              <td
                                className="px-3 py-1.5 text-right tabular-nums font-semibold"
                                style={{
                                  color: (() => {
                                    const summary = monthSummaries[0];
                                    const totalSavings =
                                      summary.autoSavings + summary.remaining;
                                    const ratioPct =
                                      summary.income > 0
                                        ? (totalSavings / summary.income) * 100
                                        : 0;
                                    return getSavingsGradientColor(
                                      ratioPct,
                                      summary.savingsRate,
                                    );
                                  })(),
                                }}
                              >
                                {formatAmount(
                                  monthSummaries[0].autoSavings +
                                    monthSummaries[0].remaining,
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Drilldown */}
              {drilldownCategory && drilldownExpenses.length > 0 && (
                <div className="space-y-2 border-t border-theme-border pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-theme-text">
                      {drilldownCategory} —{" "}
                      {monthKeys[drilldownMonthIndex].name}{" "}
                      {monthKeys[drilldownMonthIndex].year}
                    </h3>
                    <button
                      onClick={() => setDrilldownCategory(null)}
                      className="text-xs font-medium text-theme-muted hover:text-theme-text transition-colors"
                    >
                      Close
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-separate border-spacing-0">
                      <thead>
                        <tr>
                          <th className="table-header-cell text-left">Date</th>
                          <th className="table-header-cell text-left">
                            Description
                          </th>
                          <th className="table-header-cell text-right tabular-nums">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {drilldownExpenses.map((exp) => (
                          <tr
                            key={exp.id}
                            className="border-b border-theme-muted/10"
                          >
                            <td className="px-3 py-1 text-theme-text whitespace-nowrap">
                              {formatDate(exp.date)}
                            </td>
                            <td className="px-3 py-1 text-theme-text max-w-[200px] truncate">
                              {exp.description || (
                                <span className="text-theme-muted">—</span>
                              )}
                            </td>
                            <td
                              className={cn(
                                "px-3 py-1 text-right tabular-nums font-semibold",
                                getNumberColorClass(exp.amount),
                              )}
                            >
                              {formatAmount(exp.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
        title={`Edit Income — ${monthKeys[editingMonthIndex]?.name ?? ""} ${monthKeys[editingMonthIndex]?.year ?? ""}`}
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
        title={`Edit Savings Rate — ${monthKeys[editingMonthIndex]?.name ?? ""} ${monthKeys[editingMonthIndex]?.year ?? ""}`}
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
