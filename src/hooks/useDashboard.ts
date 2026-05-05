import { useState, useMemo, useCallback } from "react";
import { useDashboardMonthNav } from "./useDashboardMonthNav";
import { useDashboardData } from "./useDashboardData";
import { useDashboardFilters } from "./useDashboardFilters";
import type { DashboardFiltersState } from "./useDashboardFilters";
import { useDashboardSelection } from "./useDashboardSelection";
import { useDashboardView } from "./useDashboardView";
import { useIncomeSavingsModals } from "./useIncomeSavingsModals";
import {
  computeMultiMonthCategoryRows,
  computeMultiMonthFixedRows,
} from "../utils/dashboardHelpers";
import type { Expense, Category, Payee } from "../types";
import type { MonthSpan, DashboardView } from "../features/dashboard/constants";

export interface DashboardSessionState {
  selectedYear: number;
  selectedMonth: number;
  monthSpan: MonthSpan;
  showGrandTotal: boolean;
  viewMode: DashboardView;
  filters: DashboardFiltersState;
}

export function useDashboard(
  expenses: Expense[],
  categories: Category[],
  payees: Payee[],
  onBulkDelete: (ids: number[]) => void,
  onSelectionChange?: (active: boolean) => void,
  sessionState?: DashboardSessionState,
  onSessionStateChange?: (patch: Partial<DashboardSessionState>) => void,
) {
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [mobileEditTrigger, setMobileEditTrigger] = useState<number | null>(
    null,
  );

  const monthNav = useDashboardMonthNav(
    sessionState?.selectedYear,
    sessionState?.selectedMonth,
    sessionState?.monthSpan,
    sessionState?.showGrandTotal,
    (y) => onSessionStateChange?.({ selectedYear: y }),
    (m) => onSessionStateChange?.({ selectedMonth: m }),
    (s) => onSessionStateChange?.({ monthSpan: s }),
    (v) => onSessionStateChange?.({ showGrandTotal: v }),
  );
  const data = useDashboardData(
    expenses,
    monthNav.selectedYear,
    monthNav.selectedMonth,
    monthNav.monthSpan,
    dataRefreshKey,
  );
  const filters = useDashboardFilters(
    expenses,
    data.monthKeys,
    categories,
    payees,
    sessionState?.filters,
    (patch) => onSessionStateChange?.({ filters: { ...sessionState?.filters, ...patch } as DashboardFiltersState }),
  );
  const selection = useDashboardSelection(
    filters.filteredExpenses,
    onBulkDelete,
    onSelectionChange,
  );
  const view = useDashboardView(
    onSelectionChange,
    selection.selectedIds,
    sessionState?.viewMode,
    (v) => onSessionStateChange?.({ viewMode: v }),
  );
  const modals = useIncomeSavingsModals(
    data.monthSummaries,
    data.monthKeys,
    () => setDataRefreshKey((k) => k + 1),
  );

  const refreshData = useCallback(() => {
    setDataRefreshKey((k) => k + 1);
  }, []);

  const multiCategoryRows = useMemo(
    () =>
      computeMultiMonthCategoryRows(
        filters.filteredExpenses,
        data.monthKeys,
        filters.getExpenseCategoryName,
      ),
    [filters.filteredExpenses, data.monthKeys, filters.getExpenseCategoryName],
  );

  const multiFixedRows = useMemo(
    () => computeMultiMonthFixedRows(data.monthSummaries),
    [data.monthSummaries],
  );

  const payeeById = useMemo(
    () => Object.fromEntries(payees.map((p) => [p.id, p])),
    [payees],
  );

  const getExpensePayeeName = useCallback(
    (exp: Expense) => payeeById[exp.payeeId as number]?.name ?? "—",
    [payeeById],
  );

  const multiPayeeRows = useMemo(
    () =>
      computeMultiMonthCategoryRows(
        filters.filteredExpenses,
        data.monthKeys,
        getExpensePayeeName,
      ),
    [filters.filteredExpenses, data.monthKeys, getExpensePayeeName],
  );

  const drilldownExpenses = useMemo(() => {
    if (!view.drilldownCategory) return [];
    const mk = data.monthKeys[view.drilldownCategoryMonthIndex];
    return filters.filteredExpenses
      .filter((e) => {
        const matchesMonth = e.date.startsWith(mk.key);
        const matchesCategory =
          filters.getExpenseCategoryName(e) === view.drilldownCategory;
        return matchesMonth && matchesCategory;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [
    view.drilldownCategory,
    view.drilldownCategoryMonthIndex,
    filters.filteredExpenses,
    data.monthKeys,
    filters.getExpenseCategoryName,
  ]);

  const drilldownPayeeExpenses = useMemo(() => {
    if (!view.drilldownPayee) return [];
    const mk = data.monthKeys[view.drilldownPayeeMonthIndex];
    return filters.filteredExpenses
      .filter((e) => {
        const matchesMonth = e.date.startsWith(mk.key);
        const matchesPayee = getExpensePayeeName(e) === view.drilldownPayee;
        return matchesMonth && matchesPayee;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [
    view.drilldownPayee,
    view.drilldownPayeeMonthIndex,
    filters.filteredExpenses,
    data.monthKeys,
    getExpensePayeeName,
  ]);

  const groupedDrilldownExpenses = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    drilldownExpenses.forEach((exp) => {
      if (!groups[exp.date]) groups[exp.date] = [];
      groups[exp.date].push(exp);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [drilldownExpenses]);

  const spanVariableTotal = useMemo(
    () => data.monthSummaries.reduce((s, m) => s + m.variableExpenses, 0),
    [data.monthSummaries],
  );

  const triggerMobileEdit = useCallback(() => {
    const id = Array.from(selection.selectedIds)[0];
    if (id != null) {
      setMobileEditTrigger(id);
      requestAnimationFrame(() => setMobileEditTrigger(null));
    }
  }, [selection.selectedIds]);

  return {
    // Navigation
    ...monthNav,
    // Data
    ...data,
    // Filters
    ...filters,
    // Selection
    ...selection,
    // View
    ...view,
    // Modals
    ...modals,
    // Derived
    multiCategoryRows,
    multiFixedRows,
    multiPayeeRows,
    getExpensePayeeName,
    drilldownExpenses,
    drilldownPayeeExpenses,
    groupedDrilldownExpenses,
    spanVariableTotal,
    mobileEditTrigger,
    refreshData,
    triggerMobileEdit,
    dataRefreshKey,
    setMobileEditTrigger,
  };
}
