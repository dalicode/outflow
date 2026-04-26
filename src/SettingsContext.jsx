import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { StorageService } from './StorageService'
import { THEMES, getTheme, getCSSVariables } from './themeConfig'

const DEFAULTS = {
  theme: 'system',
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

  useEffect(() => {
    StorageService.getSetting('uiSettings', null).then((saved) => {
      if (saved) setSettings((s) => ({ ...s, ...saved }))
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!loaded) return
    const root = document.documentElement
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark)
    root.classList.toggle('dark', isDark)
  }, [settings.theme, loaded])

  useEffect(() => {
    if (!loaded) return
    document.documentElement.style.fontFamily = FONT_MAP[settings.font] ?? 'inherit'
    document.documentElement.style.fontSize = `${settings.fontSize}rem`
  }, [settings.font, settings.fontSize, loaded])

  useEffect(() => {
    if (!loaded) return
    const theme = getTheme(settings.visualTheme)
    const cssVars = getCSSVariables(theme)
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
    }
  }, [settings])

  const formatAmount = useCallback((n, options = {}) => {
    if (n == null) return '—'
    const dec = parseInt(settings.decimalPlaces, 10)
    const sep = settings.thousandSep
    const parts = Math.abs(n).toFixed(dec).split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,
      sep === ',' ? ',' : sep === '.' ? '.' : '\u00A0')
    const formatted = dec > 0 ? parts.join(sep === '.' ? ',' : '.') : parts[0]
    let result = `${n < 0 ? '-' : ''}${settings.currencySymbol}${formatted}`
    if (options.color !== false) {
      const theme = getTheme(settings.visualTheme)
      if (n > 0 && theme.numberStyle.positiveColor) {
        result = `<span style="color:${theme.numberStyle.positiveColor}">${result}</span>`
      } else if (n < 0 && theme.numberStyle.negativeColor) {
        result = `<span style="color:${theme.numberStyle.negativeColor}">${result}</span>`
      }
    }
    return result
  }, [settings.currencySymbol, settings.decimalPlaces, settings.thousandSep, settings.visualTheme])

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

  const getThemeColors = useCallback(() => {
    return getTheme(settings.visualTheme)
  }, [settings.visualTheme])

  const currentTheme = useMemo(() => {
    return getTheme(settings.visualTheme)
  }, [settings.visualTheme])

  const value = useMemo(() => ({
    settings,
    save,
    formatAmount,
    formatAmountPlain,
    formatDate,
    loaded,
    getThemeColors,
    currentTheme,
    availableThemes: THEMES,
  }), [settings, save, formatAmount, formatAmountPlain, formatDate, loaded, getThemeColors, currentTheme])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}