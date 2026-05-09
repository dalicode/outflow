import { type FormEvent, useEffect, useState } from 'react'
import MoneyInput from '../../../components/inputs/MoneyInput'
import PercentInput from '../../../components/inputs/PercentInput'
import Modal from '../../../components/ui/Modal'
import ModalFooter from '../../../components/ui/ModalFooter'
import { useSettings } from '../../../context/settingsContext'
import { cn } from '../../../utils/cn'
import { resolveMoneyLocaleConfig } from '../../../utils/moneyInput'

interface SavingsModalFormProps {
  isOpen: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md'
  initialRate?: string
  monthlyIncome?: number
  onSave: (rate: number) => void
  description?: string
  error?: string
}

export default function SavingsModalForm({
  isOpen,
  onClose,
  title,
  size = 'md',
  initialRate = '',
  monthlyIncome,
  onSave,
  description,
  error: externalError,
}: SavingsModalFormProps) {
  const { settings } = useSettings()
  const [amountDraft, setAmountDraft] = useState<string>('')
  const [percentRate, setPercentRate] = useState<number>(0) // 0–100
  const [error, setError] = useState('')
  const moneyConfig = resolveMoneyLocaleConfig(settings.currencySymbol)

  const hasIncome = (monthlyIncome ?? 0) > 0

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const rate = Number(initialRate || 0)
      setPercentRate(rate)
      setAmountDraft(hasIncome ? ((rate / 100) * (monthlyIncome ?? 0)).toFixed(2) : '')
      setError('')
    }
  }, [isOpen, initialRate, monthlyIncome, hasIncome])

  const handleAmountChange = (value: number) => {
    setAmountDraft(value.toFixed(2))
    if (hasIncome && (monthlyIncome ?? 0) > 0) {
      setPercentRate(Math.min(100, (value / (monthlyIncome ?? 1)) * 100))
    }
  }

  const handlePercentChange = (rate: number) => {
    setPercentRate(rate)
    if (hasIncome) {
      setAmountDraft(((rate / 100) * (monthlyIncome ?? 0)).toFixed(2))
    }
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (percentRate < 0 || percentRate > 100) {
      setError('Enter a value between 0 and 100.')
      return
    }
    setError('')
    onSave(percentRate)
  }

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
            form="savings-modal-form"
            data-testid="btn-save-savings"
            className="btn-modal-primary flex-1"
          >
            Save
          </button>
        </ModalFooter>
      }
    >
      <form
        id="savings-modal-form"
        onSubmit={submit}
        className="space-y-4"
        data-testid="savings-form"
      >
        {description && <p className="text-xs text-theme-muted">{description}</p>}
        {displayError && <p className="text-theme-danger text-xs">{displayError}</p>}
        <div className="flex flex-col sm:flex-row gap-2">
          {hasIncome && (
            <div
              className={cn(
                'input-md flex items-center px-3 py-0 w-full sm:flex-1 min-w-0 focus-within:border-theme-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_15%,transparent)]',
                displayError &&
                  'border-[color:color-mix(in_srgb,var(--theme-danger)_55%,var(--theme-border))] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-danger)_18%,transparent)]',
              )}
              onClick={focusMoneyInput}
            >
              <MoneyInput
                value={Number.parseFloat(amountDraft || '0')}
                onChange={handleAmountChange}
                currency={moneyConfig.currency}
                locale={moneyConfig.locale}
                placeholder="e.g. 500"
                variant="inline"
                className="w-full"
                inputClassName="text-sm"
              />
            </div>
          )}
          <PercentInput
            value={percentRate}
            onChange={handlePercentChange}
            autoFocus
            className={cn(
              'w-full sm:w-36',
              displayError &&
                'border-[color:color-mix(in_srgb,var(--theme-danger)_55%,var(--theme-border))]',
            )}
          />
        </div>
        {!hasIncome && (
          <p className="text-xs text-theme-muted">
            Set your income first to enable amount-based editing.
          </p>
        )}
      </form>
    </Modal>
  )
}
