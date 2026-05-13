import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { StorageService } from '../services/storageService'
import type { AppSettings, ThemeConfig } from '../types'
import { getCSSVariables, getTheme, THEMES } from '../utils/themeConfig'

const DEFAULTS: AppSettings = {
  visualTheme: 'default',
  font: 'system',
  fontSize: '1',
  currencySymbol: '$',
  decimalPlaces: '2',
  thousandSep: ',',
  dateFormat: 'MM/DD/YYYY',
  hapticsEnabled: true,
  enableCheckInReminders: false,
  reminderTime: '20:00',
  reminderDays: ['0', '1', '2', '3', '4', '5', '6'],
  reminderStyle: 'gentle',
}

const PRIVACY_MODE_SETTING_KEY = 'localPrivacyModeEnabled'

const FONT_MAP: Record<string, string> = {
  system:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", Arial, sans-serif',
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, serif',
  mono: 'ui-monospace, monospace',
  roboto: 'Roboto, "Helvetica Neue", Arial, sans-serif',
  georgia: 'Georgia, Cambria, "Times New Roman", serif',
  financeMono:
    'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
}

interface SettingsContextValue {
  settings: AppSettings
  save: (patch: Partial<AppSettings>) => Promise<void>
  loadSettings: () => Promise<void>
  privacyModeEnabled: boolean
  togglePrivacyMode: () => Promise<void>
  currentTheme: ThemeConfig
  themeColors: ThemeConfig['colors']
  currency: (n: number | null | undefined) => string
  formatAmount: (n: number | null | undefined) => string
  formatAmountPlain: (n: number | null | undefined) => string
  getNumberColorClass: (n: number | null | undefined) => string
  formatDate: (iso: string) => string
  formatMonth: (n: number) => string
  formatShortMonth: (n: number) => string
  loaded: boolean
  availableThemes: Record<string, ThemeConfig>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)
