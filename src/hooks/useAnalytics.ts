import { useState, useMemo, useCallback } from "react";
import { useAnalyticsData } from "./useAnalyticsData";
import type { Expense, Category } from "../types";

interface UseAnalyticsParams {
  expenses: Expense[];
  categories: Category[];
  formatAmount: (n: number) => string;
}

export function useAnalytics({ expenses, categories, formatAmount }: UseAnalyticsParams) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const data = useAnalyticsData({ expenses, categories, year });

  const canGoForward = year < currentYear;
  const lastMonth =
    year === currentYear ? currentMonth : year < currentYear ? 11 : -1;

  const availableMonths = useMemo(
    () =>
      lastMonth >= 0 ? Array.from({ length: lastMonth + 1 }, (_, i) => i) : [],
    [lastMonth],
  );

  const handleYearChange = useCallback(
    (newYear: number) => {
      setYear(newYear);
      setSelectedMonth(null);
    },
    [],
  );

  const prevMonth = useCallback(() => {
    if (selectedMonth === null) {
      if (lastMonth >= 0) setSelectedMonth(0);
    } else if (selectedMonth > 0) {
      setSelectedMonth(selectedMonth - 1);
    }
  }, [selectedMonth, lastMonth]);

  const nextMonth = useCallback(() => {
    if (selectedMonth === null) {
      if (lastMonth >= 0) setSelectedMonth(0);
    } else if (lastMonth >= 0 && selectedMonth < lastMonth) {
      setSelectedMonth(selectedMonth + 1);
    }
  }, [selectedMonth, lastMonth]);

  const jumpBackMonths = useCallback(() => {
    setSelectedMonth(0);
  }, []);

  const jumpToCurrentMonth = useCallback(() => {
    setYear(currentYear);
    setSelectedMonth(currentMonth);
  }, [currentYear, currentMonth]);

  const isAtCurrentMonth = year === currentYear && selectedMonth === currentMonth;

  const canPrevMonth =
    selectedMonth === null ? lastMonth >= 0 : selectedMonth > 0;
  const canNextMonth =
    selectedMonth === null
      ? lastMonth >= 0
      : lastMonth >= 0 && selectedMonth < lastMonth;

  const yearStrip = useMemo(() => {
    const years = [];
    for (let i = -50; i <= 1; i++) {
      years.push(year + i);
    }
    return years;
  }, [year]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Income",
        value: formatAmount(data.yearTotalIncome),
        tone: "success" as const,
      },
      {
        label: "Total Fixed",
        value: formatAmount(data.yearFixedTotal),
        tone: "danger" as const,
      },
      {
        label: "Total Savings",
        value: formatAmount(data.yearSavings),
        tone:
          data.yearSavings >= 0 ? ("success" as const) : ("danger" as const),
      },
      {
        label: "Total Remaining",
        value: formatAmount(data.yearRemaining),
        tone:
          data.yearRemaining >= 0
            ? ("success" as const)
            : ("danger" as const),
      },
    ],
    [data, formatAmount],
  );

  return {
    year,
    selectedMonth,
    setSelectedMonth,
    handleYearChange,
    currentYear,
    currentMonth,
    canGoForward,
    lastMonth,
    availableMonths,
    prevMonth,
    nextMonth,
    jumpBackMonths,
    jumpToCurrentMonth,
    isAtCurrentMonth,
    canPrevMonth,
    canNextMonth,
    yearStrip,
    summaryCards,
    data,
  };
}
