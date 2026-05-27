import { useCallback } from 'react'
import { useSettings } from '../context/settingsContext'
import { triggerHaptic } from '../lib/haptics'

export function useHaptics() {
  try {
    const { settings } = useSettings()
    const enabled = settings.hapticsEnabled

    const selection = useCallback(() => triggerHaptic('selection', enabled), [enabled])
    const light = useCallback(() => triggerHaptic('light', enabled), [enabled])
    const medium = useCallback(() => triggerHaptic('medium', enabled), [enabled])
    const success = useCallback(() => triggerHaptic('success', enabled), [enabled])
    const warning = useCallback(() => triggerHaptic('warning', enabled), [enabled])
    const error = useCallback(() => triggerHaptic('error', enabled), [enabled])

    return { selection, light, medium, success, warning, error }
  } catch {
    return {
      selection: () => {},
      light: () => {},
      medium: () => {},
      success: () => {},
      warning: () => {},
      error: () => {},
    }
  }
}
