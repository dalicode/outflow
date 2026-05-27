import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type InlineBannerTone = 'info' | 'success' | 'warning' | 'danger'

interface InlineBannerProps {
  tone?: InlineBannerTone
  className?: string
  contentClassName?: string
  action?: ReactNode
  children: ReactNode
}

const toneClassMap: Record<InlineBannerTone, string> = {
  info: 'border-theme-primary bg-[color:color-mix(in_srgb,var(--theme-primary)_8%,transparent)] text-theme-primary',
  success:
    'border-[color:color-mix(in_srgb,var(--theme-success)_26%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-success)_8%,transparent)] text-theme-success',
  warning:
    'border-[color:color-mix(in_srgb,var(--theme-warning)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-warning)_10%,transparent)] text-theme-warning',
  danger:
    'border-[color:color-mix(in_srgb,var(--theme-danger)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-danger)_8%,transparent)] text-theme-danger',
}

export default function InlineBanner({
  tone = 'info',
  className,
  contentClassName,
  action,
  children,
}: InlineBannerProps) {
  return (
    <div
      className={cn(
        'rounded-theme-medium border px-3 py-2 text-xs',
        action && 'flex items-center justify-between gap-3',
        toneClassMap[tone],
        className,
      )}
    >
      <div className={cn('min-w-0', contentClassName)}>{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
