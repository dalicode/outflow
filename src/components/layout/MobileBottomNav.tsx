import {
  type CSSProperties,
  type MouseEventHandler,
  type PointerEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useHaptics } from '../../hooks/useHaptics'
import { cn } from '../../utils/cn'
import { ROUTES } from '../../constants/routes'
import type { NavItemConfig } from './navConfig'
import { NAV_ITEMS, PlusIcon } from './navConfig'

interface MobileBottomNavProps {
  onAddExpense: MouseEventHandler<HTMLButtonElement>
  scrollDirection?: 'up' | 'down' | null
  isScrolling?: boolean
  hidden?: boolean
  onCycleDashboardView?: () => void
}

export default function MobileBottomNav({
  onAddExpense,
  scrollDirection,
  isScrolling = false,
  hidden = false,
  onCycleDashboardView,
}: MobileBottomNavProps) {
  const mobileDragThreshold = 8
  const mobileCollapsedHeight = 76
  const mobilePrimaryHeight = 88
  const mobileExpandedHeight = 156
  const mobileNavOverscan = 48
  const stageHeights = [mobileCollapsedHeight, mobilePrimaryHeight, mobileExpandedHeight] as const
  const [mobileStage, setMobileStage] = useState<0 | 1 | 2>(1)
  const [mobileNavHeight, setMobileNavHeight] = useState<number>(stageHeights[1])
  const [mobileAutoHidden, setMobileAutoHidden] = useState(false)
  const [isMobileDragging, setIsMobileDragging] = useState(false)
  const mobileDragStartYRef = useRef<number | null>(null)
  const startHeightRef = useRef<number>(stageHeights[1])
  const expandedSinceLastScrollRef = useRef(false)
  const mobileDragDistanceRef = useRef(0)
  const pointerHistoryRef = useRef<Array<{ y: number; t: number }>>([])
  const location = useLocation()
  const isOnDashboard = location.pathname === ROUTES.DASHBOARD
  const justNavigatedRef = useRef(false)
  const haptics = useHaptics()

  const prevLocationKeyRef = useRef(location.key)

  // Reset auto-hide state on every navigation
  useEffect(() => {
    if (prevLocationKeyRef.current === location.key) return
    prevLocationKeyRef.current = location.key
    justNavigatedRef.current = true
    expandedSinceLastScrollRef.current = false
    setMobileAutoHidden(false)
    setMobileStage(1)
    setMobileNavHeight(stageHeights[1])
  }, [location.key, stageHeights[1]])

  const handleNavLinkClick = useCallback(
    (pageKey: NavItemConfig['pageKey'], e: React.MouseEvent) => {
      haptics.selection()
      if (pageKey !== 'dashboard' || !isOnDashboard) return
      e.preventDefault()
      onCycleDashboardView?.()
    },
    [haptics, isOnDashboard, onCycleDashboardView],
  )

  const mobilePrimaryItems = NAV_ITEMS.filter(({ pageKey }) =>
    ['summary', 'dashboard'].includes(pageKey),
  )
  const mobileSecondaryItems = NAV_ITEMS.filter(({ pageKey }) =>
    ['analytics', 'payees', 'settings'].includes(pageKey),
  )
  const shouldAutoHideAfterScroll = !isScrolling && scrollDirection === 'down'
  const isMobileNavBlocked = hidden
  const isMobileNavCollapsed = mobileAutoHidden
  const mobileExpansionProgress =
    (mobileNavHeight - mobileCollapsedHeight) / (mobileExpandedHeight - mobileCollapsedHeight)
  const translateY = isMobileNavCollapsed ? 0 : mobileExpandedHeight - mobileNavHeight
  const mobileNavStyle = {
    '--mobile-nav-height': `${mobileExpandedHeight}px`,
    '--mobile-nav-wrapper-height': `${mobileExpandedHeight + mobileNavOverscan}px`,
    '--mobile-nav-overscan': `${mobileNavOverscan}px`,
    '--mobile-nav-collapsed-height': `${mobileCollapsedHeight}px`,
    '--mobile-nav-progress': `${mobileExpansionProgress}`,
    '--mobile-nav-translate-y': `${translateY}px`,
  } as CSSProperties

  const renderMobileNavLink = ({ pageKey, basePath, label, icon: Icon }: NavItemConfig) => {
    const isCurrent = location.pathname === basePath

    return (
      <NavLink
        key={pageKey}
        to={basePath}
        end
        aria-label={label}
        data-testid={`nav-${pageKey}`}
        onClick={(e) => handleNavLinkClick(pageKey, e)}
        className={({ isActive }) =>
          cn('mobile-nav-link nav-item-hover', isActive ? 'text-theme-primary' : 'text-theme-muted')
        }
      >
        <Icon active={isCurrent} />
        <span className="mobile-nav-label">{label}</span>
      </NavLink>
    )
  }

  const handleMobileHandleClick = () => {
    if (isMobileNavBlocked) return

    if (isMobileNavCollapsed) {
      setMobileAutoHidden(false)
      setMobileStage(1)
      setMobileNavHeight(stageHeights[1])
      expandedSinceLastScrollRef.current = true
      return
    }

    if (mobileStage === 1) {
      haptics.selection()
      setMobileStage(2)
      setMobileNavHeight(stageHeights[2])
      expandedSinceLastScrollRef.current = true
      return
    }

    if (mobileStage === 2) {
      haptics.selection()
      setMobileStage(1)
      setMobileNavHeight(stageHeights[1])
      expandedSinceLastScrollRef.current = false
    }
  }

  const handleMobileContainerPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (isMobileNavBlocked) return
    mobileDragStartYRef.current = event.clientY
    startHeightRef.current = isMobileNavCollapsed ? stageHeights[0] : mobileNavHeight
    mobileDragDistanceRef.current = 0
  }

  const handleMobileContainerPointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    if (mobileDragStartYRef.current === null) return
    const rawDelta = mobileDragStartYRef.current - event.clientY
    mobileDragDistanceRef.current = Math.abs(rawDelta)
    if (!isMobileDragging && mobileDragDistanceRef.current <= mobileDragThreshold) {
      return
    }
    if (!isMobileDragging) {
      setIsMobileDragging(true)
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
    if (rawDelta > 0 && isMobileNavCollapsed) {
      setMobileAutoHidden(false)
    }
    const newHeight = Math.max(
      stageHeights[1],
      Math.min(mobileExpandedHeight, startHeightRef.current + rawDelta),
    )
    setMobileNavHeight(newHeight)

    const now = performance.now()
    pointerHistoryRef.current.push({ y: event.clientY, t: now })
    pointerHistoryRef.current = pointerHistoryRef.current.filter((p) => now - p.t <= 100)
  }

  const handleMobileContainerPointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
    if (mobileDragStartYRef.current === null) return
    if (!isMobileDragging) {
      mobileDragStartYRef.current = null
      mobileDragDistanceRef.current = 0
      return
    }

    const history = pointerHistoryRef.current
    let velocityPxPerMs = 0
    if (history.length >= 2) {
      const oldest = history[0]
      const newest = history[history.length - 1]
      const dt = newest.t - oldest.t
      if (dt > 0) {
        velocityPxPerMs = (newest.y - oldest.y) / dt
      }
    }
    pointerHistoryRef.current = []

    const VELOCITY_THRESHOLD = 0.5

    let targetStage: 1 | 2
    if (velocityPxPerMs < -VELOCITY_THRESHOLD) {
      targetStage = 2
    } else if (velocityPxPerMs > VELOCITY_THRESHOLD) {
      targetStage = 1
    } else {
      targetStage = ([1, 2] as const).reduce((prev, curr) =>
        Math.abs(stageHeights[curr] - mobileNavHeight) <
        Math.abs(stageHeights[prev] - mobileNavHeight)
          ? curr
          : prev,
      )
    }

    if (targetStage !== mobileStage) {
      haptics.selection()
    }

    setMobileStage(targetStage)
    setMobileNavHeight(stageHeights[targetStage])
    setMobileAutoHidden(false)
    expandedSinceLastScrollRef.current = targetStage > 0

    mobileDragStartYRef.current = null
    mobileDragDistanceRef.current = 0
    setIsMobileDragging(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
  }

  const handleMobileContainerPointerCancel: PointerEventHandler<HTMLDivElement> = (event) => {
    mobileDragStartYRef.current = null
    setMobileNavHeight(stageHeights[mobileStage])
    pointerHistoryRef.current = []
    mobileDragDistanceRef.current = 0
    setIsMobileDragging(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
  }

  useEffect(() => {
    if (justNavigatedRef.current) {
      justNavigatedRef.current = false
      return
    }

    if (scrollDirection === 'up') {
      if (!isScrolling && !hidden) {
        setMobileAutoHidden(false)
        setMobileStage(1)
        setMobileNavHeight(stageHeights[1])
      }
      expandedSinceLastScrollRef.current = false
      return
    }

    if (isScrolling) {
      expandedSinceLastScrollRef.current = false
    }

    if (mobileDragStartYRef.current !== null) return

    if (expandedSinceLastScrollRef.current) return

    if (isScrolling) return
    if (scrollDirection !== 'down' && !hidden) return

    // When the selection banner is visible, don't collapse the nav
    if (hidden) return

    if (!shouldAutoHideAfterScroll) return

    setMobileAutoHidden(true)
    setMobileStage(0)
    setMobileNavHeight(stageHeights[0])
  }, [hidden, isScrolling, scrollDirection, shouldAutoHideAfterScroll, stageHeights[1]])

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(-1*var(--mobile-nav-overscan))] z-30 h-[var(--mobile-nav-wrapper-height)] pointer-events-none sm:hidden"
      style={mobileNavStyle}
    >
      <nav
        className={cn(
          'absolute inset-x-0 top-0',
          isMobileNavBlocked ? 'pointer-events-none' : 'pointer-events-auto',
          'mobile-nav-bounce',
          isMobileNavCollapsed && 'translate-y-[calc(100%-18px)] overflow-hidden',
        )}
      >
        <div
          className="mobile-nav-container"
          data-stage={mobileStage}
          data-dragging={isMobileDragging ? 'true' : 'false'}
          onPointerDown={handleMobileContainerPointerDown}
          onPointerMove={handleMobileContainerPointerMove}
          onPointerUp={handleMobileContainerPointerUp}
          onPointerCancel={handleMobileContainerPointerCancel}
        >
          <button
            type="button"
            onClick={handleMobileHandleClick}
            className="mobile-nav-handle"
            aria-label={
              isMobileNavCollapsed
                ? 'Expand navigation'
                : mobileStage === 1
                  ? 'Expand navigation'
                  : 'Collapse navigation'
            }
          >
            <span />
          </button>

          <div className="mobile-nav-row mobile-nav-row-primary">
            {renderMobileNavLink(mobilePrimaryItems[0])}
            <button
              onClick={(e) => {
                haptics.selection()
                onAddExpense(e)
              }}
              data-testid="btn-add-expense"
              className={cn('mobile-add-btn', isMobileNavCollapsed && 'opacity-0')}
              aria-label="Add expense"
            >
              <PlusIcon />
            </button>
            {renderMobileNavLink(mobilePrimaryItems[1])}
          </div>

          <div className="mobile-nav-row mobile-nav-row-secondary">
            {mobileSecondaryItems.map(renderMobileNavLink)}
          </div>
        </div>
      </nav>
    </div>
  )
}
