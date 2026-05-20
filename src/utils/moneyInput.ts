export interface MoneyLocaleConfig {
  currency: string
  locale: string
}

export const MAX_USER_MONEY_AMOUNT = 100000

const SYMBOL_TO_MONEY_CONFIG: Record<string, MoneyLocaleConfig> = {
  $: { currency: 'CAD', locale: 'en-CA' },
  '€': { currency: 'EUR', locale: 'en-IE' },
  '£': { currency: 'GBP', locale: 'en-GB' },
  '¥': { currency: 'JPY', locale: 'ja-JP' },
  '₹': { currency: 'INR', locale: 'en-IN' },
}

export function resolveMoneyLocaleConfig(currencySymbol?: string): MoneyLocaleConfig {
  if (!currencySymbol) {
    return { currency: 'CAD', locale: 'en-CA' }
  }
  return (
    SYMBOL_TO_MONEY_CONFIG[currencySymbol] ?? {
      currency: 'CAD',
      locale: 'en-CA',
    }
  )
}

export function dollarsToCents(value: number | string | null | undefined): number {
  if (value == null || value === '') return 0
  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return 0
  return Math.round(Math.abs(numericValue) * 100)
}

export function centsToDollars(cents: number): number {
  return cents / 100
}

export function centsToSignedDollars(cents: number, isNegative: boolean): number {
  if (cents === 0) return 0
  const dollars = cents / 100
  return isNegative ? -dollars : dollars
}

export function clampMoneyCents(
  cents: number,
  options?: {
    allowNegative?: boolean
    maxCents?: number
    maxAmount?: number
  },
): number {
  const maxCents =
    options?.maxCents ??
    (options?.maxAmount != null ? dollarsToCents(options.maxAmount) : undefined)

  let next = Math.round(cents)
  if (!options?.allowNegative) {
    next = Math.max(0, next)
  }
  if (maxCents != null) {
    next = Math.min(next, maxCents)
  }
  return next
}

export function formatCurrencyFromCents(
  cents: number,
  localeOrOptions:
    | string
    | {
        locale?: string
        currency?: string
        isNegative?: boolean
      } = 'en-CA',
  currency = 'CAD',
): string {
  const options =
    typeof localeOrOptions === 'string'
      ? { locale: localeOrOptions, currency, isNegative: false }
      : {
          locale: localeOrOptions.locale ?? 'en-CA',
          currency: localeOrOptions.currency ?? 'CAD',
          isNegative: localeOrOptions.isNegative ?? false,
        }

  return new Intl.NumberFormat(options.locale, {
    style: 'currency',
    currency: options.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(options.isNegative && cents !== 0 ? -(Math.abs(cents) / 100) : cents / 100)
}

export function parsePastedMoney(text: string, options?: { allowNegative?: boolean }): number {
  return parsePastedMoneyInput(text, options).cents
}

export function parsePastedMoneyInput(
  text: string,
  options?: { allowNegative?: boolean },
): { cents: number; isNegative: boolean } {
  const trimmedText = text.trim()

  if (!trimmedText) return { cents: 0, isNegative: false }

  const isNegativePaste =
    options?.allowNegative === true && (/^-/.test(trimmedText) || /^\(.*\)$/.test(trimmedText))

  const hasDecimal = /[.,]\d{1,2}\)?$/.test(trimmedText)

  if (hasDecimal) {
    const normalized = trimmedText.replace(/[()]/g, '').replace(/[^0-9.,-]/g, '')
    const lastSeparatorIndex = Math.max(normalized.lastIndexOf('.'), normalized.lastIndexOf(','))

    const integerPart = normalized.slice(0, lastSeparatorIndex).replace(/[.,]/g, '')
    const decimalPart = normalized.slice(lastSeparatorIndex + 1).replace(/[^\d]/g, '')
    const parsedDollars = Number.parseFloat(`${integerPart || '0'}.${decimalPart}`)

    if (Number.isNaN(parsedDollars)) {
      return { cents: 0, isNegative: false }
    }

    return {
      cents: Math.round(Math.abs(parsedDollars) * 100),
      isNegative: isNegativePaste,
    }
  }

  const digitsOnly = trimmedText.replace(/\D/g, '')

  if (!digitsOnly) return { cents: 0, isNegative: false }

  return {
    cents: Number.parseInt(digitsOnly, 10),
    isNegative: isNegativePaste,
  }
}

export function parseDecimalMoneyInput(
  text: string,
  options?: { allowNegative?: boolean },
): { cents: number; isNegative: boolean; isValid: boolean } {
  const trimmedText = text.trim()

  if (!trimmedText) {
    return { cents: 0, isNegative: false, isValid: true }
  }

  const isNegative =
    options?.allowNegative === true && (/^-/.test(trimmedText) || /^\(.*\)$/.test(trimmedText))

  const normalized = trimmedText.replace(/[()]/g, '').replace(/[^0-9.,-]/g, '')

  if (!/\d/.test(normalized)) {
    return { cents: 0, isNegative: false, isValid: false }
  }

  const lastSeparatorIndex = Math.max(normalized.lastIndexOf('.'), normalized.lastIndexOf(','))

  let parsedDollars = 0
  if (lastSeparatorIndex === -1) {
    const digitsOnly = normalized.replace(/\D/g, '')
    parsedDollars = Number.parseFloat(digitsOnly)
  } else {
    const integerPart = normalized.slice(0, lastSeparatorIndex).replace(/[^\d]/g, '')
    const decimalPart = normalized.slice(lastSeparatorIndex + 1).replace(/[^\d]/g, '')

    if (decimalPart.length > 2) {
      const digitsOnly = normalized.replace(/\D/g, '')
      parsedDollars = Number.parseFloat(digitsOnly)
    } else {
      parsedDollars = Number.parseFloat(`${integerPart || '0'}.${decimalPart || '0'}`)
    }
  }

  if (Number.isNaN(parsedDollars)) {
    return { cents: 0, isNegative: false, isValid: false }
  }

  return {
    cents: Math.round(Math.abs(parsedDollars) * 100),
    isNegative,
    isValid: true,
  }
}
