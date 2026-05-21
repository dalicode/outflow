import { useEffect, useRef } from 'react'
import {
  canAnnouncePassiveResume,
  DEFAULT_PASSIVE_RESUME_COOLDOWN_MS,
  DEFAULT_PASSIVE_RESUME_THRESHOLD_MS,
  isMeaningfulHiddenDuration,
} from '../utils/visibilityResume'

interface UsePassiveResumeToastOptions {
  onPassiveResume: (hiddenDurationMs: number) => void
  enabled?: boolean
  minHiddenDurationMs?: number
  cooldownMs?: number
  now?: () => number
}

export function usePassiveResumeToast({
  onPassiveResume,
  enabled = true,
  minHiddenDurationMs = DEFAULT_PASSIVE_RESUME_THRESHOLD_MS,
  cooldownMs = DEFAULT_PASSIVE_RESUME_COOLDOWN_MS,
  now = () => Date.now(),
}: UsePassiveResumeToastOptions): void {
  const hiddenAtRef = useRef<number | null>(null)
  const lastAnnouncementAtRef = useRef<number | null>(null)

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!enabled) {
        hiddenAtRef.current = null
        return
      }

      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = now()
        return
      }

      if (document.visibilityState !== 'visible' || hiddenAtRef.current === null) {
        return
      }

      const visibleAt = now()
      const hiddenDurationMs = visibleAt - hiddenAtRef.current
      hiddenAtRef.current = null

      if (!isMeaningfulHiddenDuration(hiddenDurationMs, minHiddenDurationMs)) {
        return
      }

      if (!canAnnouncePassiveResume(visibleAt, lastAnnouncementAtRef.current, cooldownMs)) {
        return
      }

      lastAnnouncementAtRef.current = visibleAt
      onPassiveResume(hiddenDurationMs)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [cooldownMs, enabled, minHiddenDurationMs, now, onPassiveResume])
}
