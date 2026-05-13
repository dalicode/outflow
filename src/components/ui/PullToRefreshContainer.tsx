import {
  forwardRef,
  type HTMLAttributes,
  type RefObject,
  type TouchEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import { useHaptics } from '../../hooks/useHaptics'
import { cn } from '../../utils/cn'

interface PullToRefreshContainerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onRefresh'> {
  onRefresh: () => Promise<void>
  disabled?: boolean
  indicatorLabel?: string
  scrollTargetRef?: RefObject<HTMLDivElement | null>
  scrollable?: boolean
}

const PULL_THRESHOLD = 76
const REFRESH_HOLD_DISTANCE = 64
const MAX_PULL = 112
const PULL_START_SLOP = 8
const SUCCESS_VISIBLE_MS = 700

function getResistedPullDistance(delta: number): number {
  if (delta <= 0) return 0

  const distance =
    delta <= PULL_THRESHOLD
      ? delta
      : PULL_THRESHOLD + (delta - PULL_THRESHOLD) * 0.28

  return Math.min(MAX_PULL, distance)
}

const PullToRefreshContainer = forwardRef<HTMLDivElement, PullToRefreshContainerProps>(
  function PullToRefreshContainer(
    {
      children,
      className,
      onRefresh,
      onScroll,
      disabled = false,
      indicatorLabel = 'Refreshing',
      scrollTargetRef,
      scrollable = true,
      ...rest
    },
    forwardedRef,
  ) {
    const { light, success } = useHaptics()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const startYRef = useRef<number | null>(null)
    const startXRef = useRef<number | null>(null)
    const draggingRef = useRef(false)
    const armedRef = useRef(false)
    const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [pullDistance, setPullDistance] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [isArmed, setIsArmed] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [showRefreshSuccess, setShowRefreshSuccess] = useState(false)

    useImperativeHandle(forwardedRef, () => containerRef.current as HTMLDivElement, [])

    const resetPull = useCallback(() => {
      startYRef.current = null
      startXRef.current = null
      draggingRef.current = false
      armedRef.current = false
      setIsDragging(false)
      setIsArmed(false)
      setPullDistance(0)
    }, [])

    const beginRefresh = useCallback(async () => {
      let completed = false
      setIsRefreshing(true)
      setIsArmed(false)
      setShowRefreshSuccess(false)
      setPullDistance(REFRESH_HOLD_DISTANCE)
      try {
        await onRefresh()
        completed = true
        success()
        setShowRefreshSuccess(true)
        setIsRefreshing(false)
        setPullDistance(REFRESH_HOLD_DISTANCE)
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current)
        }
        successTimeoutRef.current = setTimeout(() => {
          setShowRefreshSuccess(false)
          setPullDistance(0)
        }, SUCCESS_VISIBLE_MS)
      } finally {
        setIsRefreshing(false)
        if (!completed) {
          setPullDistance(0)
        }
        startYRef.current = null
        startXRef.current = null
        draggingRef.current = false
        armedRef.current = false
        setIsDragging(false)
        setIsArmed(false)
      }
    }, [onRefresh, success])

    const handleTouchStart = useCallback(
      (event: TouchEvent<HTMLDivElement>) => {
        if (disabled || isRefreshing || event.touches.length !== 1) return

        const el = scrollTargetRef?.current ?? containerRef.current
        if (!el || el.scrollTop > 0) return

        const touch = event.touches[0]
        startYRef.current = touch.clientY
        startXRef.current = touch.clientX
        draggingRef.current = true
        armedRef.current = false
        setIsDragging(true)
        setIsArmed(false)
      },
      [disabled, isRefreshing, scrollTargetRef],
    )

    const handleTouchMove = useCallback(
      (event: TouchEvent<HTMLDivElement>) => {
        if (!draggingRef.current || startYRef.current == null || disabled) return

        const el = scrollTargetRef?.current ?? containerRef.current
        if (!el) return

        const touch = event.touches[0]
        const delta = touch.clientY - startYRef.current
        const horizontalDelta = Math.abs(touch.clientX - (startXRef.current ?? touch.clientX))

        if (horizontalDelta > Math.abs(delta) * 1.2) {
          resetPull()
          return
        }

        if (delta <= PULL_START_SLOP) {
          setPullDistance(0)
          armedRef.current = false
          setIsArmed(false)
          return
        }

        if (el.scrollTop > 0) {
          resetPull()
          return
        }

        event.preventDefault()
        const dampedDistance = getResistedPullDistance(delta - PULL_START_SLOP)
        setPullDistance(dampedDistance)

        if (dampedDistance >= PULL_THRESHOLD && !armedRef.current) {
          armedRef.current = true
          setIsArmed(true)
          light()
        } else if (dampedDistance < PULL_THRESHOLD && armedRef.current) {
          armedRef.current = false
          setIsArmed(false)
        }
      },
      [disabled, light, resetPull, scrollTargetRef],
    )

    const handleTouchEnd = useCallback(() => {
      if (!draggingRef.current || disabled) {
        resetPull()
        return
      }

      if (armedRef.current && !isRefreshing) {
        void beginRefresh()
        return
      }

      resetPull()
    }, [beginRefresh, disabled, isRefreshing, resetPull])

    const handleScroll = useCallback(
      (event: React.UIEvent<HTMLDivElement>) => {
        onScroll?.(event)
        if (
          (scrollTargetRef?.current?.scrollTop ?? event.currentTarget.scrollTop) > 0 &&
          !isRefreshing &&
          pullDistance > 0
        ) {
          resetPull()
        }
      },
      [isRefreshing, onScroll, pullDistance, resetPull, scrollTargetRef],
    )

    useEffect(
      () => () => {
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current)
        }
      },
      [],
    )

    const indicatorProgress = Math.min(1, pullDistance / PULL_THRESHOLD)
    const indicatorVisible = pullDistance > 4 || isRefreshing
    const instructionReveal = Math.min(1, Math.max(0, (indicatorProgress - 0.12) / 0.6))
    const spinnerReveal = isRefreshing
      ? 1
      : Math.min(1, Math.max(0, (indicatorProgress - 0.9) / 0.1))
    const instructionOpacity =
      isRefreshing || showRefreshSuccess ? 0 : instructionReveal * (1 - spinnerReveal)
    const contentOffset = isRefreshing || showRefreshSuccess
      ? REFRESH_HOLD_DISTANCE
      : Math.min(REFRESH_HOLD_DISTANCE, pullDistance * 0.78)
    const refreshAreaHeight =
      indicatorVisible || showRefreshSuccess || isRefreshing
        ? Math.min(
            MAX_PULL,
            Math.max(44, pullDistance * 0.64 + (isRefreshing || showRefreshSuccess ? 18 : 10)),
          )
        : 0
    const contentStyle =
      pullDistance > 0 || isRefreshing
        ? {
            transform: `translateY(${contentOffset}px)`,
            transition: isDragging
              ? 'none'
              : isRefreshing
                ? 'transform 180ms ease'
                : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
          }
        : undefined

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative h-full',
          scrollable && 'overflow-y-auto overscroll-contain scrollbar-auto-hide',
          className,
        )}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        {...rest}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 overflow-hidden"
          aria-hidden={!indicatorVisible}
          style={{
            height: `${refreshAreaHeight}px`,
            opacity: indicatorVisible ? 1 : 0,
            transition: isDragging
              ? 'none'
              : isRefreshing
                ? 'height 180ms ease, opacity 140ms ease'
                : 'height 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 140ms ease',
          }}
        >
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-x-0 top-3 flex h-9 items-center justify-center text-xs font-medium text-theme-text"
          >
            <span
              className="absolute inset-0 z-10 inline-flex items-center justify-center gap-1.5 text-theme-muted"
              style={{
                opacity: instructionOpacity,
                transition: 'opacity 140ms ease',
              }}
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.9"
                aria-hidden="true"
              >
                <path d="M10 3v12" />
                <path d="m5.5 10.5 4.5 4.5 4.5-4.5" />
              </svg>
              <span>{isArmed ? 'Release to refresh' : 'Pull down to refresh'}</span>
            </span>

            <span
              className="absolute inset-0 z-20 inline-flex items-center justify-center gap-2"
              style={{
                opacity: spinnerReveal,
                transition: 'opacity 140ms ease',
              }}
            >
              {showRefreshSuccess ? (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-theme-success text-white">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 8.5 2.5 2.5 6-6" />
                  </svg>
                </span>
              ) : (
                isRefreshing ||
                (isArmed && (
                  <span
                    className="inline-block h-8 w-8 animate-spin rounded-full border-2"
                    style={{
                      borderColor: 'var(--theme-border)',
                      borderTopColor: 'var(--theme-primary)',
                    }}
                  />
                ))
              )}
              <span>{showRefreshSuccess && 'Updated just now'}</span>
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col" style={contentStyle}>
          {children}
        </div>
      </div>
    )
  },
)

export default PullToRefreshContainer
