import { type MouseEventHandler, useCallback, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useHaptics } from '../../hooks/useHaptics'
import { cn } from '../../utils/cn'
import type { NavItemConfig } from './navConfig'
import { NAV_ITEMS, PlusIcon, SignOutIcon } from './navConfig'
import type { SyncStatus } from '../../types'
import SyncIndicator from './SyncIndicator'

interface DesktopSidebarProps {
  onAddExpense: MouseEventHandler<HTMLButtonElement>
  syncStatus?: SyncStatus
  onSignIn?: () => void
  showSignIn?: boolean
  onSignOut?: MouseEventHandler<HTMLButtonElement>
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
  const haptics = useHaptics()
  const location = useLocation()
  const isOnDashboard = location.pathname === '/dashboard'

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

  return (
    <aside className={cn('navbar-desktop group', sidebarWidth)}>
      {/* Brand + Collapse toggle */}
      <div className="px-3 pt-4 pb-2 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <img src="/icon.svg" alt="" className="w-7 h-7 shrink-0" />
            <span className="text-lg font-bold text-theme-primary tracking-tight">Outflow</span>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center w-full">
            <img src="/icon.svg" alt="" className="w-9 h-9 shrink-0" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => {
              haptics.selection()
              setCollapsed(true)
            }}
            className="navbar-toggle-btn nav-item-hover opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            aria-label="Collapse sidebar"
            title="Collapse"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Expand toggle (visible only when collapsed) */}
      {collapsed && (
        <div className="flex justify-center pb-2">
          <button
            onClick={() => {
              haptics.selection()
              setCollapsed(false)
            }}
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
                  ? 'bg-theme-primary-subtle text-theme-primary font-semibold nav-item-indicator'
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-background',
              )}
            >
              <Icon active={isActive} />
              {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Actions Footer */}
      <div className="pb-4 space-y-1">
        {/* Add expense */}
        <button
          onClick={(e) => {
            haptics.selection()
            onAddExpense(e)
          }}
          data-testid="btn-add-expense"
          className={cn(
            'w-full flex items-center rounded-theme-medium text-theme-primary nav-item-hover hover:bg-theme-primary-subtle active:scale-95',
            collapsed ? 'justify-center py-2.5 px-2' : 'gap-3 py-2.5 px-3 mx-2',
          )}
          aria-label="Add expense"
        >
          <PlusIcon />
          {!collapsed && <span className="text-sm font-medium truncate">Add</span>}
        </button>

        {onSignOut && (
          <div
            className={cn('flex', collapsed ? 'justify-center py-1' : 'justify-start px-4 py-1')}
          >
            <SyncIndicator syncStatus={syncStatus} />
          </div>
        )}

        {onSignOut ? (
          <button
            onClick={(e) => {
              haptics.selection()
              onSignOut(e)
            }}
            className={cn(
              'w-full flex items-center rounded-theme-medium nav-item-hover text-theme-muted hover:text-theme-danger hover:bg-theme-danger-subtle',
              collapsed ? 'justify-center py-2.5 px-2' : 'gap-3 py-2.5 px-3 mx-2',
            )}
            title={userEmail}
          >
            <SignOutIcon />
            {!collapsed && (
              <div className="text-left overflow-hidden">
                <span className="text-sm font-medium block truncate">Sign out</span>
                {userEmail && (
                  <span className="text-[0.6875rem] text-theme-muted block truncate">
                    {userEmail}
                  </span>
                )}
              </div>
            )}
          </button>
        ) : showSignIn && onSignIn ? (
          <button
            onClick={() => {
              haptics.selection()
              onSignIn()
            }}
            className={cn(
              'w-full flex items-center rounded-theme-medium nav-item-hover text-theme-primary hover:bg-theme-primary-subtle',
              collapsed ? 'justify-center py-2.5 px-2' : 'gap-3 py-2.5 px-3 mx-2',
            )}
            title="Sign in to sync data across devices"
          >
            <svg
              className="w-6 h-6 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            {!collapsed && <span className="text-sm font-medium truncate">Sign in</span>}
          </button>
        ) : null}
      </div>
    </aside>
  )
}
