import { useState, useMemo } from "react";
import type { Expense, Category, Payee } from "../types";

export function useDashboardFilters(
  expenses: Expense[],
  monthKeys: Array<{ key: string }>,
  categories: Category[],
  payees: Payee[],
) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterGlobal, setFilterGlobal] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterDescription, setFilterDescription] = useState("");
  const [filterAmount, setFilterAmount] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [selectedPayees, setSelectedPayees] = useState<Set<string>>(
    new Set(),
  );

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const getExpenseCategoryName = (exp: Expense) =>
    categoryById[exp.categoryId as number]?.name ?? "Uncategorized";

  const payeeById = useMemo(
    () => Object.fromEntries(payees.map((p) => [p.id, p])),
    [payees],
  );

  const getExpensePayeeName = (exp: Expense) =>
    payeeById[exp.payeeId as number]?.name ?? "—";

  const expensesInSelectedSpan = useMemo(() => {
    const keys = new Set(monthKeys.map((m) => m.key));
    return expenses
      .filter((e) => keys.has(e.date.slice(0, 7)))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses, monthKeys]);

  const filteredExpenses = useMemo(() => {
    let result = expensesInSelectedSpan;

    if (selectedCategories.size > 0) {
      result = result.filter((e) =>
        selectedCategories.has(getExpenseCategoryName(e)),
      );
    }

    if (selectedPayees.size > 0) {
      result = result.filter((e) =>
        selectedPayees.has(getExpensePayeeName(e)),
      );
    }

    if (filterGlobal) {
      const q = filterGlobal.toLowerCase();
      result = result.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          getExpenseCategoryName(e).toLowerCase().includes(q) ||
          getExpensePayeeName(e).toLowerCase().includes(q) ||
          String(e.amount).includes(q),
      );
    }

    if (filterDateFrom) {
      result = result.filter((e) => e.date >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter((e) => e.date <= filterDateTo);
    }

    if (filterDescription) {
      const q = filterDescription.toLowerCase();
      result = result.filter((e) =>
        e.description?.toLowerCase().includes(q),
      );
    }

    if (filterAmount) {
      result = result.filter((e) => String(e.amount).includes(filterAmount));
    }

    return result;
  }, [
    expensesInSelectedSpan,
    selectedCategories,
    selectedPayees,
    getExpenseCategoryName,
    getExpensePayeeName,
    filterGlobal,
    filterDateFrom,
    filterDateTo,
    filterDescription,
    filterAmount,
  ]);

  const activeFilterCount = [
    filterGlobal,
    filterDateFrom,
    filterDateTo,
    selectedCategories.size > 0 ? "categories" : "",
    selectedPayees.size > 0 ? "payees" : "",
    filterDescription,
    filterAmount,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterGlobal("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSelectedCategories(new Set());
    setSelectedPayees(new Set());
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
    filterDescription,
    setFilterDescription,
    filterAmount,
    setFilterAmount,
    selectedCategories,
    setSelectedCategories,
    selectedPayees,
    setSelectedPayees,
    filteredExpenses,
    activeFilterCount,
    clearAllFilters,
    getExpenseCategoryName,
    getExpensePayeeName,
    expensesInSelectedSpan,
  };
}
