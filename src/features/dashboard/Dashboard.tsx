import { useState, useMemo, useCallback } from "react";
import { cn } from "../../utils/cn";
import "./dashboard.css";
import Modal from "../../components/ui/Modal";
import MobileSelectionBanner from "../../components/ui/MobileSelectionBanner";
import { useSettings } from "../../context/settingsContext";
import { useDashboard } from "../../hooks/useDashboard";
import { getSavingsGradientColor } from "../../utils/colorHelpers";
import {
  computeMultiMonthCategoryRows,
  computeMultiMonthFixedRows,
} from "../../utils/dashboardHelpers";
import DashboardHeader from "./DashboardHeader";
import MonthSpanSelector from "./MonthSpanSelector";
import DashboardMonthStrip from "./DashboardMonthStrip";
import DashboardViewTabs from "./DashboardViewTabs";
import ExpensesView from "./ExpensesView";
import FilterModal from "./FilterModal";
import { DASHBOARD_VIEWS } from "./constants";
import type { Expense, Category } from "../../types";

interface DashboardProps {
  expenses: Expense[];
  categories: Category[];
  onUpdate: (id: number, changes: Partial<Expense>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onBulkDelete: (ids: number[]) => Promise<void>;
  onSelectionChange?: (active: boolean) => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export default function Dashboard({
  expenses,
  categories,
  onUpdate,
  onDelete,
  onBulkDelete,
  onSelectionChange,
  onScroll,
}: DashboardProps) {
  const { formatAmount, getNumberColorClass, formatDate } = useSettings();
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  // ── Hooks ──
  const dash = useDashboard(expenses, categories, onBulkDelete, onSelectionChange);

  // ── Derived values ──
  const isMobile = dash.viewportWidth < 640;

  const multiCategoryRows = useMemo(
    () => computeMultiMonthCategoryRows(dash.filteredExpenses, dash.monthKeys, dash.getExpenseCategoryName),
    [dash.filteredExpenses, dash.monthKeys, dash.getExpenseCategoryName],
  );

  const multiFixedRows = useMemo(
    () => computeMultiMonthFixedRows(dash.monthSummaries),
    [dash.monthSummaries],
  );

  const drilldownExpenses = useMemo(() => {
    if (!dash.drilldownCategory) return [];
    const mk = dash.monthKeys[dash.drilldownCategoryMonthIndex];
    return dash.filteredExpenses
      .filter((e) => {
        const matchesMonth = e.date.startsWith(mk.key);
        const matchesCategory = dash.getExpenseCategoryName(e) === dash.drilldownCategory;
        return matchesMonth && matchesCategory;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [dash.drilldownCategory, dash.drilldownCategoryMonthIndex, dash.filteredExpenses, dash.monthKeys, dash.getExpenseCategoryName]);

  const groupedDrilldownExpenses = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    drilldownExpenses.forEach((exp) => {
      if (!groups[exp.date]) groups[exp.date] = [];
      groups[exp.date].push(exp);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [drilldownExpenses]);

  const spanVariableTotal = useMemo(
    () => dash.monthSummaries.reduce((s, m) => s + m.variableExpenses, 0),
    [dash.monthSummaries],
  );

  const triggerMobileEdit = useCallback(() => {
    const id = Array.from(dash.selectedIds)[0];
    if (id != null) {
      dash.setMobileEditTrigger(id);
      requestAnimationFrame(() => dash.setMobileEditTrigger(null));
    }
  }, [dash.selectedIds, dash.setMobileEditTrigger]);

  // ── Income / Savings modal helpers ──
  const modalMonthKey = dash.monthKeys[dash.modalTargetMonthIndex];

  return (
    <div className="flex flex-col h-full">
      {/* ── Fixed header ── */}
      <div className="shrink-0">
        <div
          className={cn(
            "mx-auto px-4 py-6 space-y-6",
            dash.monthSpan === 12 ? "max-w-none" : "max-w-7xl",
          )}
        >
          <DashboardHeader
            financialSummary={dash.financialSummary}
            daysLeft={dash.daysLeft}
          />
          <MonthSpanSelector
            monthSpan={dash.monthSpan}
            showGrandTotal={dash.showGrandTotal}
            viewportWidth={dash.viewportWidth}
            onSpanChange={dash.setMonthSpan}
            onToggleGrandTotal={() => dash.setShowGrandTotal((p) => !p)}
          />
          <DashboardMonthStrip
            selectedYear={dash.selectedYear}
            selectedMonth={dash.selectedMonth}
            monthSpan={dash.monthSpan}
            stripMaxVisible={dash.stripMaxVisible}
            monthStrip={dash.monthStrip}
            yearFirstIndices={dash.yearFirstIndices}
            monthKeys={dash.monthKeys}
            onSelectMonth={dash.navigateToMonth}
            onJumpBack={dash.jumpBackMonths}
            onStepBack={dash.goToPreviousMonth}
            onStepForward={dash.goToNextMonth}
            onJumpForward={dash.jumpToCurrentMonth}
            disableJumpForward={dash.isAtCurrentMonth}
          />
        </div>
      </div>

      {/* ── Tabs ── */}
      <DashboardViewTabs
        viewMode={dash.viewMode}
        activeFilterCount={dash.activeFilterCount}
        hasCategoryFilter={dash.selectedCategories.size > 0}
        onSwitchToCategories={dash.switchToCategories}
        onSwitchToExpenses={dash.switchToExpenses}
        onOpenFilters={() => dash.setIsFilterModalOpen(true)}
        onResetCategoryFilter={() => dash.setSelectedCategories(new Set())}
        monthSpan={dash.monthSpan}
      />

      {/* ── Scrollable content ── */}
      <div
        ref={dash.scrollableRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        onScroll={onScroll}
      >
        <div
          className={cn(
            "mx-auto px-4 pb-24",
            dash.monthSpan === 12 ? "max-w-none" : "max-w-7xl",
          )}
        >
          <div
            className={cn(
              "w-full mx-auto",
              dash.monthSpan <= 3 && "md:max-w-3xl",
              dash.monthSpan === 6 && "md:max-w-6xl",
              dash.monthSpan === 12 && "md:max-w-none",
            )}
          >
            <section
              ref={dash.swipeAreaRef}
              onTouchStart={dash.handleTouchStart}
              onTouchEnd={dash.handleTouchEnd}
              className="relative rounded-md bg-theme-surface shadow-sm p-4 md:p-5"
            >
              {/* Count row */}
              <div className="flex justify-end items-center gap-1.5 pb-2 pr-3">
                {dash.viewMode === DASHBOARD_VIEWS.EXPENSES &&
                  dash.selectedCategories.size > 0 && (
                    <button
                      onClick={() => dash.setSelectedCategories(new Set())}
                      className="text-[0.6875rem] font-medium px-2 py-1 rounded-md bg-theme-background text-theme-text border border-theme-border hover:bg-theme-border transition-colors"
                    >
                      Reset Filter
                    </button>
                  )}
                <p className="text-sm text-theme-muted tabular-nums">
                  {dash.expensesInSelectedSpan.length} transaction
                  {dash.expensesInSelectedSpan.length !== 1 ? "s" : ""} ·{" "}
                  {formatAmount(spanVariableTotal)}
                </p>
              </div>

              {/* Delete confirm modal */}
              <Modal
                isOpen={dash.isDeleteConfirmOpen}
                onClose={() => dash.setIsDeleteConfirmOpen(false)}
                title="Confirm Delete"
                size="sm"
              >
                <p className="text-sm text-theme-muted">
                  Are you sure you want to delete{" "}
                  <strong className="text-theme-text">
                    {dash.selectedIds.size}
                  </strong>{" "}
                  expense{dash.selectedIds.size !== 1 ? "s" : ""}?
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={dash.confirmBulkDelete}
                    className="confirm-delete-btn"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => dash.setIsDeleteConfirmOpen(false)}
                    className="confirm-cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </Modal>

              {/* ── Categories View ── */}
              {dash.viewMode === DASHBOARD_VIEWS.CATEGORIES ? (
                <div
                  className={cn(
                    "space-y-4",
                    dash.viewAnimation === "slide-left" && "view-slide-left",
                    dash.viewAnimation === "slide-right" && "view-slide-right",
                  )}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-separate border-spacing-0">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-left">
                            Category
                          </th>
                          {dash.monthSpan > 1 ? (
                            <>
                              <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-right tabular-nums">
                                Transactions
                              </th>
                              {[...dash.monthKeys]
                                .reverse()
                                .map((mk, displayIdx) => (
                                  <th
                                    key={mk.key}
                                    className={cn(
                                      "table-header-cell text-right tabular-nums",
                                      displayIdx === 0 &&
                                        "border-l border-theme-border",
                                    )}
                                  >
                                    {mk.name}
                                  </th>
                                ))}
                              {dash.showGrandTotal && (
                                <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-right tabular-nums">
                                  Total
                                </th>
                              )}
                            </>
                          ) : (
                            <>
                              <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-right tabular-nums">
                                Transactions
                              </th>
                              <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-right tabular-nums">
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
                                dash.monthSpan > 1
                                  ? 2 +
                                    dash.monthSpan +
                                    (dash.showGrandTotal ? 1 : 0)
                                  : 3
                              }
                              className="px-3 py-12 text-center text-theme-muted"
                            >
                              No expenses yet. Hit{" "}
                              <strong className="text-theme-primary">+</strong>{" "}
                              to add one.
                            </td>
                          </tr>
                        ) : (
                          multiCategoryRows.map(
                            ({ name, totalTransactions, monthlyAmounts }) => (
                              <tr
                                key={name}
                                className="border-b border-theme-muted/10 row-hover"
                              >
                                <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-theme-text whitespace-nowrap font-medium">
                                  {name}
                                </td>
                                {dash.monthSpan > 1 ? (
                                  <>
                                    <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                      {totalTransactions}
                                    </td>
                                    {[...monthlyAmounts]
                                      .reverse()
                                      .map((amount, displayIdx) => {
                                        const dataIdx =
                                          dash.monthKeys.length - 1 - displayIdx;
                                        return (
                                          <td
                                            key={displayIdx}
                                            className={cn(
                                              "px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums",
                                              displayIdx === 0 &&
                                                "border-l border-theme-border",
                                            )}
                                          >
                                            {amount !== 0 ? (
                                              <button
                                                onClick={() =>
                                                  dash.handleCategoryClick(
                                                    name,
                                                    dataIdx,
                                                  )
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
                                    {dash.showGrandTotal && (
                                      <td
                                        className={cn(
                                          "px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums font-semibold",
                                          getNumberColorClass(
                                            monthlyAmounts.reduce(
                                              (s, v) => s + v,
                                              0,
                                            ),
                                          ),
                                        )}
                                      >
                                        {formatAmount(
                                          monthlyAmounts.reduce(
                                            (s, v) => s + v,
                                            0,
                                          ),
                                        )}
                                      </td>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                      {totalTransactions}
                                    </td>
                                    <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums">
                                      {monthlyAmounts[0] !== 0 ? (
                                        <button
                                          onClick={() =>
                                            dash.handleCategoryClick(name, 0)
                                          }
                                          className={cn(
                                            "font-semibold hover:underline",
                                            getNumberColorClass(
                                              monthlyAmounts[0],
                                            ),
                                          )}
                                        >
                                          {formatAmount(monthlyAmounts[0])}
                                        </button>
                                      ) : (
                                        <span className="text-theme-muted">
                                          —
                                        </span>
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
                                  dash.monthSpan > 1
                                    ? 2 +
                                      dash.monthSpan +
                                      (dash.showGrandTotal ? 1 : 0)
                                    : 3
                                }
                                className="table-header-cell px-1.5 sm:px-2 md:px-3 whitespace-nowrap"
                              >
                                Fixed Expenses
                              </td>
                            </tr>
                            {multiFixedRows.map((fe) => {
                              const fixedGrandTotal = fe.monthlyAmounts.reduce(
                                (s, v) => (s ?? 0) + (v ?? 0),
                                0,
                              );
                              return (
                                <tr key={fe.id} className="row-hover">
                                  <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-theme-text whitespace-nowrap">
                                    {fe.name}
                                  </td>
                                  {dash.monthSpan > 1 ? (
                                    <>
                                      <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                        —
                                      </td>
                                      {[...fe.monthlyAmounts]
                                        .reverse()
                                        .map((amount, displayIdx) => (
                                          <td
                                            key={displayIdx}
                                            className={cn(
                                              "px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums font-medium text-theme-text",
                                              displayIdx === 0 &&
                                                "border-l border-theme-border",
                                            )}
                                          >
                                            {amount !== null
                                              ? formatAmount(amount)
                                              : "—"}
                                          </td>
                                        ))}
                                      {dash.showGrandTotal && (
                                        <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums font-semibold text-theme-text">
                                          {formatAmount(fixedGrandTotal)}
                                        </td>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                        —
                                      </td>
                                      <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums font-medium text-theme-text">
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
                        {dash.monthSummaries.length > 0 && (
                          <>
                            <tr>
                              <td
                                colSpan={
                                  dash.monthSpan > 1
                                    ? 2 +
                                      dash.monthSpan +
                                      (dash.showGrandTotal ? 1 : 0)
                                    : 3
                                }
                                className="table-header-cell px-1.5 sm:px-2 md:px-3 whitespace-nowrap"
                              >
                                Budget Summary
                              </td>
                            </tr>
                            {/* Income */}
                            <tr className="row-hover">
                              <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-theme-text whitespace-nowrap font-medium inline-flex items-center gap-1">
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
                              {dash.monthSpan > 1 ? (
                                <>
                                  <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                    —
                                  </td>
                                  {[...dash.monthSummaries]
                                    .reverse()
                                    .map((summary, displayIdx) => {
                                      const dataIdx =
                                        dash.monthSummaries.length - 1 - displayIdx;
                                      return (
                                        <td
                                          key={displayIdx}
                                          className={cn(
                                            "px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums",
                                            displayIdx === 0 &&
                                              "border-l border-theme-border",
                                          )}
                                        >
                                          <button
                                            onClick={() =>
                                              dash.openIncomeModal(dataIdx)
                                            }
                                            className="font-semibold hover:underline text-theme-text"
                                          >
                                            {formatAmount(summary.income)}
                                          </button>
                                        </td>
                                      );
                                    })}
                                  {dash.showGrandTotal && (
                                    <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums font-semibold text-theme-text">
                                      {formatAmount(
                                        dash.monthSummaries.reduce(
                                          (s, m) => s + m.income,
                                          0,
                                        ),
                                      )}
                                    </td>
                                  )}
                                </>
                              ) : (
                                <>
                                  <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                    —
                                  </td>
                                  <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums">
                                    <button
                                      onClick={() => dash.openIncomeModal(0)}
                                      className="font-semibold hover:underline text-theme-text"
                                    >
                                      {formatAmount(dash.monthSummaries[0].income)}
                                    </button>
                                  </td>
                                </>
                              )}
                            </tr>
                            {/* Auto Savings */}
                            <tr className="row-hover">
                              <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-theme-text whitespace-nowrap font-medium inline-flex items-center gap-1">
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
                              {dash.monthSpan > 1 ? (
                                <>
                                  <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                    —
                                  </td>
                                  {[...dash.monthSummaries]
                                    .reverse()
                                    .map((summary, displayIdx) => {
                                      const dataIdx =
                                        dash.monthSummaries.length - 1 - displayIdx;
                                      return (
                                        <td
                                          key={displayIdx}
                                          className={cn(
                                            "px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums",
                                            displayIdx === 0 &&
                                              "border-l border-theme-border",
                                          )}
                                        >
                                          <button
                                            onClick={() =>
                                              dash.openSavingsModal(dataIdx)
                                            }
                                            className="font-semibold hover:underline text-theme-text"
                                          >
                                            {formatAmount(summary.autoSavings)}
                                          </button>
                                        </td>
                                      );
                                    })}
                                  {dash.showGrandTotal && (
                                    <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums font-semibold text-theme-text">
                                      {formatAmount(
                                        dash.monthSummaries.reduce(
                                          (s, m) => s + m.autoSavings,
                                          0,
                                        ),
                                      )}
                                    </td>
                                  )}
                                </>
                              ) : (
                                <>
                                  <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                    —
                                  </td>
                                  <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums">
                                    <button
                                      onClick={() => dash.openSavingsModal(0)}
                                      className="font-semibold hover:underline text-theme-text"
                                    >
                                      {formatAmount(
                                        dash.monthSummaries[0].autoSavings,
                                      )}
                                    </button>
                                  </td>
                                </>
                              )}
                            </tr>
                            {/* Remaining */}
                            <tr className="row-hover">
                              <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-theme-text whitespace-nowrap font-medium">
                                Remaining
                              </td>
                              {dash.monthSpan > 1 ? (
                                <>
                                  <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                    —
                                  </td>
                                  {[...dash.monthSummaries]
                                    .reverse()
                                    .map((summary, displayIdx) => {
                                      const v = summary.remaining;
                                      return (
                                        <td
                                          key={displayIdx}
                                          className={cn(
                                            "px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums font-semibold",
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
                                  {dash.showGrandTotal && (
                                    <td
                                      className={cn(
                                        "px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums font-semibold",
                                        (() => {
                                          const v = dash.monthSummaries.reduce(
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
                                        dash.monthSummaries.reduce(
                                          (s, m) => s + m.remaining,
                                          0,
                                        ),
                                      )}
                                    </td>
                                  )}
                                </>
                              ) : (
                                <>
                                  <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                    —
                                  </td>
                                  <td
                                    className={cn(
                                      "px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums font-semibold",
                                      (() => {
                                        const v = dash.monthSummaries[0].remaining;
                                        return v > 0
                                          ? "text-theme-success"
                                          : v < 0
                                            ? "text-theme-danger"
                                            : "text-theme-text";
                                      })(),
                                    )}
                                  >
                                    {formatAmount(dash.monthSummaries[0].remaining)}
                                  </td>
                                </>
                              )}
                            </tr>
                            {/* Total Savings */}
                            <tr className="row-hover">
                              <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-theme-text whitespace-nowrap font-medium">
                                Total Savings
                              </td>
                              {dash.monthSpan > 1 ? (
                                <>
                                  <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                    —
                                  </td>
                                  {[...dash.monthSummaries]
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
                                            "px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums font-semibold",
                                            displayIdx === 0 &&
                                              "border-l border-theme-border",
                                          )}
                                          style={{ color }}
                                        >
                                          {formatAmount(totalSavings)}
                                        </td>
                                      );
                                    })}
                                  {dash.showGrandTotal && (
                                    <td
                                      className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums font-semibold"
                                      style={{
                                        color: (() => {
                                          const grandTotal =
                                            dash.monthSummaries.reduce(
                                              (s, m) =>
                                                s + m.autoSavings + m.remaining,
                                              0,
                                            );
                                          const totalIncome =
                                            dash.monthSummaries.reduce(
                                              (s, m) => s + m.income,
                                              0,
                                            );
                                          const avgRate =
                                            dash.monthSummaries.reduce(
                                              (s, m) => s + m.savingsRate,
                                              0,
                                            ) / dash.monthSummaries.length;
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
                                        dash.monthSummaries.reduce(
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
                                  <td className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right text-theme-muted tabular-nums">
                                    —
                                  </td>
                                  <td
                                    className="px-1.5 sm:px-2 md:px-3 py-1.5 text-right tabular-nums font-semibold"
                                    style={{
                                      color: (() => {
                                        const summary = dash.monthSummaries[0];
                                        const totalSavings =
                                          summary.autoSavings + summary.remaining;
                                        const ratioPct =
                                          summary.income > 0
                                            ? (totalSavings / summary.income) *
                                              100
                                            : 0;
                                        return getSavingsGradientColor(
                                          ratioPct,
                                          summary.savingsRate,
                                        );
                                      })(),
                                    }}
                                  >
                                    {formatAmount(
                                      dash.monthSummaries[0].autoSavings +
                                        dash.monthSummaries[0].remaining,
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
                  {dash.drilldownCategory && drilldownExpenses.length > 0 && (
                    <div
                      ref={dash.drilldownRef}
                      className="space-y-2 border-t border-theme-border pt-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-theme-text">
                          {dash.drilldownCategory} —{" "}
                          {dash.monthKeys[dash.drilldownCategoryMonthIndex].name}{" "}
                          {dash.monthKeys[dash.drilldownCategoryMonthIndex].year}
                        </h3>
                        <button
                          onClick={dash.closeDrilldown}
                          className="text-xs font-medium text-theme-muted hover:text-theme-text transition-colors"
                        >
                          Close
                        </button>
                      </div>
                      <div className="divide-y divide-theme-border">
                        {groupedDrilldownExpenses.map(([date, items]) => (
                          <div key={date}>
                            <div className="py-1 px-3 text-xs text-theme-muted bg-theme-background/50">
                              {formatDate(date)}
                            </div>
                            {items.map((exp) => {
                              const amountColor =
                                exp.amount < 0
                                  ? "text-theme-success"
                                  : "text-theme-primary";
                              return (
                                <div
                                  key={exp.id}
                                  className="flex items-center justify-between py-2 px-3 row-hover"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-theme-text truncate">
                                      {exp.description || "—"}
                                    </p>
                                  </div>
                                  <span
                                    className={cn(
                                      "text-sm font-semibold tabular-nums",
                                      amountColor,
                                    )}
                                  >
                                    {formatAmount(exp.amount)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <ExpensesView
                  expenses={dash.filteredExpenses}
                  categories={categories}
                  selectedIds={dash.selectedIds}
                  onToggleSelect={dash.toggleExpenseSelection}
                  onToggleSelectAll={dash.toggleSelectAll}
                  onBulkDelete={dash.openDeleteConfirmation}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  isMobile={isMobile}
                  mobileEditTrigger={dash.mobileEditTrigger}
                  viewAnimation={dash.viewAnimation}
                />
              )}
            </section>
          </div>
        </div>

        {/* Mobile selection banner */}
        {isMobile && dash.selectedIds.size > 0 && (
          <MobileSelectionBanner
            count={dash.selectedIds.size}
            onEdit={triggerMobileEdit}
            onDelete={dash.openDeleteConfirmation}
            onDeselectAll={dash.clearSelection}
          />
        )}

        {/* Income edit modal */}
        <Modal
          isOpen={dash.isIncomeModalOpen}
          onClose={dash.closeIncomeModal}
          title={`Edit Income — ${modalMonthKey?.name ?? ""} ${modalMonthKey?.year ?? ""}`}
          size="sm"
        >
          <form onSubmit={dash.submitIncome} className="space-y-4">
            {dash.incomeError && (
              <p className="text-theme-danger text-xs">{dash.incomeError}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="number"
                value={dash.incomeDraft}
                onChange={(e) => dash.setIncomeDraft(e.target.value)}
                placeholder="Amount"
                min="0.01"
                step="0.01"
                autoFocus
                className="input-theme px-3 py-2 text-sm w-full sm:flex-1 min-w-0"
              />
              <select
                value={dash.incomeFreqDraft}
                onChange={(e) => dash.setIncomeFreqDraft(e.target.value)}
                className="input-theme px-3 py-2 text-sm w-full sm:w-auto min-w-0"
              >
                {dash.INCOME_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="submit" className="summary-save-btn">
                Save
              </button>
              <button
                type="button"
                onClick={dash.closeIncomeModal}
                className="summary-cancel-btn rounded-theme-small"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>

        {/* Savings rate edit modal */}
        <Modal
          isOpen={dash.isSavingsModalOpen}
          onClose={dash.closeSavingsModal}
          title={`Edit Savings Rate — ${modalMonthKey?.name ?? ""} ${modalMonthKey?.year ?? ""}`}
          size="sm"
        >
          <form onSubmit={dash.submitSavings} className="space-y-4">
            {dash.savingsError && (
              <p className="text-theme-danger text-xs">{dash.savingsError}</p>
            )}
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={dash.savingsDraft}
                onChange={(e) => dash.setSavingsDraft(e.target.value)}
                placeholder="e.g. 20"
                min="0"
                max="100"
                step="0.1"
                autoFocus
                className="input-theme px-3 py-2 text-sm w-full sm:w-28 min-w-0"
              />
              <span className="text-sm text-theme-muted shrink-0">%</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="submit" className="summary-save-btn">
                Save
              </button>
              <button
                type="button"
                onClick={dash.closeSavingsModal}
                className="summary-cancel-btn rounded-theme-small"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>

        {/* Filter modal */}
        <FilterModal
          isOpen={dash.isFilterModalOpen}
          onClose={() => dash.setIsFilterModalOpen(false)}
          filterGlobal={dash.filterGlobal}
          onFilterGlobalChange={dash.setFilterGlobal}
          filterDateFrom={dash.filterDateFrom}
          onFilterDateFromChange={dash.setFilterDateFrom}
          filterDateTo={dash.filterDateTo}
          onFilterDateToChange={dash.setFilterDateTo}
          filterCategory={dash.filterCategory}
          onFilterCategoryChange={dash.setFilterCategory}
          filterDescription={dash.filterDescription}
          onFilterDescriptionChange={dash.setFilterDescription}
          filterAmount={dash.filterAmount}
          onFilterAmountChange={dash.setFilterAmount}
          onClearAll={dash.clearAllFilters}
          categories={categories}
        />
      </div>
    </div>
  );
}
