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
  scrollTargetRef?: RefObject<HTMLDivElement | null>
  scrollable?: boolean
}

const PULL_THRESHOLD = 76
const REFRESH_HOLD_DISTANCE = 64
const MAX_PULL = 112
const PULL_START_SLOP = 8
const STATUS_FADE_MS = 220
const INDICATOR_OPACITY_MS = 220

function hasOpenModal(): boolean {
  if (typeof document === 'undefined') return false

  return document.querySelector('[data-outflow-modal="true"]') !== null
}

function getResistedPullDistance(delta: number): number {
  if (delta <= 0) return 0

  const distance =
    delta <= PULL_THRESHOLD ? delta : PULL_THRESHOLD + (delta - PULL_THRESHOLD) * 0.28

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
      scrollTargetRef,
      scrollable = true,
      ...rest
    },
    forwardedRef,
  ) {
    const { light, success, warning } = useHaptics()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const startYRef = useRef<number | null>(null)
    const startXRef = useRef<number | null>(null)
    const draggingRef = useRef(false)
    const armedRef = useRef(false)
    const [pullDistance, setPullDistance] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [isArmed, setIsArmed] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

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
      let failed = false
      setIsRefreshing(true)
      setIsArmed(false)
      setPullDistance(0)
      try {
        await onRefresh()
        completed = true
        success()
        setPullDistance(0)
      } catch {
        failed = true
        warning()
        setPullDistance(0)
      } finally {
        setIsRefreshing(false)
        if (!completed && !failed) {
          setPullDistance(0)
        }
        startYRef.current = null
        startXRef.current = null
        draggingRef.current = false
        armedRef.current = false
        setIsDragging(false)
        setIsArmed(false)
      }
    }, [onRefresh, success, warning])

    const handleTouchStart = useCallback(
      (event: TouchEvent<HTMLDivElement>) => {
        if (disabled || isRefreshing || event.touches.length !== 1) return
        if (hasOpenModal()) return

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

    useEffect(() => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches)
      syncPreference()

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', syncPreference)
        return () => mediaQuery.removeEventListener('change', syncPreference)
      }

      mediaQuery.addListener(syncPreference)
      return () => mediaQuery.removeListener(syncPreference)
    }, [])

    const indicatorProgress = Math.min(1, pullDistance / PULL_THRESHOLD)
    const indicatorVisible = pullDistance > 4
    const instructionReveal = Math.min(1, Math.max(0, (indicatorProgress - 0.12) / 0.6))
    const spinnerReveal = Math.min(1, Math.max(0, (indicatorProgress - 0.9) / 0.1))
    const instructionOpacity = instructionReveal * (1 - spinnerReveal)
    const contentOffset = Math.min(REFRESH_HOLD_DISTANCE, pullDistance * 0.78)
    const refreshAreaHeight = indicatorVisible
      ? Math.min(MAX_PULL, Math.max(44, pullDistance * 0.64 + 10))
      : 0
    const contentStyle =
      pullDistance > 0 || isRefreshing
        ? {
            transform: `translateY(${contentOffset}px)`,
            transition:
              isDragging || prefersReducedMotion
                ? 'none'
                : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
          }
        : undefined

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative h-full',
          scrollable && 'overflow-y-auto overscroll-contain',
          className,
        )}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        aria-busy={isRefreshing}
        {...rest}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 overflow-hidden"
          aria-hidden={!indicatorVisible}
          style={{
            height: `${refreshAreaHeight}px`,
            opacity: indicatorVisible ? 1 : 0,
            transition:
              isDragging || prefersReducedMotion
                ? 'none'
                : `height 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${INDICATOR_OPACITY_MS}ms ease`,
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
                transition: prefersReducedMotion ? 'none' : `opacity ${STATUS_FADE_MS}ms ease`,
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
              {isArmed && <span className="sr-only">Release to update</span>}
            </span>

            <span
              className="absolute inset-0 z-20 inline-flex items-center justify-center gap-2"
              style={{
                opacity: spinnerReveal,
                transition: prefersReducedMotion ? 'none' : `opacity ${STATUS_FADE_MS}ms ease`,
              }}
            >
              {(isRefreshing || isArmed) && (
                <span
                  className="inline-block h-8 w-8 animate-spin rounded-full border-2"
                  style={{
                    borderColor: 'var(--theme-border)',
                    borderTopColor: 'var(--theme-primary)',
                    animation: prefersReducedMotion ? 'none' : undefined,
                  }}
                />
              )}
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
