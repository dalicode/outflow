import { useState, useMemo, useCallback } from "react";
import { useAnalyticsData } from "./useAnalyticsData";
import type { Expense, Category } from "../types";

export interface AnalyticsSessionState {
  year: number;
  selectedMonth: number | null;
}

interface UseAnalyticsParams {
  expenses: Expense[];
  categories: Category[];
  formatAmount: (n: number) => string;
  sessionState?: AnalyticsSessionState;
  onSessionStateChange?: (patch: Partial<AnalyticsSessionState>) => void;
}

export function useAnalytics({
  expenses,
  categories,
  formatAmount,
  sessionState,
  onSessionStateChange,
}: UseAnalyticsParams) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [year, setYearState] = useState(sessionState?.year ?? currentYear);
  const [selectedMonth, setSelectedMonthState] = useState<number | null>(
    sessionState?.selectedMonth ?? null,
  );

  const setYear = useCallback((newYear: number | ((prev: number) => number)) => {
    setYearState((prev) => {
      const next = typeof newYear === "function" ? newYear(prev) : newYear;
      onSessionStateChange?.({ year: next });
      return next;
    });
  }, [onSessionStateChange]);

  const setSelectedMonth = useCallback((m: number | null) => {
    setSelectedMonthState(m);
    onSessionStateChange?.({ selectedMonth: m });
  }, [onSessionStateChange]);

  const data = useAnalyticsData({ expenses, categories, year });

  const lastMonth =
    year === currentYear ? currentMonth : year < currentYear ? 11 : -1;

  const canGoForward = year < currentYear;

  const availableMonths = useMemo(
    () =>
      lastMonth >= 0 ? Array.from({ length: lastMonth + 1 }, (_, i) => i) : [],
    [lastMonth],
  );

  const handleYearChange = useCallback((newYear: number) => {
    setYear(newYear);
    setSelectedMonth(null);
  }, [setYear, setSelectedMonth]);

  const prevMonth = useCallback(() => {
    if (selectedMonth === null) {
      if (lastMonth >= 0) setSelectedMonth(0);
    } else if (selectedMonth > 0) {
      setSelectedMonth(selectedMonth - 1);
    }
  }, [selectedMonth, lastMonth, setSelectedMonth]);

  const nextMonth = useCallback(() => {
    if (selectedMonth === null) {
      if (lastMonth >= 0) setSelectedMonth(0);
    } else if (lastMonth >= 0 && selectedMonth < lastMonth) {
      setSelectedMonth(selectedMonth + 1);
    }
  }, [selectedMonth, lastMonth, setSelectedMonth]);

  const jumpBackMonths = useCallback(() => {
    setYear((y) => y - 1);
    setSelectedMonth(null);
  }, [setYear, setSelectedMonth]);

  const jumpToCurrentMonth = useCallback(() => {
    setYear(currentYear);
    setSelectedMonth(currentMonth);
  }, [currentYear, currentMonth, setYear, setSelectedMonth]);

  const isAtCurrentMonth =
    year === currentYear && selectedMonth === currentMonth;

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
        label: year === currentYear ? "YTD Income" : "Total Income",
        value: formatAmount(data.yearTotalIncome),
        tone: "success" as const,
      },
      {
        label: year === currentYear ? "YTD Fixed" : "Total Fixed",
        value: formatAmount(data.yearFixedTotal),
        tone: "danger" as const,
      },
      {
        label: year === currentYear ? "YTD Savings" : "Total Savings",
        value: formatAmount(data.yearSavings + data.yearRemaining),
        tone:
          data.yearSavings + data.yearRemaining >= 0
            ? ("success" as const)
            : ("danger" as const),
      },
      {
        label: year === currentYear ? "YTD Expenses" : "Total Expenses",
        value: formatAmount(data.yearVariableTotal),
        tone:
          data.yearVariableTotal >= 0
            ? ("danger" as const)
            : ("success" as const),
      },
    ],
    [data, formatAmount, year, currentYear],
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
