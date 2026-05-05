import { useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useViewportWidth } from "./useViewportWidth";
import { useMaxVisible } from "./useMaxVisible";
import { usePersistedToggle } from "./usePersistedToggle";
import {
  VIEWPORT_THRESHOLDS,
  MONTH_SPANS,
  DASHBOARD_QUERY_PARAMS,
  STORAGE_KEYS,
} from "../features/dashboard/constants";
import type { MonthSpan } from "../features/dashboard/constants";
import {
  parseMonthParam,
  parseSpanParam,
  monthKeyToParts,
  partsToMonthKey,
} from "../utils/urlParams";

let didHandleInitialDashboardReload = false;

function isReloadNavigation(): boolean {
  if (typeof window === "undefined") return false;

  const navigationEntry = window.performance
    .getEntriesByType("navigation")
    .at(0) as PerformanceNavigationTiming | undefined;

  if (navigationEntry) {
    return navigationEntry.type === "reload";
  }

  return window.performance.navigation?.type === 1;
}

export function useDashboardMonthNav() {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthKey = parseMonthParam(
    searchParams.get(DASHBOARD_QUERY_PARAMS.MONTH),
    currentMonthKey,
  );
  const { year: selectedYear, month: selectedMonth } = monthKeyToParts(monthKey);

  const monthSpan = parseSpanParam(
    searchParams.get(DASHBOARD_QUERY_PARAMS.SPAN),
  );

  const [showGrandTotal, setShowGrandTotal] = usePersistedToggle(
    STORAGE_KEYS.SHOW_GRAND_TOTAL,
    false,
  );

  const viewportWidth = useViewportWidth();
  const maxVisible = useMaxVisible(viewportWidth);
  const stripMaxVisible = maxVisible + (monthSpan > 3 ? monthSpan * 2 : 0);

  const isSpanSelectorVisible = viewportWidth >= VIEWPORT_THRESHOLDS[1];

  const maxAvailableSpan = useMemo(() => {
    const allowed = MONTH_SPANS.filter(
      (n) => viewportWidth >= VIEWPORT_THRESHOLDS[n],
    );
    return allowed.length > 0 ? allowed[allowed.length - 1] : 1;
  }, [viewportWidth]);

  useEffect(() => {
    if (didHandleInitialDashboardReload) return;
    didHandleInitialDashboardReload = true;

    if (!isReloadNavigation()) return;
    if (!searchParams.has(DASHBOARD_QUERY_PARAMS.MONTH)) return;

    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        nextParams.delete(DASHBOARD_QUERY_PARAMS.MONTH);
        return nextParams;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const target = isSpanSelectorVisible ? maxAvailableSpan : 1;
    if (monthSpan > target) {
      setMonthSpan(target as MonthSpan);
    }
  }, [monthSpan, maxAvailableSpan, isSpanSelectorVisible]);

  const navigateToMonth = useCallback(
    (year: number, month: number) => {
      const newKey = partsToMonthKey(year, month);
      setSearchParams(
        (currentParams) => {
          const nextParams = new URLSearchParams(currentParams);
          nextParams.set(DASHBOARD_QUERY_PARAMS.MONTH, newKey);
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const goToPreviousMonth = useCallback(() => {
    if (selectedMonth === 0) {
      navigateToMonth(selectedYear - 1, 11);
    } else {
      navigateToMonth(selectedYear, selectedMonth - 1);
    }
  }, [selectedMonth, selectedYear, navigateToMonth]);

  const goToNextMonth = useCallback(() => {
    if (selectedMonth === 11) {
      navigateToMonth(selectedYear + 1, 0);
    } else {
      navigateToMonth(selectedYear, selectedMonth + 1);
    }
  }, [selectedMonth, selectedYear, navigateToMonth]);

  const jumpBackMonths = useCallback(() => {
    const d = new Date(selectedYear, selectedMonth);
    d.setMonth(d.getMonth() - stripMaxVisible);
    navigateToMonth(d.getFullYear(), d.getMonth());
  }, [selectedYear, selectedMonth, stripMaxVisible, navigateToMonth]);

  const jumpToCurrentMonth = useCallback(() => {
    const today = new Date();
    navigateToMonth(today.getFullYear(), today.getMonth());
  }, [navigateToMonth]);

  const setMonthSpan = useCallback(
    (span: MonthSpan) => {
      setSearchParams(
        (currentParams) => {
          const nextParams = new URLSearchParams(currentParams);
          nextParams.set(DASHBOARD_QUERY_PARAMS.SPAN, String(span));
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const isAtCurrentMonth =
    selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const selectedMonthKey = monthKey;

  const monthStrip = useMemo(() => {
    const months = [];
    const center = new Date(selectedYear, selectedMonth);
    const half = 100;
    for (let i = -half; i <= half; i++) {
      const d = new Date(center);
      d.setMonth(d.getMonth() + i);
      months.push({ year: d.getFullYear(), month: d.getMonth(), offset: i });
    }
    return months;
  }, [selectedYear, selectedMonth]);

  const yearFirstIndices = useMemo(() => {
    const map = new Map<number, number>();
    monthStrip.forEach((m, i) => {
      if (!map.has(m.year)) map.set(m.year, i);
    });
    return map;
  }, [monthStrip]);

  return {
    selectedYear,
    selectedMonth,
    monthSpan,
    showGrandTotal,
    stripMaxVisible,
    isSpanSelectorVisible,
    isAtCurrentMonth,
    selectedMonthKey,
    monthStrip,
    yearFirstIndices,
    setSelectedYear: undefined as unknown as (y: number) => void,
    setSelectedMonth: undefined as unknown as (m: number) => void,
    setMonthSpan,
    setShowGrandTotal,
    goToPreviousMonth,
    goToNextMonth,
    jumpBackMonths,
    jumpToCurrentMonth,
    navigateToMonth,
    viewportWidth,
  };
}
