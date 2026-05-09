import { useState, useEffect, useRef, useCallback } from "react";
import { DASHBOARD_VIEWS } from "../features/dashboard/constants";
import type { DashboardView } from "../features/dashboard/constants";
import { triggerHaptic } from "../utils/haptics";
import { useSettings } from "../context/settingsContext";

export function useDashboardView(
  _onSelectionChange?: (active: boolean) => void,
  _selectedIds?: Set<number>,
  initialViewMode?: DashboardView,
  onViewModeChange?: (v: DashboardView) => void,
  monthSpan?: number,
) {
  const { settings } = useSettings();
  const hapticsEnabled = settings.hapticsEnabled;
  const [viewMode, setViewModeState] = useState<DashboardView>(
    initialViewMode ?? DASHBOARD_VIEWS.CATEGORIES,
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

  const [drilldownPayee, setDrilldownPayee] = useState<string | null>(null);
  const [drilldownPayeeMonthIndex, setDrilldownPayeeMonthIndex] =
    useState<number>(0);

  // Reset drilldowns when monthSpan changes — indices may be out-of-bounds
  // on the newly-sized monthKeys array (e.g. switching 12M → 6M).
  useEffect(() => {
    setDrilldownCategory(null);
    setDrilldownCategoryMonthIndex(0);
    setDrilldownPayee(null);
    setDrilldownPayeeMonthIndex(0);
  }, [monthSpan]);

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
      setViewModeState(next);
      onViewModeChange?.(next);
      triggerHaptic("selection", hapticsEnabled);
    },
    [onViewModeChange, hapticsEnabled],
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

      if (deltaX < 0) {
        if (viewMode === DASHBOARD_VIEWS.CATEGORIES) {
          setViewMode(DASHBOARD_VIEWS.PAYEES, "slide-right");
        } else if (viewMode === DASHBOARD_VIEWS.PAYEES) {
          setViewMode(DASHBOARD_VIEWS.EXPENSES, "slide-right");
        }
      } else if (deltaX > 0) {
        if (viewMode === DASHBOARD_VIEWS.EXPENSES) {
          setViewMode(DASHBOARD_VIEWS.PAYEES, "slide-left");
        } else if (viewMode === DASHBOARD_VIEWS.PAYEES) {
          setViewMode(DASHBOARD_VIEWS.CATEGORIES, "slide-left");
        }
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

  const handlePayeeClick = useCallback(
    (name: string, monthIndex: number) => {
      if (
        drilldownPayee === name &&
        drilldownPayeeMonthIndex === monthIndex
      ) {
        setDrilldownPayee(null);
      } else {
        setDrilldownPayee(name);
        setDrilldownPayeeMonthIndex(monthIndex);
      }
    },
    [drilldownPayee, drilldownPayeeMonthIndex],
  );

  const closePayeeDrilldown = useCallback(() => {
    setDrilldownPayee(null);
  }, []);

  const switchToCategories = useCallback(() => {
    setViewMode(DASHBOARD_VIEWS.CATEGORIES, "slide-left");
  }, [setViewMode]);

  const switchToPayees = useCallback(() => {
    setViewMode(
      DASHBOARD_VIEWS.PAYEES,
      viewMode === DASHBOARD_VIEWS.CATEGORIES ? "slide-right" : "slide-left",
    );
  }, [setViewMode, viewMode]);

  const switchToExpenses = useCallback(() => {
    setViewMode(DASHBOARD_VIEWS.EXPENSES, "slide-right");
  }, [setViewMode]);

  // Expose setViewMode for external callers (e.g. Navbar cycle)
  const setView = useCallback(
    (next: DashboardView) => {
      const order = [
        DASHBOARD_VIEWS.CATEGORIES,
        DASHBOARD_VIEWS.PAYEES,
        DASHBOARD_VIEWS.EXPENSES,
      ];
      const currentIdx = order.indexOf(viewMode);
      const nextIdx = order.indexOf(next);
      const animation = nextIdx > currentIdx ? "slide-right" : "slide-left";
      setViewMode(next, animation);
    },
    [viewMode, setViewMode],
  );

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
    drilldownPayee,
    drilldownPayeeMonthIndex,
    handlePayeeClick,
    closePayeeDrilldown,
    switchToCategories,
    switchToPayees,
    switchToExpenses,
    setView,
  };
}
