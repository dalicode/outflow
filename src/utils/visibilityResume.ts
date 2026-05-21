export const DEFAULT_PASSIVE_RESUME_THRESHOLD_MS = 10 * 60 * 1000
export const DEFAULT_PASSIVE_RESUME_COOLDOWN_MS = 60 * 1000

export function isMeaningfulHiddenDuration(
  hiddenDurationMs: number,
  minHiddenDurationMs: number,
): boolean {
  return hiddenDurationMs >= minHiddenDurationMs
}

export function canAnnouncePassiveResume(
  nowMs: number,
  lastAnnouncementMs: number | null,
  cooldownMs: number,
): boolean {
  if (lastAnnouncementMs === null) return true
  return nowMs - lastAnnouncementMs >= cooldownMs
}
