import type { ThemeConfig } from '../types'

export const THEMES: Record<string, ThemeConfig> = {
  default: {
    name: 'Sharp Professional',
    id: 'default',
    colors: {
      background: '#f1f5f9',
      surface: '#ffffff',
      primary: '#334155',
      secondary: '#475569',
      warning: '#c2410c',
      text: '#0f172a',
      muted: '#334155',
      border: '#cbd5e1',
      danger: '#b91c1c',
      success: '#15803d',
    },
    borderRadius: {
      small: '2px',
      medium: '4px',
      large: '6px',
    },
    spacing: {
      tight: '0.25rem',
      normal: '0.75rem',
      loose: '1rem',
    },
    numberStyle: {
      currencyColor: 'var(--theme-text)',
      positiveColor: 'var(--theme-text)',
      negativeColor: 'var(--theme-success)',
      zeroColor: 'var(--theme-muted)',
    },
  },
  sharpProfessionalDark: {
    name: 'Sharp Professional Dark',
    id: 'sharpProfessionalDark',
    isDark: true,
    colors: {
      background: '#0f172a',
      surface: '#1e293b',
      primary: '#94a3b8',
      secondary: '#64748b',
      warning: '#fb923c',
      text: '#f1f5f9',
      muted: '#94a3b8',
      border: '#334155',
      danger: '#f87171',
      success: '#4ade80',
    },
    borderRadius: {
      small: '2px',
      medium: '4px',
      large: '6px',
    },
    spacing: {
      tight: '0.25rem',
      normal: '0.75rem',
      loose: '1rem',
    },
    numberStyle: {
      currencyColor: 'var(--theme-text)',
      positiveColor: 'var(--theme-text)',
      negativeColor: 'var(--theme-success)',
      zeroColor: 'var(--theme-muted)',
    },
  },
  sharpProfessionalSteel: {
    name: 'Sharp Professional Steel',
    id: 'sharpProfessionalSteel',
    isDark: true,
    colors: {
      background: '#101820',
      surface: '#18232e',
      primary: '#8fb3c9',
      secondary: '#5f7f95',
      warning: '#f6ad55',
      text: '#edf4f8',
      muted: '#a8bac6',
      border: '#2b3b47',
      danger: '#ff7a7a',
      success: '#5ee0a1',
    },
    borderRadius: {
      small: '2px',
      medium: '4px',
      large: '6px',
    },
    spacing: {
      tight: '0.25rem',
      normal: '0.75rem',
      loose: '1rem',
    },
    numberStyle: {
      currencyColor: 'var(--theme-text)',
      positiveColor: 'var(--theme-text)',
      negativeColor: 'var(--theme-success)',
      zeroColor: 'var(--theme-muted)',
    },
  },
  darkMinimal: {
    name: 'Dark Minimal',
    id: 'darkMinimal',
    isDark: true,
    colors: {
      background: '#09090b',
      surface: '#18181b',
      primary: '#a1a1aa',
      secondary: '#71717a',
      warning: '#f59e0b',
      text: '#fafafa',
      muted: '#a1a1aa',
      border: '#27272a',
      danger: '#f87171',
      success: '#4ade80',
    },
    borderRadius: {
      small: '6px',
      medium: '8px',
      large: '10px',
    },
    spacing: {
      tight: '0.5rem',
      normal: '1rem',
      loose: '1.5rem',
    },
    numberStyle: {
      currencyColor: 'var(--theme-text)',
      positiveColor: 'var(--theme-text)',
      negativeColor: 'var(--theme-success)',
      zeroColor: 'var(--theme-muted)',
    },
  },
  runescapeClassic: {
    name: 'RuneScape Classic',
    id: 'runescapeClassic',
    isDark: true,
    colors: {
      background: '#2b2118',
      surface: '#3d2e22',
      primary: '#c9a34e',
      secondary: '#8b6914',
      warning: '#c08a3c',
      text: '#eadfcb',
      muted: '#c4b5a0',
      border: '#4a3728',
      danger: '#b85450',
      success: '#6b8e6b',
    },
    borderRadius: {
      small: '3px',
      medium: '6px',
      large: '8px',
    },
    spacing: {
      tight: '0.5rem',
      normal: '1rem',
      loose: '1.5rem',
    },
    numberStyle: {
      currencyColor: 'var(--theme-primary)',
      positiveColor: 'var(--theme-text)',
      negativeColor: 'var(--theme-success)',
      zeroColor: 'var(--theme-muted)',
    },
  },
}

export const LIGHT_THEME_DEFAULTS: ThemeConfig = {
  ...THEMES.default,
}

export const DARK_THEME_DEFAULTS: ThemeConfig = {
  ...THEMES.darkMinimal,
}

export function getTheme(themeId: string): ThemeConfig {
  return THEMES[themeId] || THEMES.default
}

export function getCSSVariables(theme: ThemeConfig): Record<string, string> {
  const vars: Record<string, string> = {}
  const entries: [string, string][] = [
    ['--theme-background', theme.colors.background],
    ['--theme-surface', theme.colors.surface],
    ['--theme-primary', theme.colors.primary],
    ['--theme-secondary', theme.colors.secondary],
    ['--theme-warning', theme.colors.warning],
    ['--theme-text', theme.colors.text],
    ['--theme-muted', theme.colors.muted],
    ['--theme-border', theme.colors.border],
    ['--theme-danger', theme.colors.danger],
    ['--theme-success', theme.colors.success],
    ['--radius-small', theme.borderRadius.small],
    ['--radius-medium', theme.borderRadius.medium],
    ['--radius-large', theme.borderRadius.large],
    ['--spacing-tight', theme.spacing.tight],
    ['--spacing-normal', theme.spacing.normal],
    ['--spacing-loose', theme.spacing.loose],
    ['--currency-color', theme.numberStyle.currencyColor],
    ['--positive-color', theme.numberStyle.positiveColor],
    ['--negative-color', theme.numberStyle.negativeColor],
    ['--number-currency', theme.numberStyle.currencyColor],
    ['--number-positive', theme.numberStyle.positiveColor],
    ['--number-negative', theme.numberStyle.negativeColor],
    ['--number-zero', theme.numberStyle.zeroColor],
  ]
  for (const [key, value] of entries) {
    vars[key] = value
  }
  if (theme.glassEffect) {
    vars['--glass-blur'] = '12px'
    vars['--glass-opacity'] = '0.08'
  } else {
    vars['--glass-blur'] = '0px'
    vars['--glass-opacity'] = '0'
  }
  return vars
}
