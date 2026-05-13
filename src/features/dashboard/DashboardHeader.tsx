import PrivateValue from '../../components/privacy/PrivateValue'
import PrivacyToggle from '../../components/privacy/PrivacyToggle'
import { useSettings } from '../../context/settingsContext'
import type { MonthlySummary } from '../../types'
import { cn } from '../../utils/cn'

interface DashboardHeaderProps {
  financialSummary: MonthlySummary | null
  daysLeft: number
}

export default function DashboardHeader({ financialSummary, daysLeft }: DashboardHeaderProps) {
  const { formatAmount } = useSettings()
  const remaining = financialSummary?.remaining ?? 0

  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-1.5">
        <h1 className="text-2xl font-bold leading-none text-theme-text tracking-tight">
          Dashboard
        </h1>
        <PrivacyToggle className="translate-y-[2px]" />
      </div>
      <div
        className={cn(
          'flex flex-col items-end text-right pt-0.5',
          !financialSummary && 'invisible',
        )}
        aria-hidden={!financialSummary}
      >
        <span
          className={cn(
            'text-2xl font-bold tabular-nums leading-none',
            remaining >= 0 ? 'text-theme-success' : 'text-theme-danger',
          )}
        >
          <PrivateValue>{formatAmount(remaining)}</PrivateValue>
        </span>
        <span className="text-xs text-theme-muted mt-0.5">
          Remaining
          {daysLeft > 0 && ` · T - ${daysLeft}`}
        </span>
      </div>
    </div>
  )
}
