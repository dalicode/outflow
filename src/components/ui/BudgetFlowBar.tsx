/**
 * BudgetFlowBar — shared stacked bar + allocation rows used by both
 * the Summary page (BudgetFlow) and the Analytics page (IncomeFlowBar).
 *
 * Features preserved from both originals:
 * - Portal tooltip that follows the mouse (top-right of cursor)
 * - Click-to-pin tooltip (analytics mode)
 * - Per-segment colors (including per-category variable colors)
 * - Over-budget striped segment + optional dashed income line
 * - Remaining tone gradient (green → red)
 * - Allocation rows with dot, label, %, amount
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { GREEN_TO_RED_SCALE } from '../../utils/summaryColorUtils'
import { cn } from '../../utils/cn'
import PrivateValue from '../privacy/PrivateValue'
import { PencilIcon } from './IconButton'

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getRemainingBarColor(
  remaining: number,
  baselineRemaining: number,
  successColor: string,
  dangerColor: string,
): string {
  if (remaining <= 0 || baselineRemaining <= 0) return dangerColor
  const remainingPct = (remaining / baselineRemaining) * 100
  const scale = [
    successColor,
    ...GREEN_TO_RED_SCALE.slice(1, -1).map((item) => item.hex),
    dangerColor,
  ]
  if (remainingPct >= 50) return scale[0]
  const ratioFromHalfToZero = (50 - remainingPct) / 50
  const scaledIndex = 1 + Math.floor(ratioFromHalfToZero * (scale.length - 1))
  return scale[Math.min(scaledIndex, scale.length - 1)]
}

export function barPct(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, (value / total) * 100))
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BarSegment {
  key: string
  label: string
  value: number
  /** Width as % of income (already clamped 0–100) */
  widthPct: number
  color?: string
  /** Tailwind bg class (alternative to color) */
  bgClass?: string
}

interface TooltipState {
  key: string
  label: string
  value: number
  displayPct: number
  /** clientX for portal positioning */
  x: number
  /** clientY for portal positioning */
  y: number
}

// ── Allocation row ────────────────────────────────────────────────────────────

interface AllocationRowProps {
  label: string
  value: number
  rowPct: number
  dotColor?: string
  dotClass?: string
  textColor?: string
  textClass?: string
  prefix?: string
  formatAmount: (n: number) => string
  privateValue?: boolean
  privatePercentage?: boolean
  onClick?: () => void
  ariaLabel?: string
  showActionSlot?: boolean
  showZeroPercent?: boolean
  density?: 'default' | 'compact'
}

