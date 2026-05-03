import { useState, useMemo } from "react";
import type { Expense, Category } from "../types";

export function useDashboardFilters(
  expenses: Expense[],
  monthKeys: Array<{ key: string }>,
  categories: Category[],
) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterGlobal, setFilterGlobal] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDescription, setFilterDescription] = useState("");
  const [filterAmount, setFilterAmount] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const getExpenseCategoryName = (exp: Expense) =>
    categoryById[exp.categoryId as number]?.name ?? "Uncategorized";

  const expensesInSelectedSpan = useMemo(() => {
    const keys = new Set(monthKeys.map((m) => m.key));
    return expenses
      .filter((e) => keys.has(e.date.slice(0, 7)))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses, monthKeys]);

  const filteredExpenses = useMemo(() => {
    let result = expensesInSelectedSpan;

    if (selectedCategories.size > 0) {
      result = result.filter((e) => selectedCategories.has(getExpenseCategoryName(e)));
    }

    if (filterGlobal) {
      const q = filterGlobal.toLowerCase();
      result = result.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          getExpenseCategoryName(e).toLowerCase().includes(q) ||
          String(e.amount).includes(q),
      );
    }

    if (filterDateFrom) {
      result = result.filter((e) => e.date >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter((e) => e.date <= filterDateTo);
    }

    if (filterCategory) {
      result = result.filter((e) => getExpenseCategoryName(e) === filterCategory);
    }

    if (filterDescription) {
      const q = filterDescription.toLowerCase();
      result = result.filter((e) => e.description?.toLowerCase().includes(q));
    }

    if (filterAmount) {
      result = result.filter((e) => String(e.amount).includes(filterAmount));
    }

    return result;
  }, [
    expensesInSelectedSpan,
    selectedCategories,
    getExpenseCategoryName,
    filterGlobal,
    filterDateFrom,
    filterDateTo,
    filterCategory,
    filterDescription,
    filterAmount,
  ]);

  const activeFilterCount = [
    filterGlobal,
    filterDateFrom,
    filterDateTo,
    filterCategory,
    filterDescription,
    filterAmount,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterGlobal("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterCategory("");
    setFilterDescription("");
    setFilterAmount("");
  };

  return {
    isFilterModalOpen,
    setIsFilterModalOpen,
    filterGlobal,
    setFilterGlobal,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    filterCategory,
    setFilterCategory,
    filterDescription,
    setFilterDescription,
    filterAmount,
    setFilterAmount,
    selectedCategories,
    setSelectedCategories,
    filteredExpenses,
    activeFilterCount,
    clearAllFilters,
    getExpenseCategoryName,
    expensesInSelectedSpan,
  };
}
