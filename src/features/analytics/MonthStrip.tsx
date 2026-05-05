import { cn } from "../../utils/cn";
import Strip from "../../components/ui/Strip";
import { useHaptics } from "../../hooks/useHaptics";

interface MonthStripProps {
  year: number;
  currentYear: number;
  currentMonth: number;
  selectedMonth: number | null;
  maxVisible: number;
  availableMonths: number[];
  onSelectMonth: (month: number | null) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onJumpBack: () => void;
  onJumpForward: () => void;
  canPrevMonth: boolean;
  canNextMonth: boolean;
  isAtCurrentMonth: boolean;
}

export default function MonthStrip({
  year,
  currentYear,
  currentMonth,
  selectedMonth,
  maxVisible,
  availableMonths,
  onSelectMonth,
  onPrevMonth,
  onNextMonth,
  onJumpBack,
  onJumpForward,
  canPrevMonth,
  canNextMonth,
  isAtCurrentMonth,
}: MonthStripProps) {
  const haptics = useHaptics();
  const scrollTarget = selectedMonth === null ? "yr" : selectedMonth;
  const scrollSelector = `[data-month="${scrollTarget}"]`;

  return (
    <Strip
      maxVisible={maxVisible}
      scrollClass="month-strip-scroll"
      scrollSelector={scrollSelector}
      selectedKey={`${year}-${scrollTarget}`}
      align="end"
      onJumpBack={onJumpBack}
      onStepBack={onPrevMonth}
      onStepForward={onNextMonth}
      onJumpForward={onJumpForward}
      disableJumpBack={year <= 1}
      disableStepBack={!canPrevMonth || selectedMonth === null}
      disableStepForward={!canNextMonth}
      disableJumpForward={isAtCurrentMonth}
      jumpBackLabel="Back"
      stepBackLabel="Previous month"
      stepForwardLabel="Next month"
      jumpForwardLabel="Current month"
      beforeScroll={
        <div className="month-strip-item" data-month="yr">
          <span className="year-label">{year}</span>
          <button
            onClick={() => {
              haptics.selection();
              onSelectMonth(null);
            }}
            className={cn(
              "month-pill motion-safe:active:scale-[0.98]",
              selectedMonth === null && "month-pill-selected",
            )}
            aria-label="Year overview"
          >
            Yr
          </button>
        </div>
      }
    >
      {availableMonths.map((monthIdx) => {
        const isSelected = selectedMonth === monthIdx;
        const isRealCurrent =
          year === currentYear && monthIdx === currentMonth;
        const monthName = new Date(year, monthIdx).toLocaleString("default", {
          month: "short",
        });
        return (
          <div
            key={monthIdx}
            className="month-strip-item"
            data-month={monthIdx}
          >
            <span className="year-label invisible">{year}</span>
            <button
              onClick={() => {
                haptics.selection();
                onSelectMonth(monthIdx);
              }}
              className={cn(
                "month-pill motion-safe:active:scale-[0.98]",
                isSelected && "month-pill-selected",
                !isSelected && isRealCurrent && "month-pill-current",
              )}
              aria-label={`${monthName} ${year}`}
              aria-current={isSelected ? "date" : undefined}
            >
              {monthName}
            </button>
          </div>
        );
      })}
    </Strip>
  );
}
