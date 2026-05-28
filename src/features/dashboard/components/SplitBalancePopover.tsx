import { createPortal } from 'react-dom'
import type { Ref } from 'react'
import type { FloatingPosition } from '../../../utils/floatingPosition'
import type { SplitBalanceTargetPreview } from '../utils/splitBalance'

interface SplitBalanceTargetRow extends SplitBalanceTargetPreview {
  label: string
}

interface SplitBalanceTotalRow {
  currentAmount: number
  resultingAmount: number
}

interface SplitBalancePopoverProps {
  isOpen: boolean
  position: FloatingPosition | null
  popoverRef: Ref<HTMLDivElement>
  remainingAmount: number
  targetRows: SplitBalanceTargetRow[]
  totalRow?: SplitBalanceTotalRow
  formatAmount: (amount: number) => string
  onApplyToChild: (expenseId: number) => void
  onApplyToTotal?: () => void
}

export default function SplitBalancePopover({
  isOpen,
  position,
  popoverRef,
  remainingAmount,
  targetRows,
  totalRow,
  formatAmount,
  onApplyToChild,
  onApplyToTotal,
}: SplitBalancePopoverProps) {
  if (!isOpen || !position) return null

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Split balance"
      data-testid="split-balance-popover"
      className="rounded-theme-large border border-theme-border bg-theme-surface p-2 shadow-lg"
      style={{
        position: 'fixed',
        zIndex: 60,
        left: position.left,
        width: position.width,
        top: position.top,
        bottom: position.bottom,
      }}
    >
      <p className="px-1 pb-2 text-xs text-theme-text" data-testid="split-balance-remaining">
        {remainingAmount >= 0
          ? `To save, assign ${formatAmount(remainingAmount)} remaining`
          : `To save, reduce by ${formatAmount(Math.abs(remainingAmount))}`}
      </p>
      <div className="space-y-1">
        {targetRows.map((target) => (
          <button
            key={target.expenseId}
            type="button"
            className="w-full rounded-theme-small border border-theme-border bg-theme-background px-2 py-1 text-left text-xs text-theme-text hover:bg-theme-muted-subtle"
            onClick={() => onApplyToChild(target.expenseId)}
            data-testid={`split-balance-target-${target.expenseId}`}
          >
            {target.label}: {formatAmount(target.currentAmount)} {'->'}{' '}
            {formatAmount(target.resultingAmount)}
          </button>
        ))}
        {totalRow && onApplyToTotal ? (
          <button
            type="button"
            className="w-full rounded-theme-small border border-theme-border bg-theme-background px-2 py-1 text-left text-xs text-theme-text hover:bg-theme-muted-subtle"
            onClick={onApplyToTotal}
            data-testid="split-balance-total-target"
          >
            Total: {formatAmount(totalRow.currentAmount)} {'->'} {formatAmount(totalRow.resultingAmount)}
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
