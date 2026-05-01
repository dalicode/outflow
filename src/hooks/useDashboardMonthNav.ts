import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useViewportWidth } from "./useViewportWidth";
import { useMaxVisible } from "./useMaxVisible";
import {
  VIEWPORT_THRESHOLDS,
  MONTH_SPANS,
} from "../features/dashboard/constants";

export function useDashboardMonthNav() {
  const [searchParams] = useSearchParams();
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(
    () => parseInt(searchParams.get("year") || "", 10) || now.getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const m = parseInt(searchParams.get("month") || "", 10);
    return isNaN(m) ? now.getMonth() : m;
  });

  const [monthSpan, setMonthSpan] = useState<1 | 2 | 3 | 6 | 12>(1);
  const [showGrandTotal, setShowGrandTotal] = useState(false);

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

  // Auto-downgrade span on resize
  useEffect(() => {
    const target = isSpanSelectorVisible ? maxAvailableSpan : 1;
    if (monthSpan > target) {
      setMonthSpan(target as 1 | 2 | 3 | 6 | 12);
    }
  }, [monthSpan, maxAvailableSpan, isSpanSelectorVisible]);

  const navigateToMonth = useCallback((year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  }, []);

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

  const isAtCurrentMonth =
    selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const selectedMonthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

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
    setSelectedYear,
    setSelectedMonth,
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
