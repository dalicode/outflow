import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream
  )
}

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isInStandaloneMode()) return // already installed

    if (isIOS()) {
      // Show iOS hint after a short delay so it doesn't flash on load
      const t = setTimeout(() => setShowIOSHint(true), 2000)
      return () => clearTimeout(t)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    const installedHandler = () => setInstallEvent(null)

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstall = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') setInstallEvent(null)
  }

  if (dismissed) return null

  // iOS Safari — manual install hint
  if (showIOSHint) {
    return (
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[85] flex justify-center px-4 sm:bottom-6"
      >
        <section className="pointer-events-auto w-full max-w-sm rounded-theme-large border border-theme-border bg-theme-surface px-4 py-3 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/icon.svg" alt="" className="w-10 h-10 shrink-0 rounded-theme-medium" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-theme-text">Install Outflow</p>
                <p className="text-xs text-theme-muted mt-0.5 leading-relaxed">
                  Tap{' '}
                  <span className="inline-flex items-center gap-0.5 font-medium text-theme-text">
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                    Share
                  </span>{' '}
                  then <span className="font-medium text-theme-text">Add to Home Screen</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setDismissed(true)}
              className="shrink-0 text-theme-muted hover:text-theme-text transition-colors"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          {/* Arrow pointing down toward Safari toolbar */}
          <div className="flex justify-center mt-2">
            <svg
              className="w-5 h-5 text-theme-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </section>
      </div>
    )
  }

  // Android/Desktop Chrome — native install prompt
  if (!installEvent) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[85] flex justify-center px-4 sm:bottom-6 sm:justify-end sm:px-6"
    >
      <section className="pointer-events-auto w-full max-w-sm rounded-theme-large border border-theme-border bg-theme-surface px-4 py-3 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/icon.svg" alt="" className="w-10 h-10 shrink-0 rounded-theme-medium" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-theme-text">Install Outflow</p>
              <p className="text-xs text-theme-muted mt-0.5">
                Add to your home screen for the best experience.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="shrink-0 text-theme-muted hover:text-theme-text transition-colors"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="btn-modal-cancel flex-1"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="btn-modal-primary flex-1"
          >
            Install
          </button>
        </div>
      </section>
    </div>
  )
}
