export const SW_UPDATE_READY_EVENT = 'outflow:sw-update-ready'

export interface ServiceWorkerUpdateCheckResult {
  registration: ServiceWorkerRegistration | null
  updateFound: boolean
}

export function notifyServiceWorkerUpdateReady(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SW_UPDATE_READY_EVENT))
}

export async function checkForServiceWorkerUpdate(
  registration?: ServiceWorkerRegistration | null,
): Promise<ServiceWorkerUpdateCheckResult> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return {
      registration: registration ?? null,
      updateFound: false,
    }
  }

  if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
    return {
      registration: registration ?? null,
      updateFound: false,
    }
  }

  const latestRegistration = await navigator.serviceWorker.getRegistration()
  const activeRegistration = latestRegistration ?? registration ?? null

  if (!activeRegistration) {
    return {
      registration: null,
      updateFound: false,
    }
  }

  await activeRegistration.update()

  const updateFound = Boolean(activeRegistration.waiting)
  if (updateFound) {
    notifyServiceWorkerUpdateReady()
  }

  return {
    registration: activeRegistration,
    updateFound,
  }
}
