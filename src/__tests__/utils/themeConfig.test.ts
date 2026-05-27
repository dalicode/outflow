import { describe, expect, it } from 'vitest'
import {
  DARK_THEME_DEFAULTS,
  getCSSVariables,
  getTheme,
  LIGHT_THEME_DEFAULTS,
  THEMES,
} from '@/utils/themeConfig'

describe('THEMES', () => {
  it('contains all expected theme IDs', () => {
    const expectedIds = [
      'default',
      'sharpProfessionalDark',
      'sharpProfessionalSteel',
      'darkMinimal',
      'runescapeClassic',
    ]
    expectedIds.forEach((id) => {
      expect(THEMES[id]).toBeDefined()
      expect(THEMES[id].id).toBe(id)
    })
  })

  it('has required color properties on each theme', () => {
    Object.values(THEMES).forEach((theme) => {
      expect(theme.colors.background).toBeDefined()
      expect(theme.colors.surface).toBeDefined()
      expect(theme.colors.primary).toBeDefined()
      expect(theme.colors.secondary).toBeDefined()
      expect(theme.colors.warning).toBeDefined()
      expect(theme.colors.text).toBeDefined()
      expect(theme.colors.muted).toBeDefined()
      expect(theme.colors.border).toBeDefined()
      expect(theme.colors.danger).toBeDefined()
      expect(theme.colors.success).toBeDefined()
    })
  })

  it('has required borderRadius properties on each theme', () => {
    Object.values(THEMES).forEach((theme) => {
      expect(theme.borderRadius.small).toBeDefined()
      expect(theme.borderRadius.medium).toBeDefined()
      expect(theme.borderRadius.large).toBeDefined()
    })
  })

  it('has required spacing properties on each theme', () => {
    Object.values(THEMES).forEach((theme) => {
      expect(theme.spacing.tight).toBeDefined()
      expect(theme.spacing.normal).toBeDefined()
      expect(theme.spacing.loose).toBeDefined()
    })
  })

  it('has required numberStyle properties on each theme', () => {
    Object.values(THEMES).forEach((theme) => {
      expect(theme.numberStyle.currencyColor).toBeDefined()
      expect(theme.numberStyle.positiveColor).toBeDefined()
      expect(theme.numberStyle.negativeColor).toBeDefined()
      expect(theme.numberStyle.zeroColor).toBeDefined()
    })
  })

  it('marks dark themes with isDark flag', () => {
    expect(THEMES.sharpProfessionalDark.isDark).toBe(true)
    expect(THEMES.sharpProfessionalSteel.isDark).toBe(true)
    expect(THEMES.darkMinimal.isDark).toBe(true)
    expect(THEMES.runescapeClassic.isDark).toBe(true)
  })

  it('does not mark light themes with isDark', () => {
    expect(THEMES.default.isDark).toBeUndefined()
  })
})

describe('getTheme', () => {
  it('returns the requested theme by ID', () => {
    const theme = getTheme('darkMinimal')
    expect(theme.id).toBe('darkMinimal')
    expect(theme.name).toBe('Dark Minimal')
  })

  it('returns default theme for unknown IDs', () => {
    const theme = getTheme('nonexistent')
    expect(theme.id).toBe('default')
  })

  it('returns default theme for empty string', () => {
    const theme = getTheme('')
    expect(theme.id).toBe('default')
  })
})

describe('getCSSVariables', () => {
  it('generates all expected CSS variables', () => {
    const vars = getCSSVariables(THEMES.default)

    expect(vars['--theme-background']).toBe('#f1f5f9')
    expect(vars['--theme-surface']).toBe('#ffffff')
    expect(vars['--theme-primary']).toBe('#334155')
    expect(vars['--theme-warning']).toBe('#c2410c')
    expect(vars['--theme-text']).toBe('#0f172a')
    expect(vars['--theme-muted']).toBe('#334155')
    expect(vars['--theme-border']).toBe('#cbd5e1')
    expect(vars['--theme-danger']).toBe('#b91c1c')
    expect(vars['--theme-success']).toBe('#15803d')
    expect(vars['--theme-primary-rgb']).toBe('51 65 85')
    expect(vars['--theme-background-rgb']).toBe('241 245 249')
  })

  it('generates RGB channel variables for dark themes', () => {
    const vars = getCSSVariables(THEMES.sharpProfessionalDark)
    expect(vars['--theme-background-rgb']).toBe('15 23 42')
    expect(vars['--theme-text-rgb']).toBe('241 245 249')
  })

  it('generates radius variables', () => {
    const vars = getCSSVariables(THEMES.default)
    expect(vars['--radius-small']).toBe('2px')
    expect(vars['--radius-medium']).toBe('4px')
    expect(vars['--radius-large']).toBe('6px')
  })

  it('generates spacing variables', () => {
    const vars = getCSSVariables(THEMES.default)
    expect(vars['--spacing-tight']).toBe('0.25rem')
    expect(vars['--spacing-normal']).toBe('0.75rem')
    expect(vars['--spacing-loose']).toBe('1rem')
  })

  it('generates number style variables', () => {
    const vars = getCSSVariables(THEMES.default)
    expect(vars['--currency-color']).toBe('var(--theme-text)')
    expect(vars['--positive-color']).toBe('var(--theme-text)')
    expect(vars['--negative-color']).toBe('var(--theme-success)')
    expect(vars['--number-zero']).toBe('var(--theme-muted)')
  })

  it('includes glass effect variables when glassEffect is true', () => {
    const glassTheme = { ...THEMES.default, glassEffect: true }
    const vars = getCSSVariables(glassTheme)
    expect(vars['--glass-blur']).toBe('12px')
    expect(vars['--glass-opacity']).toBe('0.08')
  })

  it('disables glass effect variables when glassEffect is false', () => {
    const vars = getCSSVariables(THEMES.default)
    expect(vars['--glass-blur']).toBe('0px')
    expect(vars['--glass-opacity']).toBe('0')
  })

  it('works for each theme without throwing', () => {
    Object.values(THEMES).forEach((theme) => {
      expect(() => getCSSVariables(theme)).not.toThrow()
      const vars = getCSSVariables(theme)
      expect(Object.keys(vars).length).toBeGreaterThan(15)
    })
  })
})

describe('LIGHT_THEME_DEFAULTS', () => {
  it('matches the default theme', () => {
    expect(LIGHT_THEME_DEFAULTS.id).toBe('default')
    expect(LIGHT_THEME_DEFAULTS.colors.background).toBe('#f1f5f9')
  })
})

describe('DARK_THEME_DEFAULTS', () => {
  it('matches the darkMinimal theme', () => {
    expect(DARK_THEME_DEFAULTS.id).toBe('darkMinimal')
    expect(DARK_THEME_DEFAULTS.colors.background).toBe('#09090b')
  })
})
