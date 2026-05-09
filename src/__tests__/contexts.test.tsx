import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../context/authContext'
import { SettingsProvider, useSettings } from '../context/settingsContext'

// Mock StorageService
vi.mock('../services/storageService', () => ({
  StorageService: {
    getSetting: vi.fn().mockResolvedValue(null),
    setSetting: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock supabase
vi.mock('../services/supabase', () => ({
  supabase: null,
}))

// Mock syncService
vi.mock('../services/syncService', () => ({
  syncThemeToProfile: vi.fn().mockResolvedValue(undefined),
  fetchThemeFromProfile: vi.fn().mockResolvedValue(null),
}))

describe('useSettings', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>{children}</SettingsProvider>
  )

  it('provides default settings', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.settings.visualTheme).toBe('default')
    expect(result.current.settings.font).toBe('system')
    expect(result.current.settings.currencySymbol).toBe('$')
    expect(result.current.settings.decimalPlaces).toBe('2')
  })

  it('provides currency formatter', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.currency(1234.56)).toBe('$1,234.56')
    expect(result.current.currency(-100)).toBe('-$100.00')
    expect(result.current.currency(null)).toBe('—')
  })

  it('provides formatDate', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.formatDate('2024-01-15')).toBe('01/15/2024')
  })

  it('provides formatMonth', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.formatMonth(1)).toBe('January')
    expect(result.current.formatMonth(12)).toBe('December')
  })

  it('provides formatShortMonth', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.formatShortMonth(1)).toBe('Jan')
    expect(result.current.formatShortMonth(12)).toBe('Dec')
  })

  it('provides available themes', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(Object.keys(result.current.availableThemes).length).toBeGreaterThan(0)
    expect(result.current.availableThemes.default).toBeDefined()
  })

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useSettings())).toThrow(
      'useSettings must be used within SettingsProvider',
    )
  })
})

describe('useAuth', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

  it('provides auth context with default values', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.user).toBeNull()
    // loading is false because supabase is mocked as null
    expect(result.current.loading).toBe(false)
    expect(result.current.syncStatus).toBe('idle')
    expect(typeof result.current.triggerSync).toBe('function')
    expect(typeof result.current.signOut).toBe('function')
  })

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider')
  })
})
