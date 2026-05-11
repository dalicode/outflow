import { useEffect, useRef, useState } from 'react'
import type { SyncStatus } from '../../types'
import { cn } from '../../utils/cn'

interface SyncIndicatorProps {
  syncStatus: SyncStatus
  variant?: 'dot' | 'bar'
}

const COLOR_MAP: Record<SyncStatus, string> = {
  idle: 'bg-green-500',
  syncing: 'bg-amber-400',
  error: 'bg-red-500',
  offline: 'bg-gray-400',
}

const LABEL_MAP: Record<SyncStatus, string> = {
  idle: 'Connected',
  syncing: 'Syncing…',
  error: 'Sync error',
  offline: 'Offline',
}

export default function SyncIndicator({ syncStatus, variant = 'dot' }: SyncIndicatorProps) {
  const [errorVisible, setErrorVisible] = useState(true)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (syncStatus === 'error') {
      setErrorVisible(true)
      errorTimerRef.current = setTimeout(() => setErrorVisible(false), 4000)
    } else {
      setErrorVisible(true)
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current)
        errorTimerRef.current = null
      }
    }

    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [syncStatus])

  if (syncStatus === 'error' && !errorVisible) return null

  if (variant === 'bar') {
    return (
      <div
        className={cn(
          'h-0.5 w-full transition-colors duration-300',
          COLOR_MAP[syncStatus],
          syncStatus === 'syncing' && 'animate-pulse',
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'w-2 h-2 rounded-full transition-colors duration-300 shrink-0',
        COLOR_MAP[syncStatus],
        syncStatus === 'syncing' && 'animate-pulse',
      )}
      title={LABEL_MAP[syncStatus]}
    />
  )
}
