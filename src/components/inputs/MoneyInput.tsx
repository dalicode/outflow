import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn";
import {
  clampMoneyCents,
  centsToSignedDollars,
  dollarsToCents,
  formatCurrencyFromCents,
  parsePastedMoneyInput,
} from "../../utils/moneyInput";

type MoneyInputSize = "sm" | "md" | "lg" | "hero";

interface MoneyInputProps {
  value: number | null | undefined;
  onChange: (value: number) => void;
  currency?: string;
  locale?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
  helperText?: string;
  maxCents?: number;
  maxAmount?: number;
  allowNegative?: boolean;
  showSignToggle?: boolean;
  negativeLabel?: string;
  positiveLabel?: string;
  negativeIndicatorLabel?: string;
  onSignChange?: (isNegative: boolean) => void;
  size?: MoneyInputSize;
  variant?: "default" | "inline";
  showCurrencyCode?: boolean;
  onEscape?: () => void;
  onBlurValue?: (value: number) => void;
  onEnterValue?: (value: number) => void;
  onTabValue?: (value: number, shiftKey: boolean) => void;
}

const SIZE_MAP: Record<MoneyInputSize, string> = {
  sm: "min-h-10 px-3 text-base",
  md: "min-h-11 px-4 text-lg",
  lg: "min-h-12 px-4 text-xl",
  hero: "min-h-14 px-4 text-2xl",
};

