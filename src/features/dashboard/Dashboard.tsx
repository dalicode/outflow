import { useMemo, useCallback } from "react";
import { cn } from "../../utils/cn";
import "./dashboard.css";
import Modal from "../../components/ui/Modal";
import MobileSelectionBanner from "../../components/ui/MobileSelectionBanner";
import { useSettings } from "../../context/settingsContext";
import { useDashboard } from "../../hooks/useDashboard";
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
import CategoryViewTable from "./CategoryViewTable";
import CategoryDrilldown from "./CategoryDrilldown";
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

  // ── Hooks ──
  const dash = useDashboard(
    expenses,
    categories,
    onBulkDelete,
    onSelectionChange,
  );

  // ── Derived values ──
  const isMobile = dash.viewportWidth < 640;

  const multiCategoryRows = useMemo(
    () =>
      computeMultiMonthCategoryRows(
        dash.filteredExpenses,
        dash.monthKeys,
        dash.getExpenseCategoryName,
      ),
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
        const matchesCategory =
          dash.getExpenseCategoryName(e) === dash.drilldownCategory;
        return matchesMonth && matchesCategory;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [
    dash.drilldownCategory,
    dash.drilldownCategoryMonthIndex,
    dash.filteredExpenses,
    dash.monthKeys,
    dash.getExpenseCategoryName,
  ]);

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
                  <CategoryViewTable
                    multiCategoryRows={multiCategoryRows}
                    multiFixedRows={multiFixedRows}
                    monthSummaries={dash.monthSummaries}
                    monthKeys={dash.monthKeys}
                    monthSpan={dash.monthSpan}
                    showGrandTotal={dash.showGrandTotal}
                    onCategoryClick={dash.handleCategoryClick}
                    onIncomeClick={dash.openIncomeModal}
                    onSavingsClick={dash.openSavingsModal}
                    formatAmount={formatAmount}
                    getNumberColorClass={getNumberColorClass}
                  />

                  {dash.drilldownCategory && drilldownExpenses.length > 0 && (
                    <CategoryDrilldown
                      category={dash.drilldownCategory}
                      monthName={
                        dash.monthKeys[dash.drilldownCategoryMonthIndex].name
                      }
                      year={
                        dash.monthKeys[dash.drilldownCategoryMonthIndex].year
                      }
                      expenses={drilldownExpenses}
                      formatDate={formatDate}
                      formatAmount={formatAmount}
                      onClose={dash.closeDrilldown}
                    />
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
