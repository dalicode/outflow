import { useState, useMemo, useCallback } from "react";
import { useAnalyticsData } from "./useAnalyticsData";
import type { Expense, Category } from "../types";

export interface AnalyticsSessionState {
  year: number;
  trendMonth: number | null;
  trendDrilldown: boolean;
}

interface UseAnalyticsParams {
  expenses: Expense[];
  categories: Category[];
  sessionState?: AnalyticsSessionState;
  onSessionStateChange?: (patch: Partial<AnalyticsSessionState>) => void;
}

export function useAnalytics({
  expenses,
  categories,
  sessionState,
  onSessionStateChange,
}: UseAnalyticsParams) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [year, setYearState] = useState(sessionState?.year ?? currentYear);

  const setYear = useCallback((newYear: number | ((prev: number) => number)) => {
    setYearState((prev) => {
      const next = typeof newYear === "function" ? newYear(prev) : newYear;
      onSessionStateChange?.({
        year: next,
        trendMonth: null,
        trendDrilldown: false,
      });
      return next;
    });
  }, [onSessionStateChange]);

  const data = useAnalyticsData({ expenses, categories, year });
  const prev1Data = useAnalyticsData({ expenses, categories, year: year - 1 });
  const prev2Data = useAnalyticsData({ expenses, categories, year: year - 2 });
  const prev3Data = useAnalyticsData({ expenses, categories, year: year - 3 });

  const multiYearData = useMemo(
    () => [prev3Data, prev2Data, prev1Data, data],
    [prev3Data, prev2Data, prev1Data, data],
  );

  const lastMonth =
    year === currentYear ? currentMonth : year < currentYear ? 11 : -1;

  const canGoForward = year < currentYear;

  const handleYearChange = useCallback((newYear: number) => {
    setYear(newYear);
    onSessionStateChange?.({
      year: newYear,
      trendMonth: null,
      trendDrilldown: false,
    });
  }, [setYear, onSessionStateChange]);

  return {
    year,
    handleYearChange,
    currentYear,
    currentMonth,
    canGoForward,
    lastMonth,
    data,
    multiYearData,
    trendMonth: sessionState?.trendMonth ?? null,
    trendDrilldown: sessionState?.trendDrilldown ?? false,
  };
}