export default function MoneyInput({
  value,
  onChange,
  currency = "CAD",
  locale = "en-CA",
  label,
  placeholder = "$0.00",
  disabled = false,
  error,
  autoFocus = false,
  className,
  inputClassName,
  helperText,
  maxCents,
  maxAmount,
  allowNegative = false,
  showSignToggle = false,
  negativeLabel = "Refund",
  positiveLabel = "Expense",
  negativeIndicatorLabel,
  onSignChange,
  size = "md",
  variant = "default",
  showCurrencyCode = false,
  onEscape,
  onBlurValue,
  onEnterValue,
  onTabValue,
}: MoneyInputProps) {
  const inputId = useId();
  const [absoluteCents, setAbsoluteCents] = useState(() =>
    clampMoneyCents(dollarsToCents(value), {
      allowNegative: false,
      maxCents,
      maxAmount,
    }),
  );
  const [isNegative, setIsNegative] = useState(
    allowNegative && Number(value ?? 0) < 0,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const nextCents = clampMoneyCents(dollarsToCents(value), {
      allowNegative: false,
      maxCents,
      maxAmount,
    });
    const nextIsNegative = allowNegative && Number(value ?? 0) < 0;

    setAbsoluteCents((currentCents) =>
      currentCents === nextCents ? currentCents : nextCents,
    );
    setIsNegative((current) =>
      current === nextIsNegative ? current : nextIsNegative,
    );
  }, [allowNegative, maxAmount, maxCents, value]);

  const isNegativeMode = allowNegative && isNegative;

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
  );

  const emitValue = (nextCents: number, nextIsNegative = isNegativeMode) => {
    const safeCents = clampMoneyCents(nextCents, {
      allowNegative: false,
      maxCents,
      maxAmount,
    });
    const safeIsNegative = allowNegative && nextIsNegative && safeCents !== 0;
    setAbsoluteCents(safeCents);
    setIsNegative(safeIsNegative);
    onChange(centsToSignedDollars(safeCents, safeIsNegative));
    onSignChange?.(safeIsNegative);
    return safeCents;
  };

  const isFullySelected = () => {
    const input = inputRef.current;
    if (!input) return false;
    return (
      input.selectionStart === 0 && input.selectionEnd === input.value.length
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    const isDigit = /^[0-9]$/.test(event.key);

    if (isDigit) {
      event.preventDefault();
      const baseCents = isFullySelected() ? 0 : absoluteCents;
      const nextCents = baseCents * 10 + Number(event.key);
      emitValue(nextCents);
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      if (isFullySelected()) {
        emitValue(0);
        return;
      }
      const nextCents = Math.floor(absoluteCents / 10);
      emitValue(nextCents);
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      emitValue(0);
      return;
    }

    if (allowNegative && event.key === "-") {
      event.preventDefault();
      if (absoluteCents === 0) {
        // No value yet — just flip the mode visually without emitting
        setIsNegative(true);
      } else {
        emitValue(absoluteCents, !isNegativeMode);
      }
      return;
    }

    if (allowNegative && event.key === "+") {
      event.preventDefault();
      if (absoluteCents === 0) {
        setIsNegative(false);
      } else {
        emitValue(absoluteCents, false);
      }
      return;
    }

    if (event.key === "Enter") {
      onEnterValue?.(centsToSignedDollars(absoluteCents, isNegativeMode));
      return;
    }

    if (event.key === "Escape") {
      onEscape?.();
      return;
    }

    if (event.key === "Tab") {
      onTabValue?.(
        centsToSignedDollars(absoluteCents, isNegativeMode),
        event.shiftKey,
      );
      return;
    }

    if (
      event.key.startsWith("Arrow") ||
      event.key === "Home" ||
      event.key === "End" ||
      event.metaKey ||
      event.ctrlKey
    ) {
      return;
    }

    event.preventDefault();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData("text");
    const parsed = parsePastedMoneyInput(pastedText, { allowNegative });
    emitValue(parsed.cents, parsed.isNegative);
  };

  const toggleSign = () => {
    if (!allowNegative || disabled) return;
    if (absoluteCents === 0) {
      setIsNegative((prev) => !prev);
    } else {
      emitValue(absoluteCents, !isNegativeMode);
    }
  };

  const shellClassName =
    variant === "inline"
      ? undefined
      : cn(
          "relative flex items-center gap-3 rounded-theme-large border bg-theme-surface px-3 shadow-sm transition",
          SIZE_MAP[size],
          isNegativeMode
            ? "border-[color:color-mix(in_srgb,var(--theme-success)_35%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-success)_4%,var(--theme-surface))]"
            : "border-theme-border",
          isNegativeMode
            ? "focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-success)_14%,transparent)]"
            : "focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_15%,transparent)]",
          error &&
            "border-[color:color-mix(in_srgb,var(--theme-danger)_55%,var(--theme-border))] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-danger)_18%,transparent)]",
          disabled && "cursor-not-allowed opacity-60",
        );

  return (
    <div className={cn("block", className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1 block text-sm text-theme-muted"
        >
          {label}
        </label>
      ) : null}

      <div className={shellClassName}>
        {allowNegative && showSignToggle && variant === "default" ? (
          <button
            type="button"
            onClick={toggleSign}
            disabled={disabled}
            className={cn(
              "shrink-0 flex items-center justify-center w-7 h-7 rounded-theme-medium border font-semibold text-base transition-colors select-none",
              isNegativeMode
                ? "border-[color:color-mix(in_srgb,var(--theme-success)_30%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-success)_10%,transparent)] text-theme-success"
                : "border-theme-border bg-theme-background text-theme-muted hover:text-theme-text",
              disabled && "cursor-not-allowed opacity-60",
            )}
            aria-label={
              isNegativeMode
                ? `Switch to ${positiveLabel}`
                : `Switch to ${negativeLabel}`
            }
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
        ) : null}

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode={allowNegative ? "decimal" : "numeric"}
          autoFocus={autoFocus}
          disabled={disabled}
          value={formattedValue || placeholder}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={(event) => {
            event.currentTarget.select();
          }}
          onBlur={() => {
            onBlurValue?.(centsToSignedDollars(absoluteCents, isNegativeMode));
          }}
          onChange={() => {
            // Controlled via keyboard and paste handlers.
          }}
          className={cn(
            "w-full min-w-0 text-right font-semibold tabular-nums text-theme-text outline-none transition",
            variant === "inline"
              ? "input-inline w-full rounded-none border-none bg-transparent px-0 py-0 shadow-none"
              : "bg-transparent",
            variant === "default" &&
              cn(
                size === "sm" && "text-base",
                size === "md" && "text-lg",
                size === "lg" && "text-xl",
                size === "hero" && "text-2xl",
              ),
            error && variant === "inline" && "text-theme-danger",
            disabled && "cursor-not-allowed",
            inputClassName,
          )}
          aria-invalid={Boolean(error)}
          aria-label={label ?? "Amount"}
        />

        {allowNegative &&
        negativeIndicatorLabel &&
        isNegativeMode &&
        variant === "default" &&
        !showSignToggle ? (
          <span className="pointer-events-none shrink-0 rounded-full border border-[color:color-mix(in_srgb,var(--theme-danger)_24%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-danger)_8%,transparent)] px-2 py-1 text-[11px] font-medium text-theme-danger">
            {negativeIndicatorLabel}
          </span>
        ) : null}

        {showCurrencyCode && variant === "default" ? (
          <span className="pointer-events-none shrink-0 text-[11px] font-medium text-theme-muted">
            {currency}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-1 text-xs text-theme-danger">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-theme-muted">{helperText}</p>
      ) : null}
    </div>
  );
}
