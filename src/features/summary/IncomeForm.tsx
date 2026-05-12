import { useState } from 'react'
import { useSettings } from '../../context/settingsContext'
import IncomeModalForm from '../dashboard/components/IncomeModalForm'

const MULTIPLIERS: Record<string, number> = {
  monthly: 1,
  biweekly: 2.17,
  weekly: 4.33,
}

const FREQ_LABEL: Record<string, string> = {
  monthly: 'monthly',
  biweekly: 'bi-weekly',
  weekly: 'weekly',
}

interface IncomeFormProps {
  income: number | string | null | undefined
  frequency: string | null | undefined
  onSave: (data: { income: number; frequency: string; monthlyIncome: number }) => void
  compact?: boolean
  mobileList?: boolean
}

export default function IncomeForm({
  income,
  frequency,
  onSave,
  compact = false,
  mobileList = false,
}: IncomeFormProps) {
  const { formatAmount } = useSettings()
  const [showModal, setShowModal] = useState(false)

  const raw = parseFloat(String(income || 0))
  const freq = frequency || 'monthly'
  const monthly = raw * MULTIPLIERS[freq]
  const isSet = raw > 0

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        data-testid="btn-open-income-modal"
        className={mobileList ? 'w-full text-left' : 'w-full text-left group'}
        aria-label="Edit income"
      >
        <div
          className={
            mobileList
              ? 'flex items-center justify-between gap-3 py-1'
              : 'flex items-start justify-between gap-3'
          }
        >
          <div className={mobileList ? 'min-w-0 flex-1 space-y-0.5' : 'space-y-0.5'}>
            <p className={mobileList ? 'text-sm font-medium text-theme-text' : 'text-xs text-theme-muted uppercase tracking-wider'}>
              Income
            </p>
            {isSet ? (
              <>
                <p
                  className={
                    mobileList
                      ? 'text-sm font-semibold text-theme-text tabular-nums'
                      : compact
                      ? 'text-base font-semibold text-theme-text tabular-nums'
                      : 'text-xl font-bold text-theme-text tabular-nums'
                  }
                >
                  {formatAmount(monthly)}
                  <span
                    className={
                      mobileList
                        ? 'ml-1 text-xs font-normal text-theme-muted'
                        : compact
                        ? 'ml-1 text-xs font-normal text-theme-muted'
                        : 'ml-1 text-sm font-normal text-theme-muted'
                    }
                  >
                    /mo
                  </span>
                </p>
                {!mobileList && freq !== 'monthly' && (
                  <p className="text-xs text-theme-muted">
                    {formatAmount(raw)} {FREQ_LABEL[freq]}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-theme-muted">Not set — tap to add</p>
            )}
          </div>
          {mobileList ? (
            <span className="shrink-0 text-base text-theme-muted" aria-hidden="true">
              ›
            </span>
          ) : (
            <span
              className={
                compact
                  ? 'mt-0.5 shrink-0 text-[0.6875rem] font-medium text-theme-primary opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity'
                  : 'mt-0.5 shrink-0 text-xs font-medium text-theme-primary opacity-0 group-hover:opacity-100 transition-opacity'
              }
            >
              Edit
            </span>
          )}
        </div>
      </button>

      <IncomeModalForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Edit Income"
        size="md"
        initialAmount={income ? String(income) : ''}
        initialFrequency={freq}
        onSave={(data) => {
          onSave(data)
          setShowModal(false)
        }}
        description="Sets your monthly income. This affects budget calculations, savings targets, and remaining balance."
      />
    </>
  )
}
