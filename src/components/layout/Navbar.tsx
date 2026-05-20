import { useState, type MouseEventHandler } from 'react'
import DesktopSidebar from './DesktopSidebar'
import MobileBottomNav from './MobileBottomNav'
import ConfirmDialog from '../ui/ConfirmDialog'
import type { SyncStatus } from '../../types'

interface NavbarProps {
  onAddExpense: MouseEventHandler<HTMLButtonElement>
  onSignIn?: () => void
  showSignIn?: boolean
  onSignOut?: () => void
  userEmail?: string
  scrollDirection?: 'up' | 'down' | null
  isScrolling?: boolean
  hidden?: boolean
  onCycleDashboardView?: () => void
  syncStatus?: SyncStatus
}

export default function Navbar(props: NavbarProps) {
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false)

  return (
    <>
      <DesktopSidebar
        onAddExpense={props.onAddExpense}
        syncStatus={props.syncStatus}
        onSignIn={props.onSignIn}
        showSignIn={props.showSignIn}
        onSignOut={props.onSignOut ? () => setIsSignOutConfirmOpen(true) : undefined}
        userEmail={props.userEmail}
        onCycleDashboardView={props.onCycleDashboardView}
      />
      <MobileBottomNav
        onAddExpense={props.onAddExpense}
        scrollDirection={props.scrollDirection}
        isScrolling={props.isScrolling}
        hidden={props.hidden}
        onCycleDashboardView={props.onCycleDashboardView}
      />
      <ConfirmDialog
        isOpen={isSignOutConfirmOpen}
        onClose={() => setIsSignOutConfirmOpen(false)}
        title="Sign out?"
        description="You’ll need to sign back in to resume cloud sync on this device."
        cancelLabel="Keep me signed in"
        confirmLabel="Sign out"
        confirmVariant="destructive"
        onConfirm={() => {
          props.onSignOut?.()
        }}
      />
    </>
  )
}

export type { NavbarProps }
