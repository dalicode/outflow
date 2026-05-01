import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { DASHBOARD_VIEWS } from "../features/dashboard/constants";
import type { DashboardView } from "../features/dashboard/constants";

export function useDashboardView(
  onSelectionChange?: (active: boolean) => void,
  selectedIds?: Set<number>,
) {
  const location = useLocation();
  const [viewMode, setViewMode] = useState<DashboardView>(
    DASHBOARD_VIEWS.CATEGORIES,
  );
  const [viewAnimation, setViewAnimation] = useState<
    "slide-left" | "slide-right" | null
  >(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
  const swipeAreaRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);

  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(
    null,
  );
  const [drilldownCategoryMonthIndex, setDrilldownCategoryMonthIndex] =
    useState<number>(0);
  const drilldownRef = useRef<HTMLDivElement>(null);

  // Reset scroll on route change
  useEffect(() => {
    scrollableRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  // Clear view animation after it plays
  useEffect(() => {
    if (!viewAnimation) return;
    const timer = setTimeout(() => setViewAnimation(null), 250);
    return () => clearTimeout(timer);
  }, [viewAnimation]);

  // Auto-scroll drilldown into view
  useEffect(() => {
    if (drilldownCategory && drilldownRef.current) {
      drilldownRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [drilldownCategory, drilldownCategoryMonthIndex]);

  // Detect horizontal overflow for swipe disabling
  useEffect(() => {
    const el = swipeAreaRef.current;
    if (!el) return;
    const overflowEl = el.querySelector<HTMLDivElement>(".overflow-x-auto");
    if (overflowEl) {
      setHasHorizontalOverflow(
        overflowEl.scrollWidth > overflowEl.clientWidth,
      );
    }
  }, [viewMode]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea")) return;
    setTouchStartX(e.touches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX === null || hasHorizontalOverflow) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(deltaX) < 80) return;

      if (deltaX < 0 && viewMode === DASHBOARD_VIEWS.CATEGORIES) {
        setViewAnimation("slide-right");
        setViewMode(DASHBOARD_VIEWS.EXPENSES);
      } else if (deltaX > 0 && viewMode === DASHBOARD_VIEWS.EXPENSES) {
        setViewAnimation("slide-left");
        setViewMode(DASHBOARD_VIEWS.CATEGORIES);
      }
      setTouchStartX(null);
    },
    [touchStartX, hasHorizontalOverflow, viewMode],
  );

  const handleCategoryClick = useCallback(
    (name: string, monthIndex: number) => {
      if (
        drilldownCategory === name &&
        drilldownCategoryMonthIndex === monthIndex
      ) {
        setDrilldownCategory(null);
      } else {
        setDrilldownCategory(name);
        setDrilldownCategoryMonthIndex(monthIndex);
      }
    },
    [drilldownCategory, drilldownCategoryMonthIndex],
  );

  const closeDrilldown = useCallback(() => {
    setDrilldownCategory(null);
  }, []);

  const switchToCategories = useCallback(() => {
    setViewAnimation("slide-left");
    setViewMode(DASHBOARD_VIEWS.CATEGORIES);
  }, []);

  const switchToExpenses = useCallback(() => {
    setViewAnimation("slide-right");
    setViewMode(DASHBOARD_VIEWS.EXPENSES);
  }, []);

  return {
    viewMode,
    viewAnimation,
    swipeAreaRef,
    scrollableRef,
    drilldownCategory,
    drilldownCategoryMonthIndex,
    drilldownRef,
    handleTouchStart,
    handleTouchEnd,
    handleCategoryClick,
    closeDrilldown,
    switchToCategories,
    switchToExpenses,
  };
}
