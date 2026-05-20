import { type FormEvent, useEffect, useRef, useState } from 'react'
import MoneyInput from '../../../components/inputs/MoneyInput'
import Modal from '../../../components/ui/Modal'
import ModalFooter from '../../../components/ui/ModalFooter'
import { useSettings } from '../../../context/settingsContext'
import { cn } from '../../../utils/cn'
import { resolveMoneyLocaleConfig } from '../../../utils/moneyInput'

const FREQUENCIES = ['monthly', 'biweekly', 'weekly'] as const
const MULTIPLIERS: Record<string, number> = {
  monthly: 1,
  biweekly: 2.17,
  weekly: 4.33,
}

interface IncomeModalFormProps {
  isOpen: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md'

  initialAmount?: string
  initialFrequency?: string

  onSave: (data: { income: number; frequency: string; monthlyIncome: number }) => void

  description?: string
  error?: string
}

export default function IncomeModalForm({
  isOpen,
  onClose,
  title,
  size = 'md',
  initialAmount = '',
  initialFrequency = 'monthly',
  onSave,
  description,
  error: externalError,
}: IncomeModalFormProps) {
  const { settings } = useSettings()
  const [amt, setAmt] = useState<string>(initialAmount)
  const [freq, setFreq] = useState(initialFrequency)
  const [monthlyBase, setMonthlyBase] = useState<number>(() => {
    const parsed = parseFloat(initialAmount || '0')
    const mult = MULTIPLIERS[initialFrequency] || 1
    return parsed * mult
  })
  const [error, setError] = useState('')
  const moneyConfig = resolveMoneyLocaleConfig(settings.currencySymbol)
  const wasOpenRef = useRef(isOpen)
  const isOpening = isOpen && !wasOpenRef.current
  const displayAmt = isOpening ? initialAmount : amt
  const displayFreq = isOpening ? initialFrequency : freq

  // Reset form when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      const parsed = parseFloat(initialAmount || '0')
      const mult = MULTIPLIERS[initialFrequency] || 1
      setMonthlyBase(parsed * mult)
      setAmt(initialAmount)
      setFreq(initialFrequency)
      setError('')
    }
  }, [isOpen, initialAmount, initialFrequency])

  useEffect(() => {
    wasOpenRef.current = isOpen
  }, [isOpen])

  const handleFreqChange = (newFreq: string) => {
    setFreq(newFreq)
    if (monthlyBase > 0) {
      const newAmt = monthlyBase / MULTIPLIERS[newFreq]
      setAmt(newAmt.toFixed(2))
    }
  }

  const handleAmtChange = (value: string) => {
    setAmt(value)
    const parsed = parseFloat(value || '0')
    if (!Number.isNaN(parsed)) {
      setMonthlyBase(parsed * MULTIPLIERS[freq])
    }
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const parsed = parseFloat(amt)
    if (!amt || Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a positive amount.')
      return
    }
    setError('')
    onSave({
      income: parsed,
      frequency: freq,
      monthlyIncome: parsed * MULTIPLIERS[freq],
    })
  }

  const inputCls = 'input-md'
  const displayError = externalError || error
  const focusMoneyInput = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return
    const input = event.currentTarget.querySelector('input')
    input?.focus()
    input?.select()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <ModalFooter>
          <button type="button" onClick={onClose} className="btn-cancel-sm flex-1">
            Cancel
          </button>
          <button
            type="submit"
            form="income-modal-form"
            data-testid="btn-save-income"
            className="btn-modal-primary flex-1"
          >
            Save
          </button>
        </ModalFooter>
      }
    >
      <form
        id="income-modal-form"
        onSubmit={submit}
        className="space-y-4"
        data-testid="income-form"
      >
        {description && <p className="text-xs text-theme-muted">{description}</p>}
        {displayError && <p className="text-theme-danger text-xs">{displayError}</p>}
        <div className="flex flex-col sm:flex-row gap-2">
          <div
            className={cn(
              'input-md flex items-center px-3 py-0 w-full sm:flex-1 min-w-0 focus-within:border-theme-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_15%,transparent)]',
              displayError &&
                'border-[color:color-mix(in_srgb,var(--theme-danger)_55%,var(--theme-border))] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-danger)_18%,transparent)]',
            )}
            onClick={focusMoneyInput}
          >
            <MoneyInput
              value={Number.parseFloat(displayAmt || '0')}
              onChange={(value) => handleAmtChange(value.toFixed(2))}
              currency={moneyConfig.currency}
              locale={moneyConfig.locale}
              placeholder="Amount"
              autoFocus
              variant="inline"
              className="w-full"
              inputClassName="text-sm"
            />
          </div>
          <select
            value={displayFreq}
            onChange={(e) => handleFreqChange(e.target.value)}
            className={`${inputCls} w-full sm:w-auto min-w-0`}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  )
}

export { FREQUENCIES, MULTIPLIERS }