export function AllocationRow({
  label,
  value,
  rowPct,
  dotColor,
  dotClass,
  textColor,
  textClass,
  prefix = '',
  formatAmount,
  privateValue = false,
  privatePercentage = privateValue,
  onClick,
  ariaLabel,
  showActionSlot = true,
  showZeroPercent = false,
  density = 'default',
}: AllocationRowProps) {
  const amount = (
    <>
      {prefix}
      {formatAmount(value)}
    </>
  )

  const percentageText = rowPct !== 0 || showZeroPercent ? `${rowPct.toFixed(0)}%` : '—'

  const content = (
    <>
      <span
        className={cn('inline-block w-2 h-2 rounded-full shrink-0 mt-0.5', dotClass)}
        style={dotColor ? { backgroundColor: dotColor } : undefined}
      />
      <span className="text-sm text-theme-text min-w-0 truncate">{label}</span>
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-theme-muted tabular-nums w-10 text-right">
          {privatePercentage ? (
            <PrivateValue>{percentageText}</PrivateValue>
          ) : rowPct !== 0 || showZeroPercent ? (
            percentageText
          ) : (
            '—'
          )}
        </span>
        <span
          className={cn('text-sm font-semibold tabular-nums w-24 text-right', textClass)}
          style={textColor ? { color: textColor } : undefined}
        >
          {privateValue ? <PrivateValue>{amount}</PrivateValue> : amount}
        </span>
      </div>
      {showActionSlot ? (
        <span
          className={cn('flex w-5 justify-end text-theme-muted', !onClick && 'invisible')}
          aria-hidden="true"
          data-testid={`allocation-action-slot-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <PencilIcon className="w-3.5 h-3.5" />
        </span>
      ) : null}
    </>
  )

  const gridColumns = showActionSlot
    ? 'grid-cols-[auto_minmax(0,1fr)_auto_auto]'
    : 'grid-cols-[auto_minmax(0,1fr)_auto]'
  const rowPaddingY = density === 'compact' ? 'py-1.5' : 'py-2.5'

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? label}
        className={cn(
          'grid w-full items-center gap-2 rounded-theme-medium px-2 text-left transition-colors hover:bg-theme-background',
          rowPaddingY,
          gridColumns,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30',
        )}
      >
        {content}
      </button>
    )
  }

  return <div className={cn('grid items-center gap-2 px-2 py-1.5', gridColumns)}>{content}</div>
}

// ── Main component ────────────────────────────────────────────────────────────

interface BudgetFlowBarProps {
  income: number
  /** Pre-built bar segments (order = left to right) */
  segments: BarSegment[]
  remaining: number
  /** Color for the remaining segment */
  remainingColor: string
  isOverBudget: boolean
  /** Amount by which spending exceeds income (> 0 when isOverBudget) */
  overflowAmt: number
  /** Total allocated as % of income (may exceed 100) */
  spentPct: number
  /** Show a dashed vertical line at the 100% mark when over budget */
  showOverflowLine?: boolean
  /** Allow clicking segments to pin the tooltip */
  allowPinTooltip?: boolean
  formatAmount: (n: number) => string
  /** Slot rendered below the bar (allocation rows, divider, remaining row) */
  children?: React.ReactNode
}

export default function BudgetFlowBar({
  income,
  segments,
  remaining,
  remainingColor,
  isOverBudget,
  overflowAmt,
  spentPct,
  showOverflowLine = false,
  allowPinTooltip = false,
  formatAmount,
  children,
}: BudgetFlowBarProps) {
  const [hovered, setHovered] = useState<TooltipState | null>(null)
  const [pinnedKey, setPinnedKey] = useState<string | null>(null)

  const makeTooltip = (
    e: React.MouseEvent,
    key: string,
    label: string,
    value: number,
    displayPct: number,
  ): TooltipState => ({
    key,
    label,
    value,
    displayPct,
    x: e.clientX,
    y: e.clientY,
  })

  const updatePos = (e: React.MouseEvent) => {
    setHovered((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev))
  }

  const handleSegmentClick = (key: string) => {
    if (!allowPinTooltip) return
    setPinnedKey((prev) => (prev === key ? null : key))
  }

  // Pinned tooltip (analytics click-to-pin) — only shown when not hovering
  const pinnedTooltip: TooltipState | null =
    allowPinTooltip && !hovered && pinnedKey
      ? (() => {
          const seg =
            segments.find((s) => s.key === pinnedKey) ??
            (isOverBudget && pinnedKey === 'overflow'
              ? {
                  key: 'overflow',
                  label: 'Over Budget',
                  value: overflowAmt,
                  widthPct: barPct(overflowAmt, income),
                  color: undefined,
                }
              : null)
          if (!seg) return null
          return {
            key: seg.key,
            label: seg.label,
            value: seg.value,
            displayPct: barPct(seg.value, income),
            x: 0,
            y: 0,
          }
        })()
      : null

  const activeTooltip = hovered ?? pinnedTooltip

  if (income <= 0) {
    return (
      <div className="h-8 flex items-center justify-center rounded-full bg-theme-background">
        <span className="text-xs text-theme-muted">No income data</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="relative flex h-3 w-full" style={{ minWidth: 0 }}>
        <div
          className="flex h-full w-full overflow-hidden rounded-full bg-theme-background gap-px"
          onMouseLeave={() => setHovered(null)}
        >
          {segments.map((seg) =>
            seg.widthPct > 0 ? (
              <div
                key={seg.key}
                className={cn(
                  'h-full transition-all duration-500',
                  allowPinTooltip && 'cursor-pointer',
                  seg.bgClass,
                )}
                style={{
                  width: `${seg.widthPct}%`,
                  backgroundColor: seg.color,
                }}
                onMouseEnter={(e) =>
                  setHovered(
                    makeTooltip(e, seg.key, seg.label, seg.value, barPct(seg.value, income)),
                  )
                }
                onMouseMove={updatePos}
                onClick={() => handleSegmentClick(seg.key)}
              />
            ) : null,
          )}

          {/* Remaining segment (only when not over budget) */}
          {!isOverBudget && remaining > 0 && (
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${barPct(remaining, income)}%`,
                backgroundColor: remainingColor,
              }}
              onMouseEnter={(e) =>
                setHovered(
                  makeTooltip(e, 'remaining', 'Remaining', remaining, barPct(remaining, income)),
                )
              }
              onMouseMove={updatePos}
            />
          )}

          {/* Over-budget striped fill (inside bar, fills remaining space) */}
          {isOverBudget && !showOverflowLine && (
            <div
              className="bar-overbudget h-full transition-all duration-500 flex-1"
              onMouseEnter={(e) =>
                setHovered(
                  makeTooltip(
                    e,
                    'overflow',
                    'Over Budget',
                    Math.abs(remaining),
                    Math.abs(barPct(remaining, income)),
                  ),
                )
              }
              onMouseMove={updatePos}
            />
          )}
        </div>

        {/* Over-budget overflow segment (outside bar — analytics style) */}
        {isOverBudget && showOverflowLine && overflowAmt > 0 && (
          <div
            className="bar-overbudget h-full rounded-r-full transition-all duration-500 cursor-pointer ml-px"
            style={{ width: `${barPct(overflowAmt, income)}%` }}
            onMouseEnter={(e) =>
              setHovered(
                makeTooltip(e, 'overflow', 'Over Budget', overflowAmt, barPct(overflowAmt, income)),
              )
            }
            onMouseMove={updatePos}
            onClick={() => handleSegmentClick('overflow')}
          />
        )}

        {/* Dashed income line (analytics style) */}
        {isOverBudget && showOverflowLine && (
          <div
            className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed pointer-events-none"
            style={{
              left: `${barPct(income, income + overflowAmt)}%`,
              borderColor: 'var(--theme-danger)',
              opacity: 0.7,
            }}
          />
        )}
      </div>

      {/* % labels */}
      <div className="flex justify-between text-[0.6875rem] text-theme-muted tabular-nums">
        <span>0%</span>
        <span className={cn(spentPct > 100 && 'text-theme-danger font-medium')}>
          {spentPct.toFixed(0)}% allocated
        </span>
        <span className={cn(isOverBudget && 'text-theme-danger font-medium')}>
          {isOverBudget ? `${spentPct.toFixed(0)}%` : '100%'}
        </span>
      </div>

      {/* Portal tooltip — follows mouse, top-right of cursor */}
      {activeTooltip &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 rounded-theme-medium border border-theme-border bg-theme-surface px-2.5 py-1.5 shadow-sm"
            style={{
              left: activeTooltip.x + 12,
              top: activeTooltip.y - 8,
              transform: 'translateY(-100%)',
            }}
          >
            <div className="text-[0.6875rem] font-medium text-theme-text">
              {activeTooltip.label}
            </div>
            <div className="text-[0.6875rem] text-theme-muted tabular-nums">
              {formatAmount(activeTooltip.value)} · {activeTooltip.displayPct.toFixed(0)}%
            </div>
          </div>,
          document.body,
        )}

      {/* Allocation rows slot */}
      {children}
    </div>
  )
}
