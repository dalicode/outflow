import type { SyncStatus } from '../../types'
import { cn } from '../../utils/cn'

interface SyncIndicatorProps {
  syncStatus: SyncStatus
  compact?: boolean
}

const LABEL_MAP: Record<SyncStatus, string> = {
  idle: 'Cloud synced',
  syncing: 'Syncing',
  error: 'Sync error',
  offline: 'Offline',
}

const TONE_MAP: Record<SyncStatus, string> = {
  idle: 'text-theme-success',
  syncing: 'text-theme-primary',
  error: 'text-theme-danger',
  offline: 'text-theme-muted',
}

function CloudStatusIcon({
  syncStatus,
  compact,
}: {
  syncStatus: SyncStatus
  compact: boolean
}) {
  const toneClass = TONE_MAP[syncStatus]
  const cloudClass = syncStatus === 'offline' ? 'text-theme-muted opacity-70' : 'text-theme-muted'
  const spinClass = syncStatus === 'syncing' ? 'animate-spin' : ''
  const badgeSize = compact ? 'w-2.5 h-2.5' : 'w-3 h-3'

  return (
    <span className={cn('relative inline-flex items-center justify-center shrink-0', compact ? 'w-5 h-5' : 'w-6 h-6')}>
      <svg
        viewBox="0 0 24 24"
        className={cn('w-full h-full', cloudClass)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7.5 18.25h8.25a4.25 4.25 0 0 0 .64-8.45 5.5 5.5 0 0 0-10.71 1.39A3.7 3.7 0 0 0 7.5 18.25Z" />
      </svg>

      {syncStatus === 'offline' ? (
        <span
          className={cn(
            'absolute -right-0.5 -bottom-0.5 rounded-full border border-theme-border bg-theme-surface text-theme-muted',
            badgeSize,
          )}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 12 12"
            className="w-full h-full"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M2.5 9.5 9.5 2.5" />
          </svg>
        </span>
      ) : syncStatus === 'syncing' ? (
        <span
          className={cn(
            'absolute -right-0.5 -bottom-0.5 rounded-full border border-theme-border bg-theme-surface text-theme-primary',
            badgeSize,
          )}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 12 12"
            className={cn('w-full h-full', spinClass)}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9.5 4.75A3.6 3.6 0 0 0 3.1 3.9" />
            <path d="M2.6 2.3v2.1h2.1" />
            <path d="M2.5 7.25A3.6 3.6 0 0 0 8.9 8.1" />
            <path d="M9.4 9.7V7.6H7.3" />
          </svg>
        </span>
      ) : (
        <span
          className={cn(
            'absolute -right-0.5 -bottom-0.5 rounded-full border border-theme-border bg-theme-surface',
            toneClass,
            badgeSize,
          )}
          aria-hidden="true"
        >
          {syncStatus === 'idle' ? (
            <svg
              viewBox="0 0 12 12"
              className="w-full h-full"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m2.75 6.25 2.05 2.05 4.45-4.6" />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" className="w-full h-full" fill="currentColor">
              <circle cx="6" cy="6" r="4.5" />
            </svg>
          )}
        </span>
      )}
    </span>
  )
}

export default function SyncIndicator({ syncStatus, compact = false }: SyncIndicatorProps) {
  return (
    <div
      className={cn(
        'flex items-center shrink-0',
        compact ? 'justify-center' : 'w-full gap-3',
      )}
      title={LABEL_MAP[syncStatus]}
      aria-label={LABEL_MAP[syncStatus]}
    >
      <CloudStatusIcon syncStatus={syncStatus} compact={compact} />
      {!compact && (
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold leading-none text-theme-text">
            {LABEL_MAP[syncStatus]}
          </p>
          <p className="mt-1 text-[0.625rem] leading-none text-theme-muted">
            {syncStatus === 'idle'
              ? 'All devices up to date'
              : syncStatus === 'syncing'
                ? 'Checking cloud changes'
                : syncStatus === 'error'
                  ? 'Retrying shortly'
                  : 'Local changes stay on this device'}
          </p>
        </div>
      )}
    </div>
  )
}
