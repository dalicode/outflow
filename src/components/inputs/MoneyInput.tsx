import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useHaptics } from '../../hooks/useHaptics'
import { cn } from '../../lib/cn'
import {
  MAX_USER_MONEY_AMOUNT,
  centsToSignedDollars,
  clampMoneyCents,
  dollarsToCents,
  formatCurrencyFromCents,
  parseDecimalMoneyInput,
  parsePastedMoneyInput,
} from '../../utils/moneyInput'

type MoneyInputSize = 'sm' | 'md' | 'lg' | 'hero'
type MoneyInputEntryMode = 'cents' | 'decimal'

interface MoneyInputProps {
  value: number | null | undefined
  onChange: (value: number) => void
  currency?: string
  locale?: string
  label?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  autoFocus?: boolean
  className?: string
  inputClassName?: string
  shellClassOverride?: string
  helperText?: string
  maxCents?: number
  maxAmount?: number
  allowNegative?: boolean
  showSignToggle?: boolean
  signTogglePosition?: 'inside' | 'outside-left'
  detachedOutsideLeftControls?: boolean
  signToggleStyle?: 'toggle' | 'dual'
  negativeLabel?: string
  positiveLabel?: string
  negativeIndicatorLabel?: string
  onSignChange?: (isNegative: boolean) => void
  size?: MoneyInputSize
  variant?: 'default' | 'inline'
  showCurrencyCode?: boolean
  onEscape?: () => void
  onBlurValue?: (value: number) => void
  onEnterValue?: (value: number, shiftKey: boolean) => void
  onTabValue?: (value: number, shiftKey: boolean) => void
  entryMode?: MoneyInputEntryMode
  inputTestId?: string
}

const SIZE_MAP: Record<MoneyInputSize, string> = {
  sm: 'min-h-10 px-3 text-base',
  md: 'min-h-11 px-4 text-lg',
  lg: 'min-h-12 px-4 text-xl',
  hero: 'min-h-14 px-4 text-2xl',
}

