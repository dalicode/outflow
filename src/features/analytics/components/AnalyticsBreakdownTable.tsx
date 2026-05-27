import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'

interface AnalyticsBreakdownTableProps {
  headers: Array<{ key: string; label: string }>
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export default function AnalyticsBreakdownTable({
  headers,
  children,
  className,
  bodyClassName,
}: AnalyticsBreakdownTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('analytics-breakdown-table', className)}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header.key}>{header.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className={cn('text-theme-text text-sm', bodyClassName)}>{children}</tbody>
      </table>
    </div>
  )
}
