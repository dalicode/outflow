import { cn } from '../../utils/cn'
import type { MonthSpan } from './constants'
import { MONTH_SPANS, VIEWPORT_THRESHOLDS } from './constants'

interface MonthSpanSelectorProps {
  monthSpan: MonthSpan
  showGrandTotal: boolean
  viewportWidth: number
  onSpanChange: (span: MonthSpan) => void
  onToggleGrandTotal: () => void
}

export default function MonthSpanSelector({
  monthSpan,
  showGrandTotal,
  viewportWidth,
  onSpanChange,
  onToggleGrandTotal,
}: MonthSpanSelectorProps) {
  const isVisible = viewportWidth >= VIEWPORT_THRESHOLDS[1]
  if (!isVisible) return null

  return (
    <div className="flex justify-center">
      <div className="flex gap-1 bg-theme-background rounded-theme-medium p-0.5">
        {MONTH_SPANS.filter((n) => viewportWidth >= VIEWPORT_THRESHOLDS[n]).map((n) => (
          <button
            key={n}
            onClick={() => onSpanChange(n)}
            data-testid={`span-${n}m`}
            className={cn(
              'dashboard-tab motion-safe:active:scale-[0.98]',
              monthSpan === n && 'dashboard-tab-active',
            )}
          >
            {n}M
          </button>
        ))}
        {monthSpan > 1 && (
          <button
            onClick={onToggleGrandTotal}
            className={cn(
              'dashboard-tab motion-safe:active:scale-[0.98]',
              showGrandTotal && 'dashboard-tab-active',
            )}
          >
            Total
          </button>
        )}
      </div>
    </div>
  )
}
