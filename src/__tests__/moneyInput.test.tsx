import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import MoneyInput from '../components/inputs/MoneyInput'
import {
  centsToSignedDollars,
  dollarsToCents,
  formatCurrencyFromCents,
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
}: {
  allowNegative?: boolean
  showSignToggle?: boolean
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
})

describe('MoneyInput', () => {
  it('shifts digits like a payment terminal', () => {
    render(<MoneyInputHarness />)

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
    render(<MoneyInputHarness />)

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
    render(<MoneyInputHarness />)

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
    render(<MoneyInput label="Amount" value={0} onChange={() => {}} />)

    const input = screen.getByLabelText('Amount')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('inputmode', 'numeric')
  })

  it('supports toggling a negative amount when allowed', () => {
    render(<MoneyInputHarness allowNegative showSignToggle />)

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
    createTabKeyDownEvent(input, { shiftKey: true })

    expect(handleTabValue).toHaveBeenCalledWith(12.34, true)
  })
})

function createTabKeyDownEvent(
  target: HTMLElement,
  options?: { shiftKey?: boolean },
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Tab',
    shiftKey: options?.shiftKey ?? false,
  })

  target.dispatchEvent(event)
  return event
}