export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS)
  const [privacyModeEnabled, setPrivacyModeEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const cssVarsRef = useRef<Record<string, string> | null>(null)

  useEffect(() => {
    let cancelled = false
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null

    Promise.all([
      StorageService.getSetting('uiSettings', null),
      StorageService.getSetting(PRIVACY_MODE_SETTING_KEY, false),
    ])
      .then(([saved, savedPrivacyMode]: [unknown, unknown]) => {
        if (cancelled) return
        const savedSettings =
          saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : null
        const next = saved
          ? { ...DEFAULTS, ...savedSettings }
          : { ...DEFAULTS }
        setSettings(next as AppSettings)
        setPrivacyModeEnabled(Boolean(savedPrivacyMode))
        setLoaded(true)
        if (fallbackTimer) clearTimeout(fallbackTimer)
      })
      .catch((err: Error) => {
        console.warn('Settings load error:', err)
        if (!cancelled) {
          setSettings({ ...DEFAULTS })
          setLoaded(true)
          if (fallbackTimer) clearTimeout(fallbackTimer)
        }
      })

    fallbackTimer = setTimeout(() => {
      if (!cancelled) {
        console.warn('Settings load timeout — forcing unlock')
        setSettings((prev) => (prev.visualTheme ? prev : { ...DEFAULTS }))
        setLoaded(true)
      }
    }, 2000)

    return () => {
      cancelled = true
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    const theme = getTheme(settings.visualTheme)
    const root = document.documentElement
    root.classList.toggle('dark', !!(theme as ThemeConfig & { isDark?: boolean }).isDark)
  }, [settings.visualTheme, loaded])

  useEffect(() => {
    if (!loaded) return
    document.documentElement.style.fontFamily = FONT_MAP[settings.font] ?? 'inherit'
    document.documentElement.style.fontSize = `${settings.fontSize}rem`
  }, [settings.font, settings.fontSize, loaded])

  useEffect(() => {
    if (!loaded) return
    const theme = getTheme(settings.visualTheme)
    const cssVars = getCSSVariables(theme)
    const prev = cssVarsRef.current
    const changed = !prev || Object.entries(cssVars).some(([k, v]) => prev[k] !== v)
    if (!changed) return
    cssVarsRef.current = cssVars
    const root = document.documentElement
    for (const [key, value] of Object.entries(cssVars)) {
      root.style.setProperty(key, value)
    }
    if ((theme as ThemeConfig & { glassEffect?: boolean }).glassEffect) {
      root.setAttribute('data-theme', 'glass')
    } else {
      root.removeAttribute('data-theme')
    }
    root.setAttribute('data-theme-mode', theme.isDark ? 'dark' : 'light')
  }, [settings.visualTheme, loaded])

  const loadSettings = useCallback(async () => {
    try {
      const [saved, savedPrivacyMode] = await Promise.all([
        StorageService.getSetting('uiSettings', null),
        StorageService.getSetting(PRIVACY_MODE_SETTING_KEY, false),
      ])
      const next = saved ? { ...DEFAULTS, ...(saved as Record<string, unknown>) } : { ...DEFAULTS }
      setSettings(next as AppSettings)
      setPrivacyModeEnabled(Boolean(savedPrivacyMode))
    } catch (err) {
      console.warn('Settings reload error:', err)
    }
  }, [])

  const togglePrivacyMode = useCallback(async () => {
    const next = !privacyModeEnabled
    setPrivacyModeEnabled(next)
    await StorageService.setLocalSetting(PRIVACY_MODE_SETTING_KEY, next)
  }, [privacyModeEnabled])

  const save = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = { ...settings, ...patch }
      setSettings(next)
      await StorageService.setSetting('uiSettings', next)
    },
    [settings],
  )

  const currency = useCallback(
    (n: number | null | undefined) => {
      if (n == null) return '—'
      const dec = parseInt(settings.decimalPlaces, 10)
      const sep = settings.thousandSep
      const parts = Math.abs(n).toFixed(dec).split('.')
      parts[0] = parts[0].replace(
        /\B(?=(\d{3})+(?!\d))/g,
        sep === ',' ? ',' : sep === '.' ? '.' : '\u00A0',
      )
      const formatted = dec > 0 ? parts.join(sep === '.' ? ',' : '.') : parts[0]
      return `${n < 0 ? '-' : ''}${settings.currencySymbol}${formatted}`
    },
    [settings.currencySymbol, settings.decimalPlaces, settings.thousandSep],
  )

  const formatAmount = currency
  const formatAmountPlain = currency

  const getNumberColorClass = useCallback((n: number | null | undefined) => {
    if (n == null) return 'currency-number'
    if (n < 0) return 'negative-number'
    if (n > 0) return 'positive-number'
    return 'zero-number'
  }, [])

  const formatDate = useCallback(
    (iso: string) => {
      if (!iso) return ''
      const [y, m, d] = iso.slice(0, 10).split('-')
      switch (settings.dateFormat) {
        case 'DD/MM/YYYY':
          return `${d}/${m}/${y}`
        case 'YYYY-MM-DD':
          return `${y}-${m}-${d}`
        default:
          return `${m}/${d}/${y}`
      }
    },
    [settings.dateFormat],
  )

  const formatMonth = useCallback((n: number) => {
    const names = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]
    return names[n - 1] ?? ''
  }, [])

  const formatShortMonth = useCallback((n: number) => {
    const names = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    return names[n - 1] ?? ''
  }, [])

  const currentTheme = useMemo(() => getTheme(settings.visualTheme), [settings.visualTheme])

  const value = useMemo(
    () => ({
      settings,
      save,
      loadSettings,
      privacyModeEnabled,
      togglePrivacyMode,
      currentTheme,
      themeColors: currentTheme.colors,
      currency,
      formatAmount,
      formatAmountPlain,
      getNumberColorClass,
      formatDate,
      formatMonth,
      formatShortMonth,
      loaded,
      availableThemes: THEMES,
    }),
    [
      settings,
      save,
      loadSettings,
      privacyModeEnabled,
      togglePrivacyMode,
      currentTheme,
      currency,
      formatAmount,
      formatAmountPlain,
      getNumberColorClass,
      formatDate,
      formatMonth,
      formatShortMonth,
      loaded,
    ],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
