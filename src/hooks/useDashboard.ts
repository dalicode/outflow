import { useState, useMemo, useCallback } from "react";
import { useDashboardMonthNav } from "./useDashboardMonthNav";
import { useDashboardData } from "./useDashboardData";
import { useDashboardFilters } from "./useDashboardFilters";
import { useDashboardSelection } from "./useDashboardSelection";
import { useDashboardView } from "./useDashboardView";
import { useIncomeSavingsModals } from "./useIncomeSavingsModals";
import {
  computeMultiMonthCategoryRows,
  computeMultiMonthFixedRows,
} from "../utils/dashboardHelpers";
import type { Expense, Category } from "../types";

export function useDashboard(
  expenses: Expense[],
  categories: Category[],
  onBulkDelete: (ids: number[]) => void,
  onSelectionChange?: (active: boolean) => void,
) {
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [mobileEditTrigger, setMobileEditTrigger] = useState<number | null>(
    null,
  );

  const monthNav = useDashboardMonthNav();
  const data = useDashboardData(
    expenses,
    monthNav.selectedYear,
    monthNav.selectedMonth,
    monthNav.monthSpan,
    dataRefreshKey,
  );
  const filters = useDashboardFilters(expenses, data.monthKeys, categories);
  const selection = useDashboardSelection(
    filters.filteredExpenses,
    onBulkDelete,
    onSelectionChange,
  );
  const view = useDashboardView(onSelectionChange, selection.selectedIds);
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
    drilldownExpenses,
    groupedDrilldownExpenses,
    spanVariableTotal,
    mobileEditTrigger,
    refreshData,
    triggerMobileEdit,
    dataRefreshKey,
    setMobileEditTrigger,
  };
}
