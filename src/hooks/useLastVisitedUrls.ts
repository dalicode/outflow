import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'

const STORAGE_KEY = 'outflow:last-visited-urls'

const PAGE_KEYS: Record<string, string> = {
  dashboard: ROUTES.DASHBOARD,
  summary: ROUTES.SUMMARY,
  analytics: ROUTES.ANALYTICS,
  payees: ROUTES.PAYEES,
  settings: ROUTES.SETTINGS,
}

type PageKey = keyof typeof PAGE_KEYS

const TRANSIENT_PAGE_KEYS = new Set<PageKey>(['dashboard'])
const transientLastUrls: Partial<Record<PageKey, string>> = {}

function getPageKeyFromPathname(pathname: string): PageKey | null {
  for (const [key, route] of Object.entries(PAGE_KEYS)) {
    if (route === '/') {
      if (pathname === '/' || pathname === '') return key as PageKey
    } else {
      if (pathname === route || pathname.startsWith(route)) {
        return key as PageKey
      }
    }
  }
  return null
}

function loadLastUrls(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {}
}

function saveLastUrls(urls: Record<string, string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(urls))
  } catch {
    // ignore
  }
}

export function useLastVisitedUrls() {
  const location = useLocation()
  const savedRef = useRef('')

  useEffect(() => {
    const pageKey = getPageKeyFromPathname(location.pathname)
    if (!pageKey) return

    const currentUrl = `${location.pathname}${location.search}`
    if (TRANSIENT_PAGE_KEYS.has(pageKey)) {
      if (transientLastUrls[pageKey] === currentUrl) return
      transientLastUrls[pageKey] = currentUrl
      savedRef.current = currentUrl
      return
    }

    const lastUrls = loadLastUrls()
    if (lastUrls[pageKey] === currentUrl) return

    lastUrls[pageKey] = currentUrl
    saveLastUrls(lastUrls)
    savedRef.current = currentUrl
  }, [location.pathname, location.search])

  const getRememberedUrl = useCallback((pageKey: PageKey): string => {
    if (TRANSIENT_PAGE_KEYS.has(pageKey)) {
      return transientLastUrls[pageKey] ?? PAGE_KEYS[pageKey]
    }

    const lastUrls = loadLastUrls()
    return lastUrls[pageKey] ?? PAGE_KEYS[pageKey]
  }, [])

  return { getRememberedUrl }
}
