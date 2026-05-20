import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import MoneyInput from '../components/inputs/MoneyInput'
import {
  centsToSignedDollars,
  dollarsToCents,
  formatCurrencyFromCents,
  MAX_USER_MONEY_AMOUNT,
  parseDecimalMoneyInput,
  parsePastedMoney,
  parsePastedMoneyInput,
} from '../utils/moneyInput'

// useHaptics → useSettings needs a provider; mock it out for unit tests
vi.mock('../hooks/useHaptics', () => ({
  useHaptics: () => ({
    selection: vi.fn(),
    light: vi.fn(),
    medium: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}))

function MoneyInputHarness({
  allowNegative = false,
  showSignToggle = false,
  entryMode = 'decimal',
  maxAmount,
}: {
  allowNegative?: boolean
  showSignToggle?: boolean
  entryMode?: 'cents' | 'decimal'
  maxAmount?: number
}) {
  const [value, setValue] = useState(0)

  return (
    <div>
      <MoneyInput
        label="Amount"
        value={value}
        onChange={setValue}
        allowNegative={allowNegative}
        showSignToggle={showSignToggle}
        negativeLabel="Refund"
        positiveLabel="Expense"
        negativeIndicatorLabel="Refund"
        entryMode={entryMode}
        maxAmount={maxAmount}
      />
      <output data-testid="amount-value">{value.toFixed(2)}</output>
    </div>
  )
}

describe('moneyInput helpers', () => {
  it('converts dollars to cents safely', () => {
    expect(dollarsToCents(12.34)).toBe(1234)
    expect(dollarsToCents('12.34')).toBe(1234)
    expect(dollarsToCents(undefined)).toBe(0)
  })

  it('parses pasted values as cents or dollars based on format', () => {
    expect(parsePastedMoney('12345')).toBe(12345)
    expect(parsePastedMoney('$123.45')).toBe(12345)
    expect(parsePastedMoney('1,234.56')).toBe(123456)
    expect(parsePastedMoney('12')).toBe(12)
  })

  it('parses pasted negative values with sign metadata', () => {
    expect(parsePastedMoneyInput('-123.45', { allowNegative: true })).toEqual({
      cents: 12345,
      isNegative: true,
    })
    expect(parsePastedMoneyInput('(123.45)', { allowNegative: true })).toEqual({
      cents: 12345,
      isNegative: true,
    })
    expect(centsToSignedDollars(12345, true)).toBe(-123.45)
    expect(centsToSignedDollars(0, true)).toBe(0)
  })

  it('parses direct decimal editing values as dollars', () => {
    expect(parseDecimalMoneyInput('1234', { allowNegative: true })).toEqual({
      cents: 123400,
      isNegative: false,
      isValid: true,
    })
    expect(parseDecimalMoneyInput('$1,234.56', { allowNegative: true })).toEqual({
      cents: 123456,
      isNegative: false,
      isValid: true,
    })
    expect(parseDecimalMoneyInput('(12.34)', { allowNegative: true })).toEqual({
      cents: 1234,
      isNegative: true,
      isValid: true,
    })
  })
})

describe('MoneyInput', () => {
  it('shifts digits like a payment terminal', () => {
    render(<MoneyInputHarness entryMode="cents" />)

    const input = screen.getByLabelText('Amount')
    const output = screen.getByTestId('amount-value')

    expect(input).toHaveValue(formatCurrencyFromCents(0))

    fireEvent.keyDown(input, { key: '1' })
    expect(input).toHaveValue(formatCurrencyFromCents(1))
    expect(output).toHaveTextContent('0.01')

    fireEvent.keyDown(input, { key: '0' })
    expect(input).toHaveValue(formatCurrencyFromCents(10))
    expect(output).toHaveTextContent('0.10')

    fireEvent.keyDown(input, { key: '0' })
    expect(input).toHaveValue(formatCurrencyFromCents(100))
    expect(output).toHaveTextContent('1.00')

    fireEvent.keyDown(input, { key: '5' })
    expect(input).toHaveValue(formatCurrencyFromCents(1005))
    expect(output).toHaveTextContent('10.05')

    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(input).toHaveValue(formatCurrencyFromCents(100))
    expect(output).toHaveTextContent('1.00')
  })

  it('clears on delete and ctrl-a backspace', () => {
    render(<MoneyInputHarness entryMode="cents" />)

    const input = screen.getByLabelText('Amount') as HTMLInputElement
    const output = screen.getByTestId('amount-value')

    fireEvent.keyDown(input, { key: '9' })
    fireEvent.keyDown(input, { key: '9' })
    fireEvent.keyDown(input, { key: '9' })
    expect(output).toHaveTextContent('9.99')

    fireEvent.keyDown(input, { key: 'Delete' })
    expect(output).toHaveTextContent('0.00')

    fireEvent.keyDown(input, { key: '1' })
    fireEvent.keyDown(input, { key: '2' })
    fireEvent.focus(input)
    input.setSelectionRange(0, input.value.length)
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(output).toHaveTextContent('0.00')
  })

  it('parses pasted values and emits dollars', () => {
    render(<MoneyInputHarness entryMode="cents" />)

    const input = screen.getByLabelText('Amount')
    const output = screen.getByTestId('amount-value')

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => '12345',
      },
    })
    expect(input).toHaveValue(formatCurrencyFromCents(12345))
    expect(output).toHaveTextContent('123.45')

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => '$1,234.56',
      },
    })
    expect(input).toHaveValue(formatCurrencyFromCents(123456))
    expect(output).toHaveTextContent('1234.56')
  })

  it('uses a text input with numeric keyboard hints', () => {
    render(<MoneyInput label="Amount" value={0} onChange={() => {}} entryMode="cents" />)

    const input = screen.getByLabelText('Amount')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('inputmode', 'numeric')
  })

  it('supports toggling a negative amount when allowed', () => {
    render(<MoneyInputHarness allowNegative showSignToggle entryMode="cents" />)

    const input = screen.getByRole('textbox', { name: 'Amount' })
    const output = screen.getByTestId('amount-value')

    fireEvent.keyDown(input, { key: '1' })
    fireEvent.keyDown(input, { key: '2' })
    expect(output).toHaveTextContent('0.12')
    expect(input).toHaveValue(formatCurrencyFromCents(12))

    // Press - to switch to negative mode
    fireEvent.keyDown(input, { key: '-' })
    expect(output).toHaveTextContent('-0.12')
    // With showSignToggle, the input shows absolute value (no minus sign)
    expect(input).toHaveValue(formatCurrencyFromCents(12))
    // Toggle button switches to "Switch to Expense" aria-label
    expect(screen.getByRole('button', { name: 'Switch to Expense' })).toBeInTheDocument()
    // Only the toggle button communicates sign — no duplicate indicator pill
    expect(screen.queryAllByText('Refund')).toHaveLength(0)

    // Press + to switch back to positive
    fireEvent.keyDown(input, { key: '+' })
    expect(output).toHaveTextContent('0.12')
    expect(input).toHaveValue(formatCurrencyFromCents(12))

    // Click toggle to go negative again
    const toggle = screen.getByRole('button', { name: 'Switch to Refund' })
    fireEvent.click(toggle)
    expect(output).toHaveTextContent('-0.12')

    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(output).toHaveTextContent('-0.01')

    fireEvent.keyDown(input, { key: 'Delete' })
    expect(output).toHaveTextContent('0.00')
  })

  it('prevents native tab navigation when a custom tab handler is provided', () => {
    const handleTabValue = vi.fn()

    render(
      <MoneyInput label="Amount" value={12.34} onChange={() => {}} onTabValue={handleTabValue} />,
    )

    const input = screen.getByLabelText('Amount')
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })

    expect(handleTabValue).toHaveBeenCalledWith(12.34, true)
  })

  it('supports direct decimal editing with caret-friendly text entry', () => {
    render(<MoneyInputHarness entryMode="decimal" />)

    const input = screen.getByLabelText('Amount') as HTMLInputElement
    const output = screen.getByTestId('amount-value')

    expect(input).toHaveValue(formatCurrencyFromCents(0))

    fireEvent.focus(input)
    expect(input).toHaveValue('0.00')
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)

    fireEvent.change(input, { target: { value: '12.34' } })
    expect(input).toHaveValue('12.34')
    expect(output).toHaveTextContent('12.34')

    fireEvent.blur(input)
    expect(input).toHaveValue(formatCurrencyFromCents(1234))
    expect(output).toHaveTextContent('12.34')
  })

  it('commits pasted decimal values as dollars in decimal mode', () => {
    render(<MoneyInputHarness allowNegative showSignToggle entryMode="decimal" />)

    const input = screen.getByLabelText('Amount')
    const output = screen.getByTestId('amount-value')

    fireEvent.focus(input)
    fireEvent.paste(input, {
      clipboardData: {
        getData: () => '$1,234.56',
      },
    })

    expect(input).toHaveValue('1234.56')
    expect(output).toHaveTextContent('1234.56')

    fireEvent.keyDown(input, { key: '-' })
    expect(output).toHaveTextContent('-1234.56')
  })

  it('replaces the highlighted decimal value when typing after focus', () => {
    render(<MoneyInput label="Amount" value={45.67} onChange={() => {}} entryMode="decimal" />)

    const input = screen.getByLabelText('Amount') as HTMLInputElement

    expect(input).toHaveValue(formatCurrencyFromCents(4567))

    fireEvent.focus(input)
    expect(input).toHaveValue('45.67')
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)

    fireEvent.change(input, { target: { value: '9' } })
    expect(input).toHaveValue('9')
  })

  it('clamps decimal entry to the configured max amount', () => {
    render(<MoneyInputHarness entryMode="decimal" maxAmount={MAX_USER_MONEY_AMOUNT} />)

    const input = screen.getByLabelText('Amount')
    const output = screen.getByTestId('amount-value')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '100001' } })
    fireEvent.blur(input)

    expect(output).toHaveTextContent('100000.00')
    expect(input).toHaveValue(formatCurrencyFromCents(10000000))
  })

  it('clamps cents entry mode to the configured max amount', () => {
    render(<MoneyInputHarness entryMode="cents" maxAmount={MAX_USER_MONEY_AMOUNT} />)

    const input = screen.getByLabelText('Amount')
    const output = screen.getByTestId('amount-value')

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => '100000000',
      },
    })

    expect(output).toHaveTextContent('100000.00')
    expect(input).toHaveValue(formatCurrencyFromCents(10000000))
  })

  it('clamps negative values by absolute max amount', () => {
    render(
      <MoneyInputHarness
        allowNegative
        showSignToggle
        entryMode="decimal"
        maxAmount={MAX_USER_MONEY_AMOUNT}
      />,
    )

    const input = screen.getByLabelText('Amount')
    const output = screen.getByTestId('amount-value')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '100001' } })
    fireEvent.keyDown(input, { key: '-' })
    fireEvent.blur(input)

    expect(output).toHaveTextContent('-100000.00')
    expect(input).toHaveValue(formatCurrencyFromCents(10000000))
  })

  it('clamps pasted values above max in decimal mode', () => {
    render(<MoneyInputHarness entryMode="decimal" maxAmount={MAX_USER_MONEY_AMOUNT} />)

    const input = screen.getByLabelText('Amount')
    const output = screen.getByTestId('amount-value')

    fireEvent.focus(input)
    fireEvent.paste(input, {
      clipboardData: {
        getData: () => '$100,001.00',
      },
    })
    fireEvent.blur(input)

    expect(output).toHaveTextContent('100000.00')
    expect(input).toHaveValue(formatCurrencyFromCents(10000000))
  })

  it('shows max error while editing above cap, then normalizes on enter', () => {
    render(<MoneyInputHarness entryMode="decimal" maxAmount={MAX_USER_MONEY_AMOUNT} />)

    const input = screen.getByLabelText('Amount')
    const output = screen.getByTestId('amount-value')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '100001' } })
    expect(screen.getByText('Amount cannot exceed 100,000.')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.queryByText('Amount cannot exceed 100,000.')).not.toBeInTheDocument()
    expect(output).toHaveTextContent('100000.00')
    expect(input).toHaveValue(formatCurrencyFromCents(10000000))
  })

  it('normalizes capped value on tab commit', () => {
    render(<MoneyInputHarness entryMode="decimal" maxAmount={MAX_USER_MONEY_AMOUNT} />)

    const input = screen.getByLabelText('Amount')
    const output = screen.getByTestId('amount-value')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '100001' } })
    fireEvent.keyDown(input, { key: 'Tab' })

    expect(output).toHaveTextContent('100000.00')
    expect(input).toHaveValue(formatCurrencyFromCents(10000000))
  })
})
