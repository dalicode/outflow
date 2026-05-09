import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../utils/cn'

interface PercentInputProps {
  value: number // 0–100
  onChange: (value: number) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  disabled?: boolean
}

/**
 * Percentage input using the same integer-cents approach as SavingsModalForm.
 * Digits are entered right-to-left (like a cash register), always showing
 * two decimal places. Value is 0–100.
 *
 * Styled to match `input-theme px-3 py-2 text-sm` used throughout the modal.
 */
export default function PercentInput({
  value,
  onChange,
  placeholder = '0.00',
  className,
  autoFocus = false,
  disabled = false,
}: PercentInputProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  // Internal state: integer cents (e.g. 4234 = 42.34%)
  const [cents, setCents] = useState(() => Math.round(value * 100))

  // Sync when external value changes (e.g. quick-add pre-fills)
  useEffect(() => {
    const next = Math.round(value * 100)
    setCents((prev) => (prev === next ? prev : next))
  }, [value])

  const draft = (cents / 100).toFixed(2)

  const emit = (next: number) => {
    const clamped = Math.min(Math.max(0, next), 10000) // 0–100.00
    setCents(clamped)
    onChange(clamped / 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    const isDigit = /^[0-9]$/.test(e.key)

    if (isDigit) {
      e.preventDefault()
      const isSelected =
        e.currentTarget.selectionStart === 0 &&
        e.currentTarget.selectionEnd === e.currentTarget.value.length
      emit(isSelected ? Number(e.key) : cents * 10 + Number(e.key))
      return
    }

    if (e.key === 'Backspace') {
      e.preventDefault()
      const isSelected =
        e.currentTarget.selectionStart === 0 &&
        e.currentTarget.selectionEnd === e.currentTarget.value.length
      emit(isSelected ? 0 : Math.floor(cents / 10))
      return
    }

    if (e.key === 'Delete') {
      e.preventDefault()
      emit(0)
      return
    }

    if (
      e.key === 'Tab' ||
      e.key === 'Enter' ||
      e.key === 'Escape' ||
      e.key.startsWith('Arrow') ||
      e.metaKey ||
      e.ctrlKey
    ) {
      return
    }

    e.preventDefault()
  }

  return (
    <div
      className={cn(
        // Match ghostInputCls: input-theme px-3 py-2 text-sm
        'input-theme flex items-center gap-1 px-3 py-2 text-sm',
        // focus-within replicates the :focus ring from input-theme
        'focus-within:outline-none focus-within:border-theme-primary',
        'focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--theme-primary)_20%,transparent)]',
        disabled && 'opacity-60 cursor-not-allowed',
        className,
      )}
      // Clicking anywhere in the wrapper focuses the inner input
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="numeric"
        autoFocus={autoFocus}
        disabled={disabled}
        value={draft}
        onKeyDown={handleKeyDown}
        onChange={() => {}}
        onFocus={(e) => e.currentTarget.select()}
        placeholder={placeholder}
        className="flex-1 min-w-0 text-right font-semibold tabular-nums text-theme-text outline-none bg-transparent"
        aria-label="Savings rate percentage"
      />
      <span className="text-theme-muted shrink-0 pointer-events-none select-none">%</span>
    </div>
  )
}
