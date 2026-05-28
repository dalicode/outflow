import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { cn } from '../../lib/cn'
import './dashboard.css'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import MobileSelectionBanner from './components/MobileSelectionBanner'
import PullToRefreshContainer from '../../components/ui/PullToRefreshContainer'
import { useSettings } from '../../context/settingsContext'
import type { DashboardSessionState } from './hooks/useDashboard'
import { useDashboard } from './hooks/useDashboard'
import type { Category, Expense, Payee } from '../../types'
import CategoryViewTable from './CategoryViewTable'
import CheckInReminderCard from './CheckInReminderCard'
import IncomeModalForm from './components/IncomeModalForm'
import SavingsModalForm from './components/SavingsModalForm'
import type { DashboardView } from './constants'
import { DASHBOARD_VIEWS } from './constants'
import DashboardHeader from './DashboardHeader'
import DashboardMonthStrip from './DashboardMonthStrip'
import DashboardViewTabs from './DashboardViewTabs'
import ExpenseDrilldown from './ExpenseDrilldown'
import ExpenseTable, { type ExpenseTableHandle } from './ExpenseTable'
import FilterModal from './FilterModal'
import MonthSpanSelector from './MonthSpanSelector'
import PayeeViewTable from './PayeeViewTable'
import PrivateValue from '../../components/privacy/PrivateValue'
import { StorageService } from '../../services/storageService'

interface DashboardExpenseTableDisplay {
  showNotesColumn: boolean
  showTagsColumn: boolean
}

const DEFAULT_EXPENSE_TABLE_DISPLAY: DashboardExpenseTableDisplay = {
  showNotesColumn: true,
  showTagsColumn: true,
}

interface DashboardProps {
  expenses: Expense[]
  categories: Category[]
  payees: Payee[]
  onUpdate: (id: number, changes: Partial<Expense>) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onBulkDelete: (ids: number[]) => Promise<void>
  onSelectionChange?: (active: boolean) => void
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
  refreshCategories?: () => Promise<void>
  refreshPayees?: () => Promise<void>
  refreshExpenses?: () => Promise<void>
  triggerSync?: () => void
  registerCycleView?: (fn: () => void) => void
  sessionState?: DashboardSessionState
  onSessionStateChange?: (patch: Partial<DashboardSessionState>) => void
  onAddExpense?: () => void
  onRefresh?: () => Promise<void>
}

