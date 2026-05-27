import { useMemo } from 'react'
import { useSettings } from '../../../context/settingsContext'

export interface ThemeColors {
  primary: string
  secondary: string
  success: string
  danger: string
  text: string
  muted: string
  surface: string
  background: string
  grid: string
  chartPalette: string[]
}

export function useThemeColors(): ThemeColors {
  const { currentTheme } = useSettings()
  return useMemo(() => {
    const p = currentTheme.colors.primary
    const s = currentTheme.colors.secondary
    const su = currentTheme.colors.success
    const d = currentTheme.colors.danger
    const t = currentTheme.colors.text
    const m = currentTheme.colors.muted
    return {
      primary: p,
      secondary: s,
      success: su,
      danger: d,
      text: t,
      muted: m,
      surface: currentTheme.colors.surface,
      background: currentTheme.colors.background,
      grid: currentTheme.colors.border,
      chartPalette: [p, s, d, t, m, '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'],
    }
  }, [currentTheme])
}
