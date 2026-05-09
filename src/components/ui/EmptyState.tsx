interface EmptyStateProps {
  message: string
  padding?: 'py-6' | 'py-8'
  size?: 'xs' | 'sm'
  chartHeight?: boolean
}

export default function EmptyState({
  message,
  padding = 'py-8',
  size = 'sm',
  chartHeight = false,
}: EmptyStateProps) {
  if (chartHeight) {
    return (
      <div className="h-[200px] md:h-[260px] flex items-center justify-center">
        <span className="text-xs text-theme-muted">{message}</span>
      </div>
    )
  }
  return <p className={`text-${size} text-theme-muted text-center ${padding}`}>{message}</p>
}