export default function MoneyInput({
  value,
  onChange,
  currency = 'CAD',
  locale = 'en-CA',
  label,
  placeholder = '$0.00',
  disabled = false,
  error,
  autoFocus = false,
  className,
  inputClassName,
  shellClassOverride,
  helperText,
  maxCents,
  maxAmount,
  allowNegative = false,
  showSignToggle = false,
  signTogglePosition = 'inside',
  detachedOutsideLeftControls = false,
  signToggleStyle = 'toggle',
  negativeLabel = 'Refund',
  positiveLabel = 'Expense',
  negativeIndicatorLabel,
  onSignChange,
  size = 'md',
  variant = 'default',
  showCurrencyCode = false,
  onEscape,
  onBlurValue,
  onEnterValue,
  onTabValue,
  entryMode = 'decimal',
  inputTestId,
}: MoneyInputProps) {
  const inputId = useId()
  const haptics = useHaptics()
  const [absoluteCents, setAbsoluteCents] = useState(() =>
    clampMoneyCents(dollarsToCents(value), {
      allowNegative: false,
      maxCents,
      maxAmount,
    }),
  )
  const [isNegative, setIsNegative] = useState(allowNegative && Number(value ?? 0) < 0)
  const [isEditing, setIsEditing] = useState(false)
  const [draftValue, setDraftValue] = useState('')
  const [maxExceeded, setMaxExceeded] = useState(false)
  const [shouldSelectOnFocus, setShouldSelectOnFocus] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const effectiveMaxAmount = maxAmount ?? MAX_USER_MONEY_AMOUNT
  const effectiveMaxCents = maxCents ?? dollarsToCents(effectiveMaxAmount)
  const hasError = Boolean(error || maxExceeded)
  const maxExceededMessage = `Amount cannot exceed ${effectiveMaxAmount.toLocaleString()}.`

  useEffect(() => {
    const nextCents = clampMoneyCents(dollarsToCents(value), {
      allowNegative: false,
      maxCents: effectiveMaxCents,
    })
    const nextIsNegative = allowNegative && Number(value ?? 0) < 0

    setAbsoluteCents((currentCents) => (currentCents === nextCents ? currentCents : nextCents))
    setIsNegative((current) => (current === nextIsNegative ? current : nextIsNegative))
  }, [allowNegative, effectiveMaxCents, value])

  const isNegativeMode = allowNegative && isNegative
  const editableValue = useMemo(() => {
    const signPrefix = isNegativeMode && !showSignToggle ? '-' : ''
    return `${signPrefix}${(absoluteCents / 100).toFixed(2)}`
  }, [absoluteCents, isNegativeMode, showSignToggle])

  useEffect(() => {
    if (!isEditing) {
      setDraftValue(editableValue)
    }
  }, [editableValue, isEditing])

  useLayoutEffect(() => {
    if (!shouldSelectOnFocus || entryMode !== 'decimal' || !isEditing) return

    const input = inputRef.current
    if (!input) return

    input.setSelectionRange(0, input.value.length)
    setShouldSelectOnFocus(false)
  }, [entryMode, isEditing, shouldSelectOnFocus])

  // When the sign toggle is shown, format as absolute value — the button
  // communicates the sign so we don't show it twice in the number itself.
  const formattedValue = useMemo(
    () =>
      formatCurrencyFromCents(absoluteCents, {
        locale,
        currency,
        isNegative: showSignToggle ? false : isNegativeMode,
      }),
    [absoluteCents, currency, isNegativeMode, locale, showSignToggle],
  )

  const emitValue = (nextCents: number, nextIsNegative = isNegativeMode) => {
    const safeCents = clampMoneyCents(nextCents, {
      allowNegative: false,
      maxCents: effectiveMaxCents,
    })
    const safeIsNegative = allowNegative && nextIsNegative && safeCents !== 0
    const nextValue = centsToSignedDollars(safeCents, safeIsNegative)
    setAbsoluteCents(safeCents)
    setIsNegative(safeIsNegative)
    setMaxExceeded(nextCents > safeCents)
    onChange(nextValue)
    onSignChange?.(safeIsNegative)
    return {
      cents: safeCents,
      isNegative: safeIsNegative,
      value: nextValue,
    }
  }

  const commitDecimalDraft = () => {
    const parsed = parseDecimalMoneyInput(draftValue, { allowNegative })
    const nextValue = parsed.isValid ? parsed : { cents: 0, isNegative: false }
    const nextIsNegative = showSignToggle ? isNegativeMode : nextValue.isNegative
    const committed = emitValue(nextValue.cents, nextIsNegative)
    setDraftValue(
      `${committed.isNegative && !showSignToggle ? '-' : ''}${(committed.cents / 100).toFixed(2)}`,
    )
    setMaxExceeded(false)
    return committed.value
  }

  const isFullySelected = () => {
    const input = inputRef.current
    if (!input) return false
    return input.selectionStart === 0 && input.selectionEnd === input.value.length
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (entryMode === 'decimal') {
      if (allowNegative && showSignToggle && event.key === '-') {
        event.preventDefault()
        haptics.selection()
        if (absoluteCents === 0) {
          setIsNegative(true)
        } else {
          const next = emitValue(absoluteCents, true)
          setDraftValue(`${(next.cents / 100).toFixed(2)}`)
        }
        return
      }

      if (allowNegative && showSignToggle && event.key === '+') {
        event.preventDefault()
        haptics.selection()
        if (absoluteCents === 0) {
          setIsNegative(false)
        } else {
          const next = emitValue(absoluteCents, false)
          setDraftValue(`${(next.cents / 100).toFixed(2)}`)
        }
        return
      }

      if (event.key === 'Enter') {
        const committedValue = commitDecimalDraft()
        setIsEditing(false)
        onEnterValue?.(committedValue, event.shiftKey)
        return
      }

      if (event.key === 'Escape') {
        setDraftValue(editableValue)
        setIsEditing(false)
        onEscape?.()
        return
      }

      if (event.key === 'Tab') {
        const committedValue = commitDecimalDraft()
        setIsEditing(false)
        if (onTabValue) {
          event.preventDefault()
        }
        onTabValue?.(committedValue, event.shiftKey)
        return
      }

      return
    }

    const isDigit = /^[0-9]$/.test(event.key)

    if (isDigit) {
      event.preventDefault()
      const baseCents = isFullySelected() ? 0 : absoluteCents
      const nextCents = baseCents * 10 + Number(event.key)
      emitValue(nextCents)
      return
    }

    if (event.key === 'Backspace') {
      event.preventDefault()
      if (isFullySelected()) {
        emitValue(0)
        return
      }
      const nextCents = Math.floor(absoluteCents / 10)
      emitValue(nextCents)
      return
    }

    if (event.key === 'Delete') {
      event.preventDefault()
      emitValue(0)
      return
    }

    if (allowNegative && event.key === '-') {
      event.preventDefault()
      haptics.selection()
      if (absoluteCents === 0) {
        setIsNegative(true)
      } else {
        emitValue(absoluteCents, !isNegativeMode)
      }
      return
    }

    if (allowNegative && event.key === '+') {
      event.preventDefault()
      haptics.selection()
      if (absoluteCents === 0) {
        setIsNegative(false)
      } else {
        emitValue(absoluteCents, false)
      }
      return
    }

    if (event.key === 'Enter') {
      onEnterValue?.(centsToSignedDollars(absoluteCents, isNegativeMode), event.shiftKey)
      return
    }

    if (event.key === 'Escape') {
      onEscape?.()
      return
    }

    if (event.key === 'Tab') {
      if (onTabValue) {
        event.preventDefault()
      }
      onTabValue?.(centsToSignedDollars(absoluteCents, isNegativeMode), event.shiftKey)
      return
    }

    if (
      event.key.startsWith('Arrow') ||
      event.key === 'Home' ||
      event.key === 'End' ||
      event.metaKey ||
      event.ctrlKey
    ) {
      return
    }

    event.preventDefault()
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pastedText = event.clipboardData.getData('text')
    if (entryMode === 'decimal') {
      const parsed = parseDecimalMoneyInput(pastedText, { allowNegative })
      if (!parsed.isValid) return
      const nextIsNegative = showSignToggle
        ? isNegativeMode || parsed.isNegative
        : parsed.isNegative
      setDraftValue(
        `${nextIsNegative && !showSignToggle ? '-' : ''}${(parsed.cents / 100).toFixed(2)}`,
      )
      emitValue(parsed.cents, nextIsNegative)
      return
    }

    const parsed = parsePastedMoneyInput(pastedText, { allowNegative })
    emitValue(parsed.cents, parsed.isNegative)
  }

  const toggleSign = () => {
    if (!allowNegative || disabled) return
    haptics.selection()
    if (absoluteCents === 0) {
      setIsNegative((prev) => !prev)
    } else {
      const next = emitValue(absoluteCents, !isNegativeMode)
      if (entryMode === 'decimal') {
        setDraftValue(
          `${next.isNegative && !showSignToggle ? '-' : ''}${(next.cents / 100).toFixed(2)}`,
        )
      }
    }
  }

  const setSign = (nextIsNegative: boolean) => {
    if (!allowNegative || disabled) return
    haptics.selection()
    if (absoluteCents === 0) {
      setIsNegative(nextIsNegative)
      onSignChange?.(nextIsNegative)
      return
    }
    const next = emitValue(absoluteCents, nextIsNegative)
    if (entryMode === 'decimal') {
      setDraftValue(
        `${next.isNegative && !showSignToggle ? '-' : ''}${(next.cents / 100).toFixed(2)}`,
      )
    }
  }

  const renderSignControls = () => {
    if (!allowNegative || !showSignToggle || variant !== 'default') return null

    if (signToggleStyle === 'dual') {
      return (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSign(true)}
            disabled={disabled}
            aria-label={`Switch to ${negativeLabel}`}
            aria-pressed={isNegativeMode}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-theme-medium border font-semibold text-lg leading-none',
              'transition-[transform,background-color,color,border-color,box-shadow] duration-150 motion-safe:active:scale-[0.96]',
              isNegativeMode
                ? 'border-[color:color-mix(in_srgb,var(--theme-success)_30%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-success)_10%,transparent)] text-theme-success'
                : 'border-theme-border bg-theme-background text-theme-muted hover:text-theme-text',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            -
          </button>
          <button
            type="button"
            onClick={() => setSign(false)}
            disabled={disabled}
            aria-label={`Switch to ${positiveLabel}`}
            aria-pressed={!isNegativeMode}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-theme-medium border font-semibold text-lg leading-none',
              'transition-[transform,background-color,color,border-color,box-shadow] duration-150 motion-safe:active:scale-[0.96]',
              !isNegativeMode
                ? 'border-[color:color-mix(in_srgb,var(--theme-primary)_30%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-primary)_8%,transparent)] text-theme-primary'
                : 'border-theme-border bg-theme-background text-theme-muted hover:text-theme-text',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            +
          </button>
        </div>
      )
    }

    return (
      <button
        type="button"
        onClick={toggleSign}
        disabled={disabled}
        className={cn(
          'shrink-0 flex items-center justify-center w-7 h-7 rounded-theme-medium border font-semibold text-base select-none',
          'transition-[transform,background-color,color,border-color,box-shadow] duration-150 motion-safe:active:scale-[0.96]',
          isNegativeMode
            ? 'border-[color:color-mix(in_srgb,var(--theme-success)_30%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-success)_10%,transparent)] text-theme-success'
            : 'border-theme-border bg-theme-background text-theme-muted hover:text-theme-text',
          disabled && 'cursor-not-allowed opacity-60',
        )}
        aria-label={isNegativeMode ? `Switch to ${positiveLabel}` : `Switch to ${negativeLabel}`}
      >
        {isNegativeMode ? (
          <svg viewBox="0 0 10 2" className="w-2.5 h-0.5" fill="currentColor" aria-hidden="true">
            <rect x="0" y="0" width="10" height="2" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="currentColor" aria-hidden="true">
            <rect x="0" y="4" width="10" height="2" rx="1" />
            <rect x="4" y="0" width="2" height="10" rx="1" />
          </svg>
        )}
      </button>
    )
  }

  const shellClassName =
    variant === 'inline'
      ? undefined
      : cn(
          'relative flex items-center gap-3 rounded-theme-medium border bg-theme-surface px-3 shadow-sm transition',
          SIZE_MAP[size],
          isNegativeMode
            ? 'border-[color:color-mix(in_srgb,var(--theme-success)_35%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-success)_4%,var(--theme-surface))]'
            : 'border-theme-border',
          isNegativeMode
            ? 'focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-success)_14%,transparent)]'
            : 'focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_15%,transparent)]',
          hasError &&
            'border-[color:color-mix(in_srgb,var(--theme-danger)_55%,var(--theme-border))] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-danger)_18%,transparent)]',
          disabled && 'cursor-not-allowed opacity-60',
          shellClassOverride,
        )

  const signControls = signTogglePosition === 'outside-left' ? renderSignControls() : null
  const shouldFloatOutsideLeftControls =
    signTogglePosition === 'outside-left' &&
    detachedOutsideLeftControls &&
    variant === 'default' &&
    signControls != null

  return (
    <div className={cn('block', className)}>
      {label ? (
        <label htmlFor={inputId} className="mb-1 block text-sm text-theme-muted">
          {label}
        </label>
      ) : null}

      <div
        className={cn(
          'flex items-center gap-3',
          shouldFloatOutsideLeftControls && 'relative justify-center',
        )}
      >
        {shouldFloatOutsideLeftControls ? (
          <div className="absolute left-[-2.75rem] top-1/2 -translate-y-1/2">{signControls}</div>
        ) : (
          signControls
        )}
        <div
          className={cn(
            'min-w-0 flex-1',
            signTogglePosition === 'outside-left' && 'max-w-full',
            shouldFloatOutsideLeftControls && 'w-full flex-none',
          )}
        >
          <div className={shellClassName}>
            {signTogglePosition === 'inside' ? renderSignControls() : null}

            <input
              ref={inputRef}
              id={inputId}
              type="text"
              autoFocus={autoFocus}
              disabled={disabled}
              value={
                entryMode === 'decimal' && isEditing ? draftValue : formattedValue || placeholder
              }
              onFocus={() => {
                if (entryMode !== 'decimal') return
                setDraftValue(editableValue)
                setIsEditing(true)
                setShouldSelectOnFocus(true)
              }}
              onMouseUp={(event) => {
                if (entryMode !== 'decimal' || !shouldSelectOnFocus) return

                event.preventDefault()
                event.currentTarget.setSelectionRange(0, event.currentTarget.value.length)
                setShouldSelectOnFocus(false)
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onBlur={() => {
                if (entryMode === 'decimal') {
                  const committedValue = commitDecimalDraft()
                  setIsEditing(false)
                  onBlurValue?.(committedValue)
                  return
                }
                onBlurValue?.(centsToSignedDollars(absoluteCents, isNegativeMode))
              }}
              onChange={(event) => {
                if (entryMode !== 'decimal') {
                  return
                }

                const nextDraft = event.target.value
                setDraftValue(nextDraft)

                const parsed = parseDecimalMoneyInput(nextDraft, { allowNegative })
                if (!parsed.isValid) return
                setMaxExceeded(parsed.cents > effectiveMaxCents)
                emitValue(parsed.cents, showSignToggle ? isNegativeMode : parsed.isNegative)
              }}
              className={cn(
                'w-full min-w-0 text-right font-semibold tabular-nums text-theme-text outline-none',
                'transition-[color,transform,background-color] duration-150',
                variant === 'inline'
                  ? 'input-inline w-full rounded-none border-none bg-transparent px-0 py-0 shadow-none'
                  : 'bg-transparent',
                variant === 'default' &&
                  cn(
                    size === 'sm' && 'text-xl sm:text-base',
                    size === 'md' && 'text-2xl sm:text-lg',
                    size === 'lg' && 'text-3xl sm:text-xl',
                    size === 'hero' && 'text-4xl sm:text-2xl',
                  ),
                hasError && variant === 'inline' && 'text-theme-danger',
                disabled && 'cursor-not-allowed',
                inputClassName,
              )}
              aria-invalid={hasError}
              aria-label={label ?? 'Amount'}
              inputMode={
                entryMode === 'decimal' ? 'decimal' : allowNegative ? 'decimal' : 'numeric'
              }
              data-testid={inputTestId}
            />

            {allowNegative &&
            negativeIndicatorLabel &&
            isNegativeMode &&
            variant === 'default' &&
            !showSignToggle ? (
              <span className="pointer-events-none shrink-0 rounded-full border border-[color:color-mix(in_srgb,var(--theme-danger)_24%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-danger)_8%,transparent)] px-2 py-1 text-[11px] font-medium text-theme-danger">
                {negativeIndicatorLabel}
              </span>
            ) : null}

            {showCurrencyCode && variant === 'default' ? (
              <span className="pointer-events-none shrink-0 text-[11px] font-medium text-theme-muted">
                {currency}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-1 text-xs text-theme-danger">{error}</p>
      ) : maxExceeded ? (
        <p className="mt-1 text-xs text-theme-danger">{maxExceededMessage}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-theme-muted">{helperText}</p>
      ) : null}
    </div>
  )
}
