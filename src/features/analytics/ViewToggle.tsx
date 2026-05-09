interface ViewToggleProps {
  isViz: boolean
  onToggle: () => void
}

export default function ViewToggle({ isViz, onToggle }: ViewToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1 rounded-theme-small border border-theme-border px-2 py-1 text-[0.6875rem] font-medium text-theme-muted hover:text-theme-text hover:border-theme-text transition-colors"
      aria-label={isViz ? 'Switch to table view' : 'Switch to chart view'}
    >
      {isViz ? (
        <>
          <svg
            className="w-3 h-3"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="1" y="1" width="14" height="14" rx="1" />
            <line x1="1" y1="5" x2="15" y2="5" />
            <line x1="1" y1="9" x2="15" y2="9" />
            <line x1="1" y1="13" x2="15" y2="13" />
            <line x1="5" y1="1" x2="5" y2="15" />
          </svg>
          Table
        </>
      ) : (
        <>
          <svg
            className="w-3 h-3"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="1" y="6" width="3" height="9" />
            <rect x="6" y="3" width="3" height="12" />
            <rect x="11" y="1" width="3" height="14" />
          </svg>
          Chart
        </>
      )}
    </button>
  )
}
