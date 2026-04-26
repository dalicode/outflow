import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { StorageService } from './StorageService'
import { THEMES, getTheme, getCSSVariables } from './themeConfig'
import { supabase } from './supabase'
import { syncThemeToProfile, fetchThemeFromProfile } from './SyncEngine'

const DEFAULTS = {
  visualTheme: 'default',
  font: 'system',
  fontSize: '1',
  currencySymbol: '$',
  decimalPlaces: '2',
  thousandSep: ',',
  dateFormat: 'MM/DD/YYYY',
}

const FONT_MAP = {
  system: 'inherit',
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, serif',
  mono: 'ui-monospace, monospace',
}

const SettingsContext = createContext(null)
export const useSettings = () => useContext(SettingsContext)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const cssVarsRef = useRef(null)

  // Load settings on mount
  useEffect(() => {
    let cancelled = false
    StorageService.getSetting('uiSettings', null).then(async (saved) => {
      if (cancelled) return
      const next = saved ? { ...DEFAULTS, ...saved } : { ...DEFAULTS }
      // If logged in, try to fetch theme from profile for cross-device sync
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          const profileTheme = await fetchThemeFromProfile(session.user.id)
          if (profileTheme && THEMES[profileTheme]) {
            next.visualTheme = profileTheme
          }
        }
      }
      setSettings(next)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  // Apply dark mode class based on selected visual theme
  useEffect(() => {
    if (!loaded) return
    const theme = getTheme(settings.visualTheme)
    const root = document.documentElement
    root.classList.toggle('dark', !!theme.isDark)
  }, [settings.visualTheme, loaded])

  // Apply font settings
  useEffect(() => {
    if (!loaded) return
    document.documentElement.style.fontFamily = FONT_MAP[settings.font] ?? 'inherit'
    document.documentElement.style.fontSize = `${settings.fontSize}rem`
  }, [settings.font, settings.fontSize, loaded])

  // Apply theme CSS variables with memoization
  useEffect(() => {
    if (!loaded) return
    const theme = getTheme(settings.visualTheme)
    const cssVars = getCSSVariables(theme)
    // Only update if variables actually changed
    const prev = cssVarsRef.current
    const changed = !prev || Object.entries(cssVars).some(([k, v]) => prev[k] !== v)
    if (!changed) return
    cssVarsRef.current = cssVars
    const root = document.documentElement
    for (const [key, value] of Object.entries(cssVars)) {
      root.style.setProperty(key, value)
    }
    if (theme.glassEffect) {
      root.setAttribute('data-theme', 'glass')
    } else {
      root.removeAttribute('data-theme')
    }
  }, [settings.visualTheme, loaded])

  const save = useCallback(async (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    await StorageService.setSetting('uiSettings', next)
    if (patch.visualTheme) {
      await StorageService.setSetting('selectedTheme', patch.visualTheme)
      // Sync theme to Supabase profile for cross-device consistency
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          await syncThemeToProfile(session.user.id, patch.visualTheme)
        }
      }
    }
  }, [settings])

  const formatAmount = useCallback((n) => {
    if (n == null) return '—'
    const dec = parseInt(settings.decimalPlaces, 10)
    const sep = settings.thousandSep
    const parts = Math.abs(n).toFixed(dec).split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,
      sep === ',' ? ',' : sep === '.' ? '.' : '\u00A0')
    const formatted = dec > 0 ? parts.join(sep === '.' ? ',' : '.') : parts[0]
    return `${n < 0 ? '-' : ''}${settings.currencySymbol}${formatted}`
  }, [settings.currencySymbol, settings.decimalPlaces, settings.thousandSep])

  const getNumberColorClass = useCallback((n) => {
    if (n == null) return 'currency-number'
    if (n > 0) return 'positive-number'
    if (n < 0) return 'negative-number'
    return 'currency-number'
  }, [])

  const formatAmountPlain = useCallback((n) => {
    if (n == null) return '—'
    const dec = parseInt(settings.decimalPlaces, 10)
    const sep = settings.thousandSep
    const parts = Math.abs(n).toFixed(dec).split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,
      sep === ',' ? ',' : sep === '.' ? '.' : '\u00A0')
    const formatted = dec > 0 ? parts.join(sep === '.' ? ',' : '.') : parts[0]
    return `${n < 0 ? '-' : ''}${settings.currencySymbol}${formatted}`
  }, [settings.currencySymbol, settings.decimalPlaces, settings.thousandSep])

  const formatDate = useCallback((iso) => {
    if (!iso) return ''
    const [y, m, d] = iso.slice(0, 10).split('-')
    switch (settings.dateFormat) {
      case 'DD/MM/YYYY': return `${d}/${m}/${y}`
      case 'YYYY-MM-DD': return `${y}-${m}/${d}`
      default: return `${m}/${d}/${y}`
    }
  }, [settings.dateFormat])

  const currentTheme = useMemo(() => {
    return getTheme(settings.visualTheme)
  }, [settings.visualTheme])

  const cssVariables = useMemo(() => {
    return getCSSVariables(currentTheme)
  }, [currentTheme])

  const value = useMemo(() => ({
    settings,
    save,
    formatAmount,
    getNumberColorClass,
    formatAmountPlain,
    formatDate,
    loaded,
    currentTheme,
    cssVariables,
    availableThemes: THEMES,
  }), [settings, save, formatAmount, getNumberColorClass, formatAmountPlain, formatDate, loaded, currentTheme, cssVariables])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
