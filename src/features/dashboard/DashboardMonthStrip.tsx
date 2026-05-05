import { cn } from "../../utils/cn";
import Strip from "../../components/ui/Strip";
import { getLocalMonthKey } from "../../utils/historicalDataHelpers";
import type { MonthSpan } from "./constants";
import { useHaptics } from "../../hooks/useHaptics";

interface MonthStripItem {
  year: number;
  month: number;
  offset: number;
}

interface DashboardMonthStripProps {
  selectedYear: number;
  selectedMonth: number;
  monthSpan: MonthSpan;
  stripMaxVisible: number;
  monthStrip: MonthStripItem[];
  yearFirstIndices: Map<number, number>;
  monthKeys: Array<{ key: string }>;
  onSelectMonth: (year: number, month: number) => void;
  onJumpBack: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onJumpForward: () => void;
  disableJumpForward: boolean;
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
  onJumpBack,
  onStepBack,
  onStepForward,
  onJumpForward,
  disableJumpForward,
}: DashboardMonthStripProps) {
  const haptics = useHaptics();
  return (
    <Strip
      maxVisible={stripMaxVisible}
      scrollClass="month-strip-scroll"
      scrollSelector="[data-selected='true']"
      selectedKey={`${selectedYear}-${selectedMonth}`}
      align="end"
      onJumpBack={onJumpBack}
      onStepBack={onStepBack}
      onStepForward={onStepForward}
      onJumpForward={onJumpForward}
      disableJumpForward={disableJumpForward}
      jumpBackLabel="Back"
      stepBackLabel="Previous month"
      stepForwardLabel="Next month"
      jumpForwardLabel="Current month"
    >
      {monthStrip.map(({ year, month }, index) => {
        const isSelected = year === selectedYear && month === selectedMonth;
        const pillKey = `${year}-${String(month + 1).padStart(2, "0")}`;
        const isRealCurrent = pillKey === getLocalMonthKey();
        const isInSpan =
          monthSpan > 1 && monthKeys.some((mk) => mk.key === pillKey);
        const monthName = new Date(year, month).toLocaleString("default", {
          month: "short",
        });
        const isFirstOfYear = yearFirstIndices.get(year) === index;

        const handleClick = () => {
          if (!isSelected) {
            haptics.selection();
            onSelectMonth(year, month);
          }
        };

        return (
          <div
            key={`${year}-${month}`}
            className="month-strip-item"
            data-selected={isSelected || undefined}
          >
            <span
              className={cn("year-label", !isFirstOfYear && "invisible")}
            >
              {year}
            </span>
            <button
              onClick={handleClick}
              className={cn(
                "month-pill motion-safe:active:scale-[0.98]",
                (isSelected || isInSpan) && "month-pill-selected",
                !isSelected &&
                  !isInSpan &&
                  isRealCurrent &&
                  "month-pill-current",
              )}
              aria-label={`${monthName} ${year}`}
              aria-current={isSelected ? "date" : undefined}
            >
              <span
                className={cn(!isSelected && isInSpan && "opacity-70")}
              >
                {monthName}
              </span>
            </button>
          </div>
        );
      })}
    </Strip>
  );
}
