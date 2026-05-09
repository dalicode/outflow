import { cn } from '../../utils/cn'

interface SingleSelectTriggerProps {
  value?: string
  placeholder: string
  isOpen: boolean
  onClick: () => void
  disabled?: boolean
  className?: string
}

export default function SingleSelectTrigger({
  value,
  placeholder,
  isOpen,
  onClick,
  disabled,
  className,
}: SingleSelectTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-3 rounded-theme-medium border border-theme-border bg-theme-surface px-3 py-2.5 text-left text-sm font-semibold transition-colors focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_15%,transparent)]',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className={cn('min-w-0 truncate', value ? 'text-theme-text' : 'text-theme-muted')}>
        {value || placeholder}
      </span>
      <svg
        className={cn(
          'h-4 w-4 shrink-0 text-theme-muted transition-transform',
          isOpen && 'rotate-180',
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
      </svg>
    </button>
  )
}
