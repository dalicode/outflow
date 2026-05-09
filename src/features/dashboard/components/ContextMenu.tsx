import { createPortal } from 'react-dom'
import { cn } from '../../../utils/cn'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
  menuRef?: React.RefObject<HTMLDivElement | null>
}

export default function ContextMenu({ x, y, items, onClose, menuRef }: ContextMenuProps) {
  return createPortal(
    <div ref={menuRef} className="context-menu" style={{ left: x, top: y }} role="menu">
      {items.map((item, i) => (
        <button
          key={i}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (!item.disabled) {
              item.onClick()
              onClose()
            }
          }}
          className={cn(
            'context-menu-item w-full text-left',
            item.danger && 'context-menu-item-danger',
            item.disabled && 'opacity-40 cursor-not-allowed',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
