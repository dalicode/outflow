import { cn } from '../../utils/cn'
import type { DashboardView } from './constants'
import { DASHBOARD_VIEWS } from './constants'

interface DashboardViewTabsProps {
  viewMode: DashboardView
  activeFilterCount: number
  hasCategoryFilter: boolean
  onSwitchToCategories: () => void
  onSwitchToPayees: () => void
  onSwitchToExpenses: () => void
  onOpenFilters: () => void
  onResetCategoryFilter: () => void
  monthSpan: number
}

export default function DashboardViewTabs({
  viewMode,
  activeFilterCount,
  onSwitchToCategories,
  onSwitchToPayees,
  onSwitchToExpenses,
  onOpenFilters,
  monthSpan,
}: DashboardViewTabsProps) {
  return (
    <div
      className={cn(
        'shrink-0 mx-auto px-4 w-full z-10',
        viewMode !== DASHBOARD_VIEWS.EXPENSES && monthSpan === 12 ? 'max-w-[120rem]' : 'max-w-7xl',
      )}
    >
      <div
        className={cn(
          'w-full mx-auto',
          (monthSpan <= 3 || viewMode === DASHBOARD_VIEWS.EXPENSES) && 'md:max-w-3xl',
          viewMode !== DASHBOARD_VIEWS.EXPENSES && monthSpan === 6 && 'md:max-w-6xl',
          viewMode !== DASHBOARD_VIEWS.EXPENSES && monthSpan === 12 && 'md:max-w-none',
        )}
      >
        <div className="flex items-end justify-between px-3.5 sm:px-5">
          <div className="flex gap-0.5">
            <button
              onClick={onSwitchToCategories}
              data-testid="view-tab-categories"
              className={cn(
                'relative px-3 py-1 rounded-t-theme-medium border border-b-0 text-xs font-medium transition-[background-color,color,transform,box-shadow,border-color] duration-150',
                'motion-safe:active:scale-[0.98]',
                viewMode === DASHBOARD_VIEWS.CATEGORIES
                  ? 'z-10 -mb-px bg-theme-surface text-theme-text border-theme-border'
                  : 'bg-theme-background text-theme-muted border-transparent hover:text-theme-text',
              )}
            >
              Categories
            </button>
            <button
              onClick={onSwitchToPayees}
              data-testid="view-tab-payees"
              className={cn(
                'relative px-3 py-1 rounded-t-theme-medium border border-b-0 text-xs font-medium transition-[background-color,color,transform,box-shadow,border-color] duration-150',
                'motion-safe:active:scale-[0.98]',
                viewMode === DASHBOARD_VIEWS.PAYEES
                  ? 'z-10 -mb-px bg-theme-surface text-theme-text border-theme-border'
                  : 'bg-theme-background text-theme-muted border-transparent hover:text-theme-text',
              )}
            >
              Payees
            </button>
            <button
              onClick={onSwitchToExpenses}
              data-testid="view-tab-expenses"
              className={cn(
                'relative px-3 py-1 rounded-t-theme-medium border border-b-0 text-xs font-medium transition-[background-color,color,transform,box-shadow,border-color] duration-150',
                'motion-safe:active:scale-[0.98]',
                viewMode === DASHBOARD_VIEWS.EXPENSES
                  ? 'z-10 -mb-px bg-theme-surface text-theme-text border-theme-border'
                  : 'bg-theme-background text-theme-muted border-transparent hover:text-theme-text',
              )}
            >
              Expenses
            </button>
          </div>
          <button
            data-testid="btn-open-filters"
            className={cn(
              'relative text-xs font-medium px-3 py-1 rounded-t-theme-medium border border-b-0 transition-[background-color,color,transform,box-shadow,border-color] duration-150 flex items-center gap-1.5',
              'motion-safe:active:scale-[0.98]',
              activeFilterCount > 0
                ? 'z-10 -mb-px bg-theme-primary-muted text-theme-primary border-theme-border'
                : 'bg-theme-background text-theme-muted border-transparent hover:text-theme-text',
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
  )
}
