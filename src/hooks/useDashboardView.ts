import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import {
  DASHBOARD_VIEWS,
  DASHBOARD_QUERY_PARAMS,
} from "../features/dashboard/constants";
import type { DashboardView } from "../features/dashboard/constants";
import { parseViewParam } from "../utils/urlParams";

export function useDashboardView(
  onSelectionChange?: (active: boolean) => void,
  selectedIds?: Set<number>,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const viewMode = parseViewParam(searchParams.get(DASHBOARD_QUERY_PARAMS.VIEW));

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

  useEffect(() => {
    scrollableRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    if (!viewAnimation) return;
    const timer = setTimeout(() => setViewAnimation(null), 250);
    return () => clearTimeout(timer);
  }, [viewAnimation]);

  useEffect(() => {
    if (drilldownCategory && drilldownRef.current) {
      drilldownRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [drilldownCategory, drilldownCategoryMonthIndex]);

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

  const setViewMode = useCallback(
    (next: DashboardView, animation: "slide-left" | "slide-right") => {
      setViewAnimation(animation);
      setSearchParams(
        (currentParams) => {
          const nextParams = new URLSearchParams(currentParams);
          nextParams.set(DASHBOARD_QUERY_PARAMS.VIEW, next);
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

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
        setViewMode(DASHBOARD_VIEWS.EXPENSES, "slide-right");
      } else if (deltaX > 0 && viewMode === DASHBOARD_VIEWS.EXPENSES) {
        setViewMode(DASHBOARD_VIEWS.CATEGORIES, "slide-left");
      }
      setTouchStartX(null);
    },
    [touchStartX, hasHorizontalOverflow, viewMode, setViewMode],
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
    setViewMode(DASHBOARD_VIEWS.CATEGORIES, "slide-left");
  }, [setViewMode]);

  const switchToExpenses = useCallback(() => {
    setViewMode(DASHBOARD_VIEWS.EXPENSES, "slide-right");
  }, [setViewMode]);

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
