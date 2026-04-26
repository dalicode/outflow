export const THEMES = {
  default: {
    name: 'Default (Clean)',
    id: 'default',
    colors: {
      background: '#f8fafc',
      surface: '#ffffff',
      primary: '#6366f1',
      secondary: '#8b5cf6',
      text: '#1e293b',
      muted: '#64748b',
      border: '#e2e8f0',
      danger: '#ef4444',
      success: '#22c55e',
    },
    borderRadius: {
      small: '8px',
      medium: '10px',
      large: '12px',
    },
    numberStyle: {
      currencyColor: 'text',
      positiveColor: '#16a34a',
      negativeColor: '#dc2626',
    },
  },
  modernSoft: {
    name: 'Modern Soft',
    id: 'modernSoft',
    colors: {
      background: '#f5f3ff',
      surface: '#ffffff',
      primary: '#a78bfa',
      secondary: '#f472b6',
      text: '#1f1642',
      muted: '#6b7280',
      border: '#ede9fe',
      danger: '#f87171',
      success: '#4ade80',
    },
    borderRadius: {
      small: '16px',
      medium: '20px',
      large: '24px',
    },
    numberStyle: {
      currencyColor: 'text',
      positiveColor: '#10b981',
      negativeColor: '#ef4444',
    },
  },
  sharpProfessional: {
    name: 'Sharp Professional',
    id: 'sharpProfessional',
    colors: {
      background: '#f1f5f9',
      surface: '#ffffff',
      primary: '#334155',
      secondary: '#475569',
      text: '#0f172a',
      muted: '#475569',
      border: '#cbd5e1',
      danger: '#b91c1c',
      success: '#15803d',
    },
    borderRadius: {
      small: '2px',
      medium: '4px',
      large: '6px',
    },
    numberStyle: {
      currencyColor: 'text',
      positiveColor: '#15803d',
      negativeColor: '#b91c1c',
    },
  },
  darkMinimal: {
    name: 'Dark Minimal',
    id: 'darkMinimal',
    colors: {
      background: '#09090b',
      surface: '#18181b',
      primary: '#a1a1aa',
      secondary: '#71717a',
      text: '#fafafa',
      muted: '#52525b',
      border: '#27272a',
      danger: '#f87171',
      success: '#4ade80',
    },
    borderRadius: {
      small: '6px',
      medium: '8px',
      large: '10px',
    },
    numberStyle: {
      currencyColor: 'text',
      positiveColor: '#4ade80',
      negativeColor: '#f87171',
    },
  },
  financeGlass: {
    name: 'Finance Glass',
    id: 'financeGlass',
    colors: {
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      surface: 'rgba(255, 255, 255, 0.08)',
      primary: '#818cf8',
      secondary: '#c084fc',
      text: '#ffffff',
      muted: '#a5b4fc',
      border: 'rgba(255, 255, 255, 0.15)',
      danger: '#f87171',
      success: '#4ade80',
    },
    borderRadius: {
      small: '14px',
      medium: '16px',
      large: '18px',
    },
    numberStyle: {
      currencyColor: 'text',
      positiveColor: '#34d399',
      negativeColor: '#fb7185',
    },
    glassEffect: true,
  },
}

export const LIGHT_THEME_DEFAULTS = {
  ...THEMES.default,
}

export const DARK_THEME_DEFAULTS = {
  ...THEMES.darkMinimal,
}

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES.default
}

export function getCSSVariables(theme) {
  const vars = {}
  const entries = [
    ['--theme-background', theme.colors.background],
    ['--theme-surface', theme.colors.surface],
    ['--theme-primary', theme.colors.primary],
    ['--theme-secondary', theme.colors.secondary],
    ['--theme-text', theme.colors.text],
    ['--theme-muted', theme.colors.muted],
    ['--theme-border', theme.colors.border],
    ['--theme-danger', theme.colors.danger],
    ['--theme-success', theme.colors.success],
    ['--radius-small', theme.borderRadius.small],
    ['--radius-medium', theme.borderRadius.medium],
    ['--radius-large', theme.borderRadius.large],
    ['--currency-color', theme.numberStyle.currencyColor],
    ['--positive-color', theme.numberStyle.positiveColor],
    ['--negative-color', theme.numberStyle.negativeColor],
  ]
  for (const [key, value] of entries) {
    vars[key] = value
  }
  return vars
}