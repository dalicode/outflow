export function applyDisplayModeClasses(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const nav = window.navigator as Navigator & {
    standalone?: boolean
  }

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches || Boolean(nav.standalone)

  const isIOS =
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)

  const root = document.documentElement
  root.classList.toggle('is-standalone', isStandalone)
  root.classList.toggle('is-ios', isIOS)
  root.classList.toggle('is-ios-standalone', isIOS && isStandalone)
}
