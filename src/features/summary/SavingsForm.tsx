import { useState } from 'react'
import PrivateValue from '../../components/privacy/PrivateValue'
import { useSettings } from '../../context/settingsContext'
import SavingsModalForm from '../dashboard/components/SavingsModalForm'

interface SavingsFormProps {
  savingsRate: number | string | null | undefined
  monthlyIncome: number
  onSave: (rate: number) => void
  compact?: boolean
  mobileList?: boolean
}

export default function SavingsForm({
  savingsRate,
  monthlyIncome,
  onSave,
  compact = false,
  mobileList = false,
}: SavingsFormProps) {
  const { formatAmount } = useSettings()
  const [showModal, setShowModal] = useState(false)

  const rate = Number(savingsRate || 0)
  const amount = (rate / 100) * monthlyIncome
  const isSet = rate > 0

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        data-testid="btn-open-savings-modal"
        className={mobileList ? 'w-full text-left' : 'w-full text-left group'}
        aria-label="Edit savings goal"
      >
        <div
          className={
            mobileList
              ? 'flex items-center justify-between gap-3 py-1'
              : 'flex items-start justify-between gap-3'
          }
        >
          <div className={mobileList ? 'min-w-0 flex-1 space-y-0.5' : 'space-y-0.5'}>
            <p
              className={
                mobileList
                  ? 'text-sm font-medium text-theme-text'
                  : 'text-xs text-theme-muted uppercase tracking-wider'
              }
            >
              Auto Savings
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
                  <PrivateValue>{formatAmount(amount)}</PrivateValue>
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
                <p className="text-xs text-theme-muted tabular-nums">
                  <PrivateValue>{rate.toFixed(1)}%</PrivateValue> of income
                </p>
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

      <SavingsModalForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Edit Auto Savings"
        size="md"
        initialRate={savingsRate ? String(savingsRate) : ''}
        monthlyIncome={monthlyIncome}
        onSave={(r) => {
          onSave(r)
          setShowModal(false)
        }}
        description="Percentage of income automatically set aside. Remaining budget = income − fixed expenses − auto savings."
      />
    </>
  )
}
