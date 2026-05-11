import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { cn } from '../../utils/cn'

const SW_UPDATE_KEY = 'sw:updateApplied'

export default function PWAUpdatePrompt() {
  const [dismissed, setDismissed] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registration?.update().catch(() => undefined)
    },
  })

  // Handle "Update" — mark the update as intentional before reloading
  const handleUpdate = useCallback(() => {
    sessionStorage.setItem(SW_UPDATE_KEY, 'true')
    updateServiceWorker(true)
  }, [updateServiceWorker])

  // Ignore controllerchange when it's from our own intentional update
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handleControllerChange = () => {
      if (sessionStorage.getItem(SW_UPDATE_KEY) === 'true') {
        sessionStorage.removeItem(SW_UPDATE_KEY)
        return
      }
      setNeedRefresh(true)
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [setNeedRefresh])

  const isVisible = useMemo(() => {
    if (dismissed) return false
    return needRefresh
  }, [dismissed, needRefresh])

  if (!isVisible) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[85] flex justify-center px-3 sm:justify-end sm:px-6"
    >
      <section
        className={cn(
          'pointer-events-auto w-full max-w-md rounded-theme-medium border px-4 py-3 shadow-lg backdrop-blur-sm',
          'bg-theme-surface border-theme-border text-theme-text',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">A new version of Outflow is ready.</p>
            <p className="mt-1 text-xs leading-5 text-theme-muted">
              Update when you are ready. Your data stays on this device.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss update prompt"
            onClick={() => setDismissed(true)}
            className="shrink-0 text-theme-muted transition-colors hover:text-theme-text"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="btn-modal-cancel px-4"
          >
            Later
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            className="btn-modal-primary px-4"
          >
            Update
          </button>
        </div>
      </section>
    </div>
  )
}