export default function Dashboard({
  expenses,
  categories,
  payees,
  onUpdate,
  onDelete,
  onBulkDelete,
  onSelectionChange,
  onScroll,
  refreshCategories,
  refreshPayees,
  refreshExpenses,
  triggerSync,
  registerCycleView,
  sessionState,
  onSessionStateChange,
  onAddExpense,
  onRefresh,
}: DashboardProps) {
  const { formatAmount, getNumberColorClass, formatDate } = useSettings()
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expenseIds = useMemo(
    () =>
      expenses.map((expense) => expense.id).filter((id): id is number => typeof id === 'number'),
    [expenses],
  )
  const activeTags = useLiveQuery(() => StorageService.getActiveTags(), []) ?? []
  const expenseTagsMap =
    useLiveQuery(() => StorageService.getExpenseTagsMap(expenseIds), [expenseIds]) ?? {}
  const filterTags = useMemo(() => {
    const tagsById = new Map<number, (typeof activeTags)[number]>()
    for (const tag of activeTags) {
      if (typeof tag.id === 'number') {
        tagsById.set(tag.id, tag)
      }
    }
    for (const expenseTags of Object.values(expenseTagsMap)) {
      for (const tag of expenseTags) {
        if (typeof tag.id === 'number' && !tagsById.has(tag.id)) {
          tagsById.set(tag.id, tag)
        }
      }
    }
    return Array.from(tagsById.values())
  }, [activeTags, expenseTagsMap])

  // ── Hooks ──
  const dash = useDashboard(
    expenses,
    categories,
    payees,
    expenseTagsMap,
    onBulkDelete,
    onSelectionChange,
    sessionState,
    onSessionStateChange,
  )

  // ── Derived values ──
  const isMobile = dash.viewportWidth < 640

  // Register the view-cycle callback for the Navbar dashboard icon
  const VIEW_CYCLE: DashboardView[] = useMemo(
    () => [DASHBOARD_VIEWS.CATEGORIES, DASHBOARD_VIEWS.PAYEES, DASHBOARD_VIEWS.EXPENSES],
    [],
  )
  useEffect(() => {
    registerCycleView?.(() => {
      dash.setView(VIEW_CYCLE[(VIEW_CYCLE.indexOf(dash.viewMode) + 1) % VIEW_CYCLE.length])
    })
  }, [dash.viewMode, registerCycleView, dash.setView, VIEW_CYCLE])

  const expenseTableRef = useRef<ExpenseTableHandle>(null)
  const [mobileExtraMenuActions, setMobileExtraMenuActions] = useState<
    Array<{ label: string; onClick: () => void; danger?: boolean }>
  >([])
  const [mobileSplitParentSelectionId, setMobileSplitParentSelectionId] = useState<number | null>(
    null,
  )
  const [isMobileScrolling, setIsMobileScrolling] = useState(false)
  const [expenseTableDisplay, setExpenseTableDisplay] = useState<DashboardExpenseTableDisplay>(
    DEFAULT_EXPENSE_TABLE_DISPLAY,
  )

  useEffect(() => {
    let isCancelled = false
    void StorageService.getSetting<DashboardExpenseTableDisplay>(
      'dashboardExpenseTableDisplay',
      DEFAULT_EXPENSE_TABLE_DISPLAY,
    ).then((saved) => {
      if (isCancelled || !saved) return
      setExpenseTableDisplay({
        showNotesColumn: saved.showNotesColumn ?? true,
        showTagsColumn: saved.showTagsColumn ?? true,
      })
    })
    return () => {
      isCancelled = true
    }
  }, [])

  const updateExpenseTableDisplay = useCallback(
    (nextValue: DashboardExpenseTableDisplay) => {
      setExpenseTableDisplay(nextValue)
      void StorageService.setLocalSetting('dashboardExpenseTableDisplay', nextValue)
    },
    [],
  )

  useEffect(() => {
    if (dash.viewMode !== DASHBOARD_VIEWS.EXPENSES || dash.selectedIds.size === 0) {
      setMobileSplitParentSelectionId(null)
    }
  }, [dash.viewMode, dash.selectedIds.size])

  const triggerMobileEdit = useCallback(() => {
    if (mobileSplitParentSelectionId != null) {
      expenseTableRef.current?.handleSplitEditRequest(mobileSplitParentSelectionId)
      return
    }
    if (dash.selectedIds.size > 1) {
      expenseTableRef.current?.handleEditRequest(Array.from(dash.selectedIds))
    } else {
      const id = Array.from(dash.selectedIds)[0]
      if (id != null) {
        dash.setMobileEditTrigger(id)
        requestAnimationFrame(() => dash.setMobileEditTrigger(null))
      }
    }
  }, [dash.selectedIds, dash.setMobileEditTrigger, mobileSplitParentSelectionId])

  const handleMobileCopy = useCallback(() => {
    const ids = Array.from(dash.selectedIds)
    if (ids.length > 0) {
      expenseTableRef.current?.handleCopyRequest(ids)
    }
  }, [dash.selectedIds])

  const handleScrollableContentScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (isMobile) {
        setIsMobileScrolling(true)
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
        scrollTimeoutRef.current = setTimeout(() => {
          setIsMobileScrolling(false)
        }, 800)
      }

      onScroll?.(event)
    },
    [isMobile, onScroll],
  )

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isMobile && isMobileScrolling) {
      setIsMobileScrolling(false)
    }
  }, [isMobile, isMobileScrolling])

  // ── Income / Savings modal helpers ──
  const modalTargetSummary = dash.monthSummaries[dash.modalTargetMonthIndex]

  return (
    <PullToRefreshContainer
      className="flex h-full flex-col"
      data-testid="dashboard"
      onRefresh={onRefresh ?? (async () => undefined)}
      scrollTargetRef={dash.scrollableRef}
      scrollable={false}
    >
      {/* ── Fixed header ── */}
      <div className="w-full max-w-4xl mx-auto">
        <div
          className={cn(
            'mx-auto px-4 pt-6 pb-3 space-y-6',
            dash.monthSpan === 12 ? 'max-w-none' : 'max-w-7xl',
          )}
        >
          <DashboardHeader financialSummary={dash.financialSummary} daysLeft={dash.daysLeft} />
          <MonthSpanSelector
            monthSpan={dash.monthSpan}
            showGrandTotal={dash.showGrandTotal}
            viewportWidth={dash.viewportWidth}
            onSpanChange={dash.setMonthSpan}
            onToggleGrandTotal={() => dash.setShowGrandTotal((p) => !p)}
          />
        </div>
      </div>
      <div className="pb-6">
        <DashboardMonthStrip
          selectedYear={dash.selectedYear}
          selectedMonth={dash.selectedMonth}
          monthSpan={dash.monthSpan}
          stripMaxVisible={dash.stripMaxVisible}
          monthStrip={dash.monthStrip}
          yearFirstIndices={dash.yearFirstIndices}
          monthKeys={dash.monthKeys}
          onSelectMonth={dash.navigateToMonth}
          onCurrent={dash.jumpToCurrentMonth}
          onStepBack={dash.goToPreviousMonth}
          onStepForward={dash.goToNextMonth}
          disableCurrent={dash.isAtCurrentMonth}
        />
      </div>
      {/* ── Tabs ── */}
      <DashboardViewTabs
        viewMode={dash.viewMode}
        activeFilterCount={dash.activeFilterCount}
        hasCategoryFilter={dash.selectedCategories.size > 0}
        onSwitchToCategories={dash.switchToCategories}
        onSwitchToPayees={dash.switchToPayees}
        onSwitchToExpenses={dash.switchToExpenses}
        onOpenFilters={() => dash.setIsFilterModalOpen(true)}
        onResetCategoryFilter={() => dash.setSelectedCategories(new Set())}
        monthSpan={dash.monthSpan}
        showNotesColumn={expenseTableDisplay.showNotesColumn}
        showTagsColumn={expenseTableDisplay.showTagsColumn}
        onToggleShowNotesColumn={() =>
          updateExpenseTableDisplay({
            ...expenseTableDisplay,
            showNotesColumn: !expenseTableDisplay.showNotesColumn,
          })
        }
        onToggleShowTagsColumn={() =>
          updateExpenseTableDisplay({
            ...expenseTableDisplay,
            showTagsColumn: !expenseTableDisplay.showTagsColumn,
          })
        }
        isMobile={isMobile}
      />

      {/* ── Scrollable content ── */}
      <div
        ref={dash.scrollableRef}
        className={cn(
          'flex-1 min-h-0 overflow-y-auto overscroll-contain',
          isMobile && 'scrollbar-auto-hide',
          isMobileScrolling && 'is-scrolling',
        )}
        onScroll={handleScrollableContentScroll}
      >
        <div
          className={cn(
            'mx-auto px-4 pb-24',
            dash.monthSpan === 12 ? 'max-w-[120rem]' : 'max-w-7xl',
          )}
        >
          <div
            className={cn(
              'w-full mx-auto',
              dash.viewMode === DASHBOARD_VIEWS.EXPENSES
                ? 'md:max-w-3xl'
                : dash.monthSpan <= 3
                  ? 'md:max-w-3xl'
                  : dash.monthSpan === 6
                    ? 'md:max-w-6xl'
                    : 'md:max-w-[120rem]',
            )}
          >
            {onAddExpense && (
              <CheckInReminderCard expenses={expenses} onAddExpense={onAddExpense} />
            )}
            <section
              ref={dash.swipeAreaRef}
              onTouchStart={dash.handleTouchStart}
              onTouchEnd={dash.handleTouchEnd}
              className="relative rounded-theme-large border border-theme-border bg-theme-surface py-4 px-2"
            >
              {/* Count row */}
              <div className="flex justify-end items-center gap-1.5 pb-2 pr-3">
                {dash.viewMode === DASHBOARD_VIEWS.EXPENSES && dash.selectedCategories.size > 0 && (
                  <button
                    onClick={() => dash.setSelectedCategories(new Set())}
                    className="text-[0.6875rem] font-medium px-2 py-1 rounded-theme-medium bg-theme-background text-theme-text border border-theme-border hover:bg-theme-border transition-colors"
                  >
                    Reset Filter
                  </button>
                )}
                <p className="text-sm text-theme-muted tabular-nums">
                  {dash.expensesInSelectedSpan.length} transaction
                  {dash.expensesInSelectedSpan.length !== 1 ? 's' : ''} ·{' '}
                  <PrivateValue>{formatAmount(dash.spanVariableTotal)}</PrivateValue>
                </p>
              </div>

              {/* Delete confirm modal */}
              <ConfirmDialog
                isOpen={dash.isDeleteConfirmOpen}
                onClose={() => dash.setIsDeleteConfirmOpen(false)}
                title="Confirm Delete"
                description={
                  <span className="text-sm text-theme-muted">
                    Are you sure you want to delete{' '}
                    <strong className="text-theme-text">{dash.selectedIds.size}</strong> expense
                    {dash.selectedIds.size !== 1 ? 's' : ''}?
                  </span>
                }
                confirmLabel="Delete"
                confirmVariant="destructive"
                onConfirm={dash.confirmBulkDelete}
              />

              {/* ── Categories View ── */}
              {dash.viewMode === DASHBOARD_VIEWS.CATEGORIES ? (
                <div
                  className={cn(
                    'space-y-4',
                    dash.viewAnimation === 'slide-left' && 'view-slide-left',
                    dash.viewAnimation === 'slide-right' && 'view-slide-right',
                  )}
                >
                  <CategoryViewTable
                    multiCategoryRows={dash.multiCategoryRows}
                    multiFixedRows={dash.multiFixedRows}
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

                  {dash.drilldownCategory &&
                    dash.drilldownExpenses.length > 0 &&
                    dash.monthKeys[dash.drilldownCategoryMonthIndex] && (
                      <ExpenseDrilldown
                        ref={dash.drilldownRef}
                        title={`${dash.drilldownCategory} — ${dash.monthKeys[dash.drilldownCategoryMonthIndex].name} ${dash.monthKeys[dash.drilldownCategoryMonthIndex].year}`}
                        expenses={dash.drilldownExpenses}
                        formatDate={formatDate}
                        formatAmount={formatAmount}
                        resolveName={dash.getExpenseCategoryName}
                        resolvePayeeName={dash.getExpensePayeeName}
                        onClose={dash.closeDrilldown}
                        isMobile={isMobile}
                        secondColumn="payee"
                      />
                    )}
                </div>
              ) : dash.viewMode === DASHBOARD_VIEWS.PAYEES ? (
                <div
                  className={cn(
                    'space-y-4',
                    dash.viewAnimation === 'slide-left' && 'view-slide-left',
                    dash.viewAnimation === 'slide-right' && 'view-slide-right',
                  )}
                >
                  <PayeeViewTable
                    multiPayeeRows={dash.multiPayeeRows}
                    multiFixedRows={dash.multiFixedRows}
                    monthSummaries={dash.monthSummaries}
                    monthKeys={dash.monthKeys}
                    monthSpan={dash.monthSpan}
                    showGrandTotal={dash.showGrandTotal}
                    onPayeeClick={dash.handlePayeeClick}
                    onIncomeClick={dash.openIncomeModal}
                    onSavingsClick={dash.openSavingsModal}
                    formatAmount={formatAmount}
                    getNumberColorClass={getNumberColorClass}
                  />

                  {dash.drilldownPayee &&
                    dash.drilldownPayeeExpenses.length > 0 &&
                    dash.monthKeys[dash.drilldownPayeeMonthIndex] && (
                      <ExpenseDrilldown
                        ref={dash.drilldownRef}
                        title={`${dash.drilldownPayee} — ${dash.monthKeys[dash.drilldownPayeeMonthIndex].name} ${dash.monthKeys[dash.drilldownPayeeMonthIndex].year}`}
                        expenses={dash.drilldownPayeeExpenses}
                        formatDate={formatDate}
                        formatAmount={formatAmount}
                        resolveName={dash.getExpenseCategoryName}
                        resolvePayeeName={dash.getExpensePayeeName}
                        onClose={dash.closePayeeDrilldown}
                        isMobile={isMobile}
                        secondColumn="category"
                      />
                    )}
                </div>
              ) : (
                <div
                  className={cn(
                    dash.viewAnimation === 'slide-left' && 'view-slide-left',
                    dash.viewAnimation === 'slide-right' && 'view-slide-right',
                  )}
                >
                  <ExpenseTable
                    ref={expenseTableRef}
                    expenses={dash.filteredExpenses}
                    categories={categories}
                    payees={payees}
                    expenseTagsMap={dash.expenseTagsMap}
                    selectedIds={dash.selectedIds}
                    onToggleSelect={dash.toggleExpenseSelection}
                    onToggleSelectAll={dash.toggleSelectAll}
                    onBulkDelete={() => onBulkDelete(Array.from(dash.selectedIds))}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    isMobile={isMobile}
                    showNotesColumn={expenseTableDisplay.showNotesColumn}
                    showTagsColumn={expenseTableDisplay.showTagsColumn}
                    mobileEditTrigger={dash.mobileEditTrigger}
                    refreshCategories={refreshCategories}
                    refreshPayees={refreshPayees}
                    refreshExpenses={refreshExpenses}
                    triggerSync={triggerSync}
                    onMobileExtraMenuActionsChange={setMobileExtraMenuActions}
                    onMobileSplitParentSelectionChange={setMobileSplitParentSelectionId}
                    isSplitParentExpanded={dash.isSplitParentExpanded}
                    onToggleSplitParentExpanded={dash.toggleSplitParentExpanded}
                  />
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Mobile selection banner */}
        {isMobile && dash.selectedIds.size > 0 && (
          <MobileSelectionBanner
            count={dash.selectedIds.size}
            onEdit={triggerMobileEdit}
            onCopy={handleMobileCopy}
            onDelete={dash.openDeleteConfirmation}
            onSelectAll={dash.toggleSelectAll}
            onDeselectAll={dash.clearSelection}
            extraMenuActions={mobileExtraMenuActions}
          />
        )}

        {/* Income edit modal */}
        <IncomeModalForm
          isOpen={dash.isIncomeModalOpen}
          onClose={dash.closeIncomeModal}
          title="Edit Income"
          size="md"
          initialAmount={dash.getInitialIncomeAmount()}
          initialFrequency="monthly"
          onSave={dash.handleIncomeSave}
          error={dash.incomeError}
          description="Sets your monthly income. This affects budget calculations, savings targets, and remaining balance."
        />

        {/* Savings rate edit modal */}
        <SavingsModalForm
          isOpen={dash.isSavingsModalOpen}
          onClose={dash.closeSavingsModal}
          title="Edit Auto Savings"
          size="md"
          initialRate={dash.getInitialSavingsRate()}
          monthlyIncome={modalTargetSummary?.income ?? 0}
          onSave={dash.handleSavingsSave}
          error={dash.savingsError}
          description="Percentage of income automatically set aside. Remaining budget = income − fixed expenses − auto savings."
        />

        {/* Filter modal */}
        <FilterModal
          isOpen={dash.isFilterModalOpen}
          onClose={() => dash.setIsFilterModalOpen(false)}
          appliedFilters={{
            filterGlobal: dash.filterGlobal,
            filterDateFrom: dash.filterDateFrom,
            filterDateTo: dash.filterDateTo,
            selectedCategories: dash.selectedCategories,
            selectedPayees: dash.selectedPayees,
            selectedTags: dash.selectedTags,
            filterNotes: dash.filterNotes,
            filterAmount: dash.filterAmount,
          }}
          onApply={(draft) => {
            dash.applyDashboardFilters({
              filterGlobal: draft.filterGlobal,
              filterDateFrom: draft.filterDateFrom,
              filterDateTo: draft.filterDateTo,
              filterNotes: draft.filterNotes,
              filterAmount: draft.filterAmount,
              selectedCategories: Array.from(draft.selectedCategories),
              selectedPayees: Array.from(draft.selectedPayees),
              selectedTags: Array.from(draft.selectedTags),
            })
          }}
          categories={categories}
          payees={payees}
          tags={filterTags}
        />
      </div>
    </PullToRefreshContainer>
  )
}
