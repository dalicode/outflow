import { cn } from "../../utils/cn";
import { DASHBOARD_VIEWS } from "./constants";
import type { DashboardView } from "./constants";

interface DashboardViewTabsProps {
  viewMode: DashboardView;
  activeFilterCount: number;
  hasCategoryFilter: boolean;
  onSwitchToCategories: () => void;
  onSwitchToExpenses: () => void;
  onOpenFilters: () => void;
  onResetCategoryFilter: () => void;
  monthSpan: number;
}

export default function DashboardViewTabs({
  viewMode,
  activeFilterCount,
  onSwitchToCategories,
  onSwitchToExpenses,
  onOpenFilters,
  monthSpan,
}: DashboardViewTabsProps) {
  return (
    <div
      className={cn(
        "shrink-0 mx-auto px-4 w-full",
        monthSpan === 12 ? "max-w-none" : "max-w-7xl",
      )}
    >
      <div
        className={cn(
          "w-full mx-auto",
          monthSpan <= 3 && "md:max-w-3xl",
          monthSpan === 6 && "md:max-w-6xl",
          monthSpan === 12 && "md:max-w-none",
        )}
      >
        <div className="flex items-end justify-between px-6">
          <div className="flex gap-0.5">
            <button
              onClick={onSwitchToCategories}
              className={cn(
                "px-3 py-1 rounded-t-md text-xs font-medium transition-colors",
                viewMode === DASHBOARD_VIEWS.CATEGORIES
                  ? "bg-theme-surface text-theme-text"
                  : "bg-theme-background text-theme-muted hover:text-theme-text",
              )}
            >
              Categories
            </button>
            <button
              onClick={onSwitchToExpenses}
              className={cn(
                "px-3 py-1 rounded-t-md text-xs font-medium transition-colors",
                viewMode === DASHBOARD_VIEWS.EXPENSES
                  ? "bg-theme-surface text-theme-text"
                  : "bg-theme-background text-theme-muted hover:text-theme-text",
              )}
            >
              Expenses
            </button>
          </div>
          <button
            className={cn(
              "text-xs font-medium px-3 py-1 rounded-t-md transition-colors flex items-center gap-1.5",
              activeFilterCount > 0
                ? "bg-theme-primary/10 text-theme-primary"
                : "bg-theme-background text-theme-muted hover:text-theme-text",
            )}
            onClick={onOpenFilters}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full bg-theme-primary text-white text-[0.625rem] font-semibold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
