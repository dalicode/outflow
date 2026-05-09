import { useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/cn'

const AUTO_DISMISS_MS = 4000

function getInitialOnlineState(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export default function OfflineStatusBadge() {
  const [isOnline, setIsOnline] = useState<boolean>(getInitialOnlineState)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setIsOnline(true)
      setDismissed(false)
      setVisible(false)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setDismissed(false)
      setVisible(true)

      // Auto-dismiss after a few seconds
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Show on mount if already offline
    if (!navigator.onLine) {
      setVisible(true)
      timerRef.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    setDismissed(true)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  if (isOnline || !visible || dismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[84] flex justify-center px-3"
    >
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-3 rounded-theme-medium border px-3 py-2.5 shadow-md',
          'bg-theme-surface border-theme-border text-theme-text',
        )}
      >
        <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-theme-muted" />
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-semibold">Offline</span>
          <span className="text-xs text-theme-muted">Changes are saved on this device.</span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 ml-1 text-theme-muted hover:text-theme-text transition-colors"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
