import Strip from '../../components/ui/Strip'
import { useHaptics } from '../../hooks/useHaptics'
import { cn } from '../../utils/cn'

interface YearStripProps {
  /** The year the strip is currently positioned at (for chevron step back/forward) */
  year: number
  currentYear: number
  maxVisible: number
  /** Only these years are shown as pills */
  availableYears: number[]
  onYearChange: (year: number) => void
  /** Set of years currently visible in the brush window */
  activeYears?: Set<number>
}

export default function YearStrip({
  year,
  currentYear,
  maxVisible,
  availableYears,
  onYearChange,
  activeYears,
}: YearStripProps) {
  const haptics = useHaptics()

  const sorted = [...availableYears].sort((a, b) => a - b)
  const minYear = sorted[0] ?? currentYear
  const maxYear = sorted[sorted.length - 1] ?? currentYear

  const canGoBack = year > minYear
  const canGoForward = year < maxYear

  const visibleCount = Math.min(maxVisible, sorted.length)
  const multipleActive = activeYears && activeYears.size > 1

  return (
    <Strip
      maxVisible={visibleCount}
      scrollClass="year-strip-scroll"
      scrollSelector="[data-selected='true']"
      selectedKey={year}
      smoothScrollThreshold={200}
      scrollMode="nearest"
      itemWidth={56}
      onCurrent={() => {
        if (year !== currentYear) onYearChange(currentYear)
      }}
      onStepBack={() => {
        if (!canGoBack) return
        const idx = sorted.indexOf(year)
        const prev = sorted[idx - 1]
        if (prev != null) onYearChange(prev)
      }}
      onStepForward={() => {
        if (!canGoForward) return
        const idx = sorted.indexOf(year)
        const next = sorted[idx + 1]
        if (next != null) onYearChange(next)
      }}
      disableCurrent={year === currentYear}
      currentLabel="Current year"
      disableStepBack={!canGoBack}
      disableStepForward={!canGoForward}
      stepBackLabel="Previous year"
      stepForwardLabel="Next year"
      spanSelector={multipleActive ? '.year-pill-selected' : undefined}
    >
      {sorted.map((y) => {
        const isActive = activeYears ? activeYears.has(y) : y === year
        const isCurrent = y === currentYear
        return (
          <div key={y} className="year-strip-item" data-selected={isActive || undefined}>
            <button
              onClick={() => {
                haptics.selection()
                onYearChange(y)
              }}
              className={cn(
                'year-pill motion-safe:active:scale-[0.98]',
                isActive && 'year-pill-selected',
                !isActive && isCurrent && 'year-pill-current',
              )}
              aria-label={String(y)}
              aria-current={isActive ? 'date' : undefined}
            >
              {y}
            </button>
          </div>
        )
      })}
    </Strip>
  )
}
