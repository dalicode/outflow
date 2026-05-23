interface ChartCardProps {
  title: string
  headerAction?: React.ReactNode
  children: React.ReactNode
}

export default function ChartCard({ title, headerAction, children }: ChartCardProps) {
  return (
    <div className="rounded-theme-large border border-theme-border bg-theme-surface p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-theme-text">{title}</h3>
        {headerAction}
      </div>
      {children}
    </div>
  )
}
