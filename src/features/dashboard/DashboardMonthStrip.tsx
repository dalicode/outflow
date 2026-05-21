import Strip from '../../components/ui/Strip'
import { useHaptics } from '../../hooks/useHaptics'
import { cn } from '../../utils/cn'
import { getLocalMonthKey } from '../../utils/historicalDataHelpers'
import type { MonthSpan } from './constants'

interface MonthStripItem {
  year: number
  month: number
  offset: number
}

interface DashboardMonthStripProps {
  selectedYear: number
  selectedMonth: number
  monthSpan: MonthSpan
  stripMaxVisible: number
  monthStrip: MonthStripItem[]
  yearFirstIndices: Map<number, number>
  monthKeys: Array<{ key: string }>
  onSelectMonth: (year: number, month: number) => void
  onCurrent: () => void
  onStepBack: () => void
  onStepForward: () => void
  disableCurrent: boolean
}

export default function DashboardMonthStrip({
  selectedYear,
  selectedMonth,
  monthSpan,
  stripMaxVisible,
  monthStrip,
  yearFirstIndices,
  monthKeys,
  onSelectMonth,
  onCurrent,
  onStepBack,
  onStepForward,
  disableCurrent,
}: DashboardMonthStripProps) {
  const haptics = useHaptics()

  return (
    <Strip
      maxVisible={stripMaxVisible}
      scrollClass="month-strip-scroll"
      scrollSelector="[data-selected='true']"
      selectedKey={`${selectedYear}-${selectedMonth}`}
      align="end"
      onCurrent={onCurrent}
      onStepBack={onStepBack}
      onStepForward={onStepForward}
      disableCurrent={disableCurrent}
      currentLabel="Current month"
      stepBackLabel="Previous month"
      stepForwardLabel="Next month"
      spanSelector={monthSpan > 1 ? '.month-pill-span-active' : undefined}
    >
      {monthStrip.map(({ year, month }, index) => {
        const isSelected = year === selectedYear && month === selectedMonth
        const pillKey = `${year}-${String(month + 1).padStart(2, '0')}`
        const isRealCurrent = pillKey === getLocalMonthKey()
        const isInSpan = monthSpan > 1 && monthKeys.some((mk) => mk.key === pillKey)
        const monthName = new Date(year, month).toLocaleString('default', {
          month: 'short',
        })
        const isFirstOfYear = yearFirstIndices.get(year) === index

        const handleClick = () => {
          if (!isSelected) {
            haptics.selection()
            onSelectMonth(year, month)
          }
        }

        return (
          <div
            key={`${year}-${month}`}
            className="month-strip-item"
            data-selected={isSelected || undefined}
          >
            <span className={cn('year-label', !isFirstOfYear && 'invisible')}>{year}</span>
            <button
              onClick={handleClick}
              className={cn(
                'month-pill motion-safe:active:scale-[0.98]',
                monthSpan > 1
                  ? isInSpan && 'month-pill-span-active'
                  : isSelected && 'month-pill-selected',
                !isSelected && !isInSpan && isRealCurrent && 'month-pill-current',
              )}
              aria-label={`${monthName} ${year}`}
              aria-current={isSelected ? 'date' : undefined}
            >
              <span>{monthName}</span>
            </button>
          </div>
        )
      })}
    </Strip>
  )
}
