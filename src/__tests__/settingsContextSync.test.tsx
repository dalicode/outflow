import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsProvider, useSettings } from '../context/settingsContext'
import { StorageService } from '../services/storageService'

vi.mock('../services/storageService', () => ({
  StorageService: {
    getSetting: vi.fn(),
    setSetting: vi.fn().mockResolvedValue(undefined),
    setLocalSetting: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('SettingsProvider settings-backed theme persistence', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>{children}</SettingsProvider>
  )

  beforeEach(() => {
    vi.mocked(StorageService.getSetting).mockReset()
    vi.mocked(StorageService.setSetting).mockReset()
    vi.mocked(StorageService.getSetting).mockImplementation(async (key: string, fallback?: unknown) => {
      if (key === 'uiSettings') return null
      if (key === 'localPrivacyModeEnabled') return false
      return fallback ?? null
    })
  })

  it('hydrates theme from local uiSettings', async () => {
    vi.mocked(StorageService.getSetting).mockImplementation(async (key: string, fallback?: unknown) => {
      if (key === 'uiSettings') {
        return {
          visualTheme: 'sharpProfessionalDark',
          font: 'system',
          fontSize: '1',
          currencySymbol: '$',
          decimalPlaces: '2',
          thousandSep: ',',
          dateFormat: 'MM/DD/YYYY',
          hapticsEnabled: true,
        }
      }
      if (key === 'localPrivacyModeEnabled') return false
      return fallback ?? null
    })

    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.settings.visualTheme).toBe('sharpProfessionalDark')
  })

  it('uses sharpProfessionalDark when no saved uiSettings exist', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.settings.visualTheme).toBe('sharpProfessionalDark')
  })

  it('saves theme changes into uiSettings only', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    await act(async () => {
      await result.current.save({ visualTheme: 'sharpProfessionalDark' })
    })

    expect(StorageService.setSetting).toHaveBeenCalledTimes(1)
    expect(StorageService.setSetting).toHaveBeenCalledWith(
      'uiSettings',
      expect.objectContaining({
        visualTheme: 'sharpProfessionalDark',
      }),
    )
  })
})
