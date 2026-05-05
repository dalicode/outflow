/**
 * Haptics utility
 * ───────────────
 * Provides subtle vibration feedback via the Web Vibration API.
 * Falls back silently on unsupported platforms (iOS Safari, desktop).
 *
 * Capacitor native haptics can be added later by installing
 * @capacitor/haptics and @capacitor/core, then replacing tryNativeHaptic.
 */

export type HapticType = "selection" | "light" | "medium" | "success" | "warning" | "error";

/** Web Vibration API patterns (ms) */
const WEB_PATTERNS: Record<HapticType, number | number[]> = {
  selection: 8,
  light:     10,
  medium:    20,
  success:   [10, 30, 10],
  warning:   [20, 40, 20],
  error:     [30, 40, 30],
};

function tryWebVibration(type: HapticType): void {
  try {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    const pattern = WEB_PATTERNS[type];
    if (pattern != null) navigator.vibrate(pattern);
  } catch {
    // silently ignore — haptic failure must never break app behaviour
  }
}

/**
 * Trigger a haptic feedback event.
 * Fire-and-forget — safe to call without awaiting.
 *
 * When @capacitor/haptics is available (native app), replace this with
 * Capacitor.isNativePlatform() check + Haptics.impact/notification calls.
 */
export function triggerHaptic(type: HapticType, enabled = true): void {
  if (!enabled) return;
  tryWebVibration(type);
}
