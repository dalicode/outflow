import { useEffect, useRef, useState } from 'react'
import { cn } from '../../../utils/cn'

interface MobileSelectionBannerProps {
  count: number
  onEdit: () => void
  onCopy: () => void
  onDelete: () => void
  onSelectAll: () => void
  onDeselectAll: () => void
  extraMenuActions?: Array<{
    label: string
    onClick: () => void
    danger?: boolean
  }>
}

export default function MobileSelectionBanner({
  count,
  onEdit,
  onCopy,
  onDelete,
  onSelectAll,
  onDeselectAll,
  extraMenuActions = [],
}: MobileSelectionBannerProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <div className="mobile-banner" data-testid="selection-banner">
      <span className="text-sm font-semibold text-theme-text">{count} selected</span>

      <div className="flex items-center gap-3">
        <button
          onClick={onEdit}
          data-testid="btn-edit-selection"
          className={cn(
            'text-sm font-medium px-3 py-1.5 rounded-theme-medium transition-colors',
            'text-theme-primary hover:bg-theme-primary-subtle',
          )}
        >
          Edit
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            data-testid="btn-selection-menu"
            className="p-2 rounded-theme-medium hover:bg-theme-background transition-colors"
            aria-label="More options"
          >
            <svg className="w-5 h-5 text-theme-text" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="6" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="18" r="2" />
            </svg>
          </button>

          {menuOpen && (
            <div
              className="context-menu"
              style={{
                position: 'absolute',
                right: 0,
                bottom: 'calc(100% + 8px)',
              }}
            >
              {extraMenuActions.map((action) => (
                <button
                  key={action.label}
                  className={cn(
                    'context-menu-item w-full text-left',
                    action.danger && 'context-menu-item-danger',
                  )}
                  onClick={() => {
                    action.onClick()
                    setMenuOpen(false)
                  }}
                >
                  {action.label}
                </button>
              ))}
              <button
                className="context-menu-item w-full text-left"
                data-testid="btn-copy-selection"
                onClick={() => {
                  onCopy()
                  setMenuOpen(false)
                }}
              >
                Copy
              </button>
              <button
                className="context-menu-item w-full text-left context-menu-item-danger"
                data-testid="btn-delete-selection"
                onClick={() => {
                  onDelete()
                  setMenuOpen(false)
                }}
              >
                Delete
              </button>
              <button
                className="context-menu-item w-full text-left"
                data-testid="btn-select-all"
                onClick={() => {
                  onSelectAll()
                  setMenuOpen(false)
                }}
              >
                Select all
              </button>
              <button
                className="context-menu-item w-full text-left"
                data-testid="btn-deselect-all"
                onClick={() => {
                  onDeselectAll()
                  setMenuOpen(false)
                }}
              >
                Deselect all
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
