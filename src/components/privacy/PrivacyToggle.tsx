import { useSettings } from '../../context/settingsContext'
import { cn } from '../../utils/cn'

interface PrivacyToggleProps {
  className?: string
}

export default function PrivacyToggle({ className }: PrivacyToggleProps) {
  const { privacyModeEnabled, togglePrivacyMode } = useSettings()

  return (
    <button
      type="button"
      onClick={() => void togglePrivacyMode()}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-theme-medium transition-colors',
        privacyModeEnabled ? 'text-theme-primary' : 'text-theme-muted hover:text-theme-text',
        className,
      )}
      aria-pressed={privacyModeEnabled}
      aria-label={privacyModeEnabled ? 'Turn privacy mode off' : 'Turn privacy mode on'}
      title={privacyModeEnabled ? 'Turn privacy mode off' : 'Turn privacy mode on'}
    >
      {privacyModeEnabled ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" />
          <circle cx="10" cy="10" r="2.5" />
          <path d="M3 3l14 14" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" />
          <circle cx="10" cy="10" r="2.5" />
        </svg>
      )}
    </button>
  )
}
