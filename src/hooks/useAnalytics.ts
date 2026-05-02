import { useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAnalyticsData } from "./useAnalyticsData";
import { ANALYTICS_QUERY_PARAMS } from "../features/dashboard/constants";
import { parseYearParam, parseAnalyticsMonthParam } from "../utils/urlParams";
import type { Expense, Category } from "../types";

interface UseAnalyticsParams {
  expenses: Expense[];
  categories: Category[];
  formatAmount: (n: number) => string;
}

export function useAnalytics({
  expenses,
  categories,
  formatAmount,
}: UseAnalyticsParams) {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const year = parseYearParam(
    searchParams.get(ANALYTICS_QUERY_PARAMS.YEAR),
    currentYear,
  );

  const data = useAnalyticsData({ expenses, categories, year });

  const lastMonth =
    year === currentYear ? currentMonth : year < currentYear ? 11 : -1;

  const selectedMonth = parseAnalyticsMonthParam(
    searchParams.get(ANALYTICS_QUERY_PARAMS.MONTH),
    lastMonth,
  );

  const canGoForward = year < currentYear;

  const availableMonths = useMemo(
    () =>
      lastMonth >= 0 ? Array.from({ length: lastMonth + 1 }, (_, i) => i) : [],
    [lastMonth],
  );

  const setYearAndMonth = useCallback(
    (newYear: number, newMonth: number | null) => {
      setSearchParams(
        (currentParams) => {
          const nextParams = new URLSearchParams(currentParams);
          nextParams.set(ANALYTICS_QUERY_PARAMS.YEAR, String(newYear));
          if (newMonth !== null) {
            nextParams.set(ANALYTICS_QUERY_PARAMS.MONTH, String(newMonth));
          } else {
            nextParams.delete(ANALYTICS_QUERY_PARAMS.MONTH);
          }
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSelectedMonth = useCallback(
    (m: number | null) => {
      setSearchParams(
        (currentParams) => {
          const nextParams = new URLSearchParams(currentParams);
          if (m !== null) {
            nextParams.set(ANALYTICS_QUERY_PARAMS.MONTH, String(m));
          } else {
            nextParams.delete(ANALYTICS_QUERY_PARAMS.MONTH);
          }
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleYearChange = useCallback(
    (newYear: number) => {
      setYearAndMonth(newYear, null);
    },
    [setYearAndMonth],
  );

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
    setYearAndMonth(year - 1, selectedMonth);
  }, [year, selectedMonth, setYearAndMonth]);

  const jumpToCurrentMonth = useCallback(() => {
    if (year < currentYear) {
      setYearAndMonth(year + 1, selectedMonth);
    } else {
      setYearAndMonth(currentYear, currentMonth);
    }
  }, [year, currentYear, currentMonth, selectedMonth, setYearAndMonth]);

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
