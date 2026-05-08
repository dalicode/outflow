import { useRef, useLayoutEffect, useState } from "react";
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

interface SpanRect {
  left: number;
  top: number;
  width: number;
  height: number;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [spanRect, setSpanRect] = useState<SpanRect | null>(null);

  // Measure the bounding box covering all selected pills after layout changes
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || monthSpan <= 1) {
      setSpanRect(null);
      return;
    }

    const pills = Array.from(
      container.querySelectorAll<HTMLElement>(".month-pill-selected"),
    );
    if (pills.length < 2) {
      setSpanRect(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const rects = pills.map((p) => p.getBoundingClientRect());

    const left =
      Math.min(...rects.map((r) => r.left)) -
      containerRect.left +
      container.scrollLeft;
    const right =
      Math.max(...rects.map((r) => r.right)) -
      containerRect.left +
      container.scrollLeft;
    const top = Math.min(...rects.map((r) => r.top)) - containerRect.top;
    const bottom = Math.max(...rects.map((r) => r.bottom)) - containerRect.top;

    const next = { left, top, width: right - left, height: bottom - top };

    setSpanRect((prev) => {
      if (
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.height === next.height
      ) {
        return prev; // no change — skip re-render
      }
      return next;
    });
  }, [selectedYear, selectedMonth, monthSpan, monthKeys]);

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
      scrollRef={scrollRef}
      spanHighlight={
        spanRect
          ? {
              left: spanRect.left,
              top: spanRect.top,
              width: spanRect.width,
              height: spanRect.height,
            }
          : null
      }
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
            <span className={cn("year-label", !isFirstOfYear && "invisible")}>
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
              <span className={cn(!isSelected && isInSpan && "opacity-70")}>
                {monthName}
              </span>
            </button>
          </div>
        );
      })}
    </Strip>
  );
}
