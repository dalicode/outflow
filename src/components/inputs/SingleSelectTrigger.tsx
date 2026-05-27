import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

interface SingleSelectTriggerProps {
  value?: string
  placeholder: string
  isOpen: boolean
  onClick: () => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
  size?: 'md' | 'sm'
}

const SingleSelectTrigger = forwardRef<HTMLButtonElement, SingleSelectTriggerProps>(
  function SingleSelectTrigger(
    {
      value,
      placeholder,
      isOpen,
      onClick,
      disabled,
      className,
      ariaLabel,
      size = 'md',
    }: SingleSelectTriggerProps,
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          'flex w-full items-center justify-between rounded-theme-medium border border-theme-border bg-theme-surface text-left font-semibold transition-colors focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_15%,transparent)]',
          size === 'sm' ? 'min-h-6 px-2 text-xs' : 'min-h-11 gap-3 px-3 py-2.5 text-sm',
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
            size === 'sm' && 'h-3.5 w-3.5',
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
  },
)

export default SingleSelectTrigger
