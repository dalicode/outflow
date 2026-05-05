import { useRef, useLayoutEffect, type ReactNode } from "react";

interface StripProps {
  maxVisible: number;
  scrollClass: string;
  scrollSelector: string;
  selectedKey?: string | number;
  align?: "center" | "end";
  onJumpBack?: () => void;
  onStepBack?: () => void;
  onStepForward?: () => void;
  onJumpForward?: () => void;
  disableJumpBack?: boolean;
  disableStepBack?: boolean;
  disableStepForward?: boolean;
  disableJumpForward?: boolean;
  jumpBackLabel: string;
  stepBackLabel: string;
  stepForwardLabel: string;
  jumpForwardLabel: string;
  beforeScroll?: ReactNode;
  afterScroll?: ReactNode;
  smoothScrollThreshold?: number;
  scrollMode?: "center" | "nearest";
  children: ReactNode;
}

function ChevronLeft({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

function ChevronRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function DoubleChevronLeft({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 19l-7-7 7-7M11 19l-7-7 7-7"
      />
    </svg>
  );
}

function DoubleChevronRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 5l7 7-7 7M6 5l7 7-7 7"
      />
    </svg>
  );
}

export default function Strip({
  maxVisible,
  scrollClass,
  scrollSelector,
  selectedKey,
  align = "center",
  onJumpBack,
  onStepBack,
  onStepForward,
  onJumpForward,
  disableJumpBack,
  disableStepBack,
  disableStepForward,
  disableJumpForward,
  jumpBackLabel,
  stepBackLabel,
  stepForwardLabel,
  jumpForwardLabel,
  beforeScroll,
  afterScroll,
  smoothScrollThreshold = 240,
  scrollMode = "center",
  children,
}: StripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCenteredRef = useRef(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector(scrollSelector) as HTMLElement | null;
    if (target) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetCenter =
        targetRect.left -
        containerRect.left +
        container.scrollLeft +
        targetRect.width / 2;
      const targetLeft =
        targetRect.left - containerRect.left + container.scrollLeft;
      const targetRight = targetLeft + targetRect.width;
      const visibleLeft = container.scrollLeft;
      const visibleRight = visibleLeft + container.clientWidth;
      const nextScrollLeft =
        scrollMode === "nearest"
          ? targetLeft < visibleLeft
            ? targetLeft
            : targetRight > visibleRight
              ? targetRight - container.clientWidth
              : visibleLeft
          : targetCenter - container.clientWidth / 2;
      const maxScrollLeft = Math.max(
        0,
        container.scrollWidth - container.clientWidth,
      );

      const left = Math.min(
        Math.max(0, nextScrollLeft),
        maxScrollLeft,
      );
      const distance = Math.abs(left - container.scrollLeft);
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      container.scrollTo({
        left,
        behavior:
          hasCenteredRef.current &&
          !prefersReducedMotion &&
          distance > 0 &&
          distance <= smoothScrollThreshold
            ? "smooth"
            : "auto",
      });
      hasCenteredRef.current = true;
    }
  }, [scrollSelector, selectedKey]);

  const hasNav =
    onJumpBack || onStepBack || onStepForward || onJumpForward;

  return (
    <div className={`flex items-${align} justify-center`}>
      {hasNav && (
        <>
          {onJumpBack && (
            <button
              onClick={onJumpBack}
              disabled={disableJumpBack}
              className={`strip-nav-btn${disableJumpBack ? " opacity-40 cursor-not-allowed" : ""}`}
              aria-label={jumpBackLabel}
            >
              <DoubleChevronLeft />
            </button>
          )}
          {onStepBack && (
            <button
              onClick={onStepBack}
              disabled={disableStepBack}
              className={`strip-nav-btn${disableStepBack ? " opacity-40 cursor-not-allowed" : ""}`}
              aria-label={stepBackLabel}
            >
              <ChevronLeft />
            </button>
          )}
        </>
      )}
      {beforeScroll}
      <div
        className={scrollClass}
        ref={containerRef}
        style={{ maxWidth: `${maxVisible * 44}px` }}
      >
        {children}
      </div>
      {afterScroll}
      {hasNav && (
        <>
          {onStepForward && (
            <button
              onClick={onStepForward}
              disabled={disableStepForward}
              className={`strip-nav-btn${disableStepForward ? " opacity-40 cursor-not-allowed" : ""}`}
              aria-label={stepForwardLabel}
            >
              <ChevronRight />
            </button>
          )}
          {onJumpForward && (
            <button
              onClick={onJumpForward}
              disabled={disableJumpForward}
              className={`strip-nav-btn${disableJumpForward ? " opacity-40 cursor-not-allowed" : ""}`}
              aria-label={jumpForwardLabel}
            >
              <DoubleChevronRight />
            </button>
          )}
        </>
      )}
    </div>
  );
}
