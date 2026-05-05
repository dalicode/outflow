import { useCallback } from "react";
import { useSettings } from "../context/settingsContext";
import { triggerHaptic } from "../utils/haptics";

/**
 * useHaptics — returns haptic trigger functions that respect the user's
 * hapticsEnabled setting. All functions are stable (useCallback) and
 * safe to call without awaiting.
 */
export function useHaptics() {
  let enabled = false;

  try {
    const { settings } = useSettings();
    enabled = settings.hapticsEnabled;
  } catch {
    enabled = false;
  }

  const selection = useCallback(() => triggerHaptic("selection", enabled), [enabled]);
  const light     = useCallback(() => triggerHaptic("light",     enabled), [enabled]);
  const medium    = useCallback(() => triggerHaptic("medium",    enabled), [enabled]);
  const success   = useCallback(() => triggerHaptic("success",   enabled), [enabled]);
  const warning   = useCallback(() => triggerHaptic("warning",   enabled), [enabled]);
  const error     = useCallback(() => triggerHaptic("error",     enabled), [enabled]);

  return { selection, light, medium, success, warning, error };
}
