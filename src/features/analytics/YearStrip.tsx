import { cn } from "../../utils/cn";
import Strip from "../../components/ui/Strip";

interface YearStripProps {
  year: number;
  currentYear: number;
  maxVisible: number;
  onYearChange: (year: number) => void;
}

export default function YearStrip({
  year,
  currentYear,
  maxVisible,
  onYearChange,
}: YearStripProps) {
  const canGoForward = year < currentYear;
  const visibleCount = Math.min(maxVisible, 5);
  const rangeStart = Math.min(year, currentYear) - 50;

  const years = [];
  for (let y = rangeStart; y <= currentYear; y++) {
    years.push(y);
  }

  return (
    <Strip
      maxVisible={visibleCount}
      scrollClass="year-strip-scroll"
      scrollSelector="[data-selected='true']"
      selectedKey={year}
      smoothScrollThreshold={0}
      scrollMode="nearest"
      onJumpBack={() => onYearChange(year - visibleCount)}
      onStepBack={() => onYearChange(year - 1)}
      onStepForward={() => canGoForward && onYearChange(year + 1)}
      onJumpForward={() => year !== currentYear && onYearChange(currentYear)}
      disableStepForward={!canGoForward}
      disableJumpForward={year === currentYear}
      jumpBackLabel="Back"
      stepBackLabel="Previous year"
      stepForwardLabel="Next year"
      jumpForwardLabel="Current year"
    >
      {years.map((y) => {
        const isSelected = y === year;
        const isFuture = y > currentYear;
        const isCurrent = y === currentYear;
        return (
          <button
            key={y}
            onClick={() => !isFuture && onYearChange(y)}
            disabled={isFuture}
            className={cn(
              "year-pill",
              isSelected && "year-pill-selected",
              !isSelected && isCurrent && "year-pill-current",
            )}
            data-selected={isSelected || undefined}
            aria-label={String(y)}
            aria-current={isSelected ? "date" : undefined}
          >
            {y}
          </button>
        );
      })}
    </Strip>
  );
}
