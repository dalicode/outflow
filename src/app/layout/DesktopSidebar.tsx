import { type MouseEventHandler, useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useHaptics } from '../../hooks/useHaptics'
import { cn } from '../../lib/cn'
import { ROUTES } from '../../constants/routes'
import type { NavItemConfig } from './navConfig'
import { NAV_ITEMS, PlusIcon, SignInIcon, SignOutIcon } from './navConfig'
import type { SyncStatus } from '../../types'
import SyncIndicator from './SyncIndicator'

interface DesktopSidebarProps {
  onAddExpense: MouseEventHandler<HTMLButtonElement>
  syncStatus?: SyncStatus
  onSignIn?: () => void
  showSignIn?: boolean
  onSignOut?: () => void
  userEmail?: string
  onCycleDashboardView?: () => void
}

export default function DesktopSidebar({
  onAddExpense,
  syncStatus = 'idle',
  onSignIn,
  showSignIn,
  onSignOut,
  userEmail,
  onCycleDashboardView,
}: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [labelsVisible, setLabelsVisible] = useState(false)
  const labelRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const haptics = useHaptics()
  const location = useLocation()
  const isOnDashboard = location.pathname === ROUTES.DASHBOARD

  useEffect(() => {
    return () => {
      if (labelRevealTimeoutRef.current) {
        clearTimeout(labelRevealTimeoutRef.current)
      }
    }
  }, [])

  const handleNavLinkClick = useCallback(
    (pageKey: NavItemConfig['pageKey'], e: React.MouseEvent) => {
      haptics.selection()
      if (pageKey !== 'dashboard' || !isOnDashboard) return
      e.preventDefault()
      onCycleDashboardView?.()
    },
    [haptics, isOnDashboard, onCycleDashboardView],
  )

  const sidebarWidth = collapsed ? 'w-14' : 'w-44'
  const sidebarItemClass = collapsed
    ? 'w-full justify-center py-2.5 px-2'
    : 'w-[calc(100%-1rem)] gap-3 py-2.5 px-3 mx-2'
  const navButtonToneClass = 'text-theme-muted hover:text-theme-text hover:bg-theme-background'
  const labelClass = cn(
    'transition-opacity duration-200',
    labelsVisible ? 'opacity-100' : 'opacity-0',
  )

  const expandSidebar = useCallback(() => {
    haptics.selection()
    if (labelRevealTimeoutRef.current) {
      clearTimeout(labelRevealTimeoutRef.current)
    }
    setCollapsed(false)
    setLabelsVisible(false)
    labelRevealTimeoutRef.current = setTimeout(() => {
      setLabelsVisible(true)
      labelRevealTimeoutRef.current = null
    }, 200)
  }, [haptics])

  const collapseSidebar = useCallback(() => {
    haptics.selection()
    if (labelRevealTimeoutRef.current) {
      clearTimeout(labelRevealTimeoutRef.current)
      labelRevealTimeoutRef.current = null
    }
    setLabelsVisible(false)
    setCollapsed(true)
  }, [haptics])

  return (
    <aside className={cn('navbar-desktop group', sidebarWidth)}>
      {/* Brand + Collapse toggle */}
      <div className="px-3 pt-4 pb-2">
        {!collapsed && (
          <div className="mx-2 grid min-h-10 grid-cols-[1fr_auto] items-center">
            <div className="flex min-w-0 items-center gap-3 px-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <img src="/icon.svg" alt="" className="h-6 w-6" />
              </span>
              <span
                className={cn('text-md font-semibold leading-none text-theme-primary', labelClass)}
              >
                Outflow
              </span>
            </div>
            <button
              onClick={collapseSidebar}
              className="navbar-toggle-btn nav-item-hover opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              aria-label="Collapse sidebar"
              title="Collapse"
            >
              <svg
                className="translate-x-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <polyline points="17 18 11 12 17 6" />
              </svg>
            </button>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center w-full">
            <img src="/icon.svg" alt="" className="w-9 h-9 shrink-0" />
          </div>
        )}
      </div>

      {/* Expand toggle (visible only when collapsed) */}
      {collapsed && (
        <div className="flex justify-center pb-2">
          <button
            onClick={expandSidebar}
            className="navbar-toggle-btn nav-item-hover opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            aria-label="Expand sidebar"
            title="Expand"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      {/* Nav Links */}
      <nav className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.map(({ pageKey, basePath, label, icon: Icon }) => {
          const isActive = location.pathname === basePath
          return (
            <NavLink
              key={pageKey}
              to={basePath}
              end
              data-testid={`nav-${pageKey}`}
              onClick={(e) => handleNavLinkClick(pageKey, e)}
              className={cn(
                'flex items-center rounded-theme-medium nav-item-hover',
                collapsed ? 'justify-center py-2.5 px-2' : 'gap-3 py-2.5 px-3 mx-2',
                isActive
                  ? 'bg-theme-background text-theme-primary font-semibold'
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-background',
              )}
            >
              <Icon active={isActive} />
              {!collapsed && (
                <span className={cn('text-sm font-medium truncate', labelClass)}>{label}</span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Actions Footer */}
      <div className="pb-4 px-2 space-y-1">
        {/* Add expense */}
        <button
          onClick={(e) => {
            haptics.selection()
            onAddExpense(e)
          }}
          data-testid="btn-add-expense"
          className={cn(
            'flex items-center rounded-theme-medium nav-item-hover',
            navButtonToneClass,
            sidebarItemClass,
          )}
          aria-label="Add expense"
        >
          <PlusIcon />
          {!collapsed && (
            <span className={cn('text-sm font-medium truncate', labelClass)}>Add</span>
          )}
        </button>

        {onSignOut && (
          <div
            className={cn(
              'flex items-center rounded-theme-medium text-theme-muted',
              sidebarItemClass,
            )}
          >
            <SyncIndicator syncStatus={syncStatus} compact={collapsed} showLabel={labelsVisible} />
          </div>
        )}

        {onSignOut ? (
          <button
            onClick={() => {
              haptics.selection()
              onSignOut()
            }}
            className={cn(
              'flex items-center rounded-theme-medium nav-item-hover',
              navButtonToneClass,
              sidebarItemClass,
            )}
            title={userEmail}
          >
            <SignOutIcon />
            {!collapsed && (
              <span className={cn('text-sm font-medium truncate', labelClass)}>Sign out</span>
            )}
          </button>
        ) : showSignIn && onSignIn ? (
          <button
            onClick={() => {
              haptics.selection()
              onSignIn()
            }}
            className={cn(
              'flex items-center rounded-theme-medium nav-item-hover',
              navButtonToneClass,
              sidebarItemClass,
            )}
            title="Sign in to sync data across devices"
          >
            <SignInIcon />
            {!collapsed && (
              <span className={cn('text-sm font-medium truncate', labelClass)}>Sign in</span>
            )}
          </button>
        ) : null}
      </div>
    </aside>
  )
}
