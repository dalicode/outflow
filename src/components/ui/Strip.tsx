import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react'
import { useHaptics } from '../../hooks/useHaptics'
import { cn } from '../../utils/cn'

interface StripProps {
  maxVisible: number
  scrollClass: string
  scrollSelector: string
  selectedKey?: string | number
  align?: 'center' | 'end'
  onCurrent?: () => void
  onStepBack?: () => void
  onStepForward?: () => void
  disableCurrent?: boolean
  disableStepBack?: boolean
  disableStepForward?: boolean
  currentLabel?: string
  stepBackLabel: string
  stepForwardLabel: string
  beforeScroll?: ReactNode
  afterScroll?: ReactNode
  smoothScrollThreshold?: number
  scrollMode?: 'center' | 'nearest'
  scrollRef?: RefObject<HTMLDivElement>
  /**
   * CSS selector for elements that should be covered by the span highlight.
   * When 2+ matching elements exist, a single background rect is drawn behind
   * all of them. Pass the same selector used for the "selected" pill class,
   * e.g. ".month-pill-selected" or ".year-pill-selected".
   */
  spanSelector?: string
  /** Width per item in px, used to compute maxWidth of the scroll container. Default 36. */
  itemWidth?: number
  children: ReactNode
}

interface SpanRect {
  left: number
  top: number
  width: number
  height: number
}

function ChevronLeft({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ChevronRight({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function CalendarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 10h18" />
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    </svg>
  )
}

export default function Strip({
  maxVisible,
  scrollClass,
  scrollSelector,
  selectedKey,
  align = 'center',
  onCurrent,
  onStepBack,
  onStepForward,
  disableCurrent,
  disableStepBack,
  disableStepForward,
  currentLabel,
  stepBackLabel,
  stepForwardLabel,
  beforeScroll,
  afterScroll,
  smoothScrollThreshold = 240,
  scrollMode = 'center',
  scrollRef: externalScrollRef,
  spanSelector,
  itemWidth,
  children,
}: StripProps) {
  const internalRef = useRef<HTMLDivElement>(null)
  const containerRef = externalScrollRef ?? internalRef
  const hasCenteredRef = useRef(false)
  const haptics = useHaptics()
  const [spanRect, setSpanRect] = useState<SpanRect | null>(null)
  const alignmentClass = align === 'end' ? 'items-end' : 'items-center'

  // ── Auto-scroll to selected item ──────────────────────────────────────────
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const target = container.querySelector(scrollSelector) as HTMLElement | null
    if (target) {
      const containerRect = container.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const targetCenter =
        targetRect.left - containerRect.left + container.scrollLeft + targetRect.width / 2
      const targetLeft = targetRect.left - containerRect.left + container.scrollLeft
      const targetRight = targetLeft + targetRect.width
      const visibleLeft = container.scrollLeft
      const visibleRight = visibleLeft + container.clientWidth
      const nextScrollLeft =
        scrollMode === 'nearest'
          ? targetLeft < visibleLeft
            ? targetLeft
            : targetRight > visibleRight
              ? targetRight - container.clientWidth
              : visibleLeft
          : targetCenter - container.clientWidth / 2
      const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth)
      const left = Math.min(Math.max(0, nextScrollLeft), maxScrollLeft)
      const distance = Math.abs(left - container.scrollLeft)
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      container.scrollTo({
        left,
        behavior:
          hasCenteredRef.current &&
          !prefersReducedMotion &&
          distance > 0 &&
          distance <= smoothScrollThreshold
            ? 'smooth'
            : 'auto',
      })
      hasCenteredRef.current = true
    }
  }, [containerRef, scrollMode, scrollSelector, selectedKey, smoothScrollThreshold])

  // ── Span highlight measurement ────────────────────────────────────────────
  // Measures all elements matching spanSelector and computes a single rect
  // that covers all of them, accounting for scroll offset.
  useLayoutEffect(() => {
    if (!spanSelector) {
      setSpanRect(null)
      return
    }
    const container = containerRef.current
    if (!container) {
      setSpanRect(null)
      return
    }

    const pills = Array.from(container.querySelectorAll<HTMLElement>(spanSelector))
    if (pills.length < 2) {
      setSpanRect(null)
      return
    }

    const containerRect = container.getBoundingClientRect()
    const rects = pills.map((p) => p.getBoundingClientRect())

    const left = Math.min(...rects.map((r) => r.left)) - containerRect.left + container.scrollLeft
    const right = Math.max(...rects.map((r) => r.right)) - containerRect.left + container.scrollLeft
    const top = Math.min(...rects.map((r) => r.top)) - containerRect.top
    const bottom = Math.max(...rects.map((r) => r.bottom)) - containerRect.top

    const next = { left, top, width: right - left, height: bottom - top }

    setSpanRect((prev) => {
      if (
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.height === next.height
      ) {
        return prev
      }
      return next
    })
  })

  const hasNav = onCurrent || onStepBack || onStepForward

  const handleCurrent = () => {
    haptics.selection()
    onCurrent?.()
  }
  const handleStepBack = () => {
    haptics.selection()
    onStepBack?.()
  }
  const handleStepForward = () => {
    haptics.selection()
    onStepForward?.()
  }
  return (
    <div className={cn('flex justify-center', alignmentClass)}>
      {hasNav && (
        <>
          {onCurrent && (
            <button
              onClick={handleCurrent}
              disabled={disableCurrent}
              className={cn('strip-nav-btn', disableCurrent && 'cursor-not-allowed opacity-40')}
              aria-label={currentLabel}
            >
              <CalendarIcon />
            </button>
          )}
          {onStepBack && (
            <button
              onClick={handleStepBack}
              disabled={disableStepBack}
              className={cn('strip-nav-btn', disableStepBack && 'cursor-not-allowed opacity-40')}
              aria-label={stepBackLabel}
            >
              <ChevronLeft />
            </button>
          )}
        </>
      )}
      {beforeScroll}
      <div
        className={cn(scrollClass, 'relative')}
        ref={containerRef}
        style={{ maxWidth: `${maxVisible * (itemWidth ?? 36)}px` }}
      >
        {spanRect && (
          <div
            className="strip-span-highlight"
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: spanRect.width,
              height: spanRect.height,
              transform: `translate3d(${spanRect.left}px, ${spanRect.top}px, 0)`,
              backgroundColor: 'var(--theme-primary)',
              borderRadius: 'var(--radius-small)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}
        {children}
      </div>
      {afterScroll}
      {hasNav && (
        <>
          {onStepForward && (
            <button
              onClick={handleStepForward}
              disabled={disableStepForward}
              className={cn('strip-nav-btn', disableStepForward && 'cursor-not-allowed opacity-40')}
              aria-label={stepForwardLabel}
            >
              <ChevronRight />
            </button>
          )}
        </>
      )}
    </div>
  )
}
