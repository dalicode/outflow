import { useMemo } from 'react'
import DesktopDropdown from '../../../components/inputs/DesktopDropdown'
import MoneyInput from '../../../components/inputs/MoneyInput'
import PercentInput from '../../../components/inputs/PercentInput'
import type {
  HistoricalFixedItem,
  HistoricalYearConfig,
} from '../../../services/repositories/historicalSnapshotRepository'
import type { FixedExpense } from '../../../types'
import { cn } from '../../../lib/cn'
import {
  clamp,
  findGapToFill,
  flattenRangesToMonthMap,
  getMaxMonthForYear,
  isFullyCovered,
  type RangeItem,
} from '../../../utils/historicalDataHelpers'
import { resolveMoneyLocaleConfig } from '../../../utils/moneyInput'

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const ghostInputCls = 'input-theme px-3 py-2 text-sm'
const ghostSelectCls = 'input-theme px-2 py-2 text-sm cursor-pointer'

type FixedItem = HistoricalFixedItem
type YearConfig = HistoricalYearConfig

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded-full text-theme-muted hover:text-theme-danger hover:bg-theme-danger-muted transition-all"
      aria-label="Remove"
    >
      <span className="text-xs leading-none">&times;</span>
    </button>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 pt-5 border-t border-theme-border first:pt-0 first:border-t-0">
      <h3 className="text-sm font-semibold text-theme-text">{title}</h3>
      {children}
    </div>
  )
}

interface HistoricalYearTabsProps {
  years: number[]
  activeYear: number | null
  dirtyYears: Set<number>
  onSelect: (year: number) => void
}

export function HistoricalYearTabs({
  years,
  activeYear,
  dirtyYears,
  onSelect,
}: HistoricalYearTabsProps) {
  return (
    <div className="shrink-0 flex items-end gap-0.5 overflow-x-auto px-1 pb-0">
      {years.map((y) => {
        const isActive = y === activeYear
        const isDirty = dirtyYears.has(y) && !isActive
        return (
          <button
            key={y}
            onClick={() => onSelect(y)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-t-theme-medium text-xs font-medium',
              'transition-[background-color,color] duration-150',
              'motion-safe:active:scale-[0.98]',
              isActive
                ? 'bg-theme-surface text-theme-text border border-theme-border border-b-theme-surface -mb-px'
                : 'bg-theme-background text-theme-muted hover:text-theme-text',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="flex items-center gap-1.5">
              {y}
              {isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-theme-primary inline-block" />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

interface MonthSelectProps {
  value: number
  onChange: (month: number) => void
  minMonth?: number
  maxMonth?: number
  cls?: string
}

function MonthSelect({ value, onChange, minMonth = 1, maxMonth = 12, cls }: MonthSelectProps) {
  const monthOptions = MONTHS.map((month, index) => ({
    id: index + 1,
    label: month,
  })).filter((option) => option.id >= minMonth && option.id <= maxMonth)

  return (
    <DesktopDropdown
      value={value}
      options={monthOptions}
      placeholder="Select month"
      emptyMessage="No months available."
      ariaLabel="Month"
      searchable={false}
      preserveOrder
      triggerSize="sm"
      triggerClassName={cls}
      onChange={(month) => {
        if (typeof month === 'number') {
          onChange(month)
        }
      }}
    />
  )
}

interface MultiRangeListProps {
  ranges: RangeItem[]
  type: 'income' | 'savings'
  year: number
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<RangeItem>) => void
  quickAddValue?: string
  onQuickAdd?: (value: string) => void
  focusedRangeId?: string | null
  formatAmount: (n: number) => string
}

export function MultiRangeList({
  ranges,
  type,
  year,
  onAdd,
  onRemove,
  onUpdate,
  quickAddValue,
  onQuickAdd,
  focusedRangeId,
  formatAmount,
}: MultiRangeListProps) {
  const isIncome = type === 'income'
  const label = isIncome ? 'Monthly Income' : 'Auto Savings %'
  const placeholder = isIncome ? 'e.g. 5000' : 'e.g. 20'
  const inputWidth = 'w-36'
  const moneyConfig = resolveMoneyLocaleConfig('$')

  const maxMonth = getMaxMonthForYear(year)
  const sortedRanges = [...ranges].sort((a, b) => a.startMonth - b.startMonth)
  const fullyCovered = isFullyCovered(sortedRanges, maxMonth)
  const hasQuickAddValue = quickAddValue && quickAddValue !== '0' && quickAddValue !== ''

  return (
    <SectionCard title={label}>
      {ranges.length === 0 && (
        <p className="text-xs text-theme-muted italic">No ranges configured.</p>
      )}
      <div className="space-y-2">
        {sortedRanges.map((range, idx) => {
          const prevRange = sortedRanges[idx - 1]
          const nextRange = sortedRanges[idx + 1]
          const startMonthMin = prevRange ? prevRange.endMonth + 1 : 1
          const endMonthMax = nextRange ? nextRange.startMonth - 1 : maxMonth
          const shouldFocus = range.id === focusedRangeId
          return (
            <div key={range.id} className="flex items-center gap-2 flex-wrap">
              {isIncome ? (
                <MoneyInput
                  value={Number.parseFloat(String(range.amount || '0'))}
                  onChange={(amount) => onUpdate(range.id, { amount: amount.toFixed(2) })}
                  currency={moneyConfig.currency}
                  locale={moneyConfig.locale}
                  placeholder={placeholder}
                  size="sm"
                  autoFocus={shouldFocus}
                  className={inputWidth}
                />
              ) : (
                <PercentInput
                  value={Number.parseFloat(String(range.amount || '0'))}
                  onChange={(val) => onUpdate(range.id, { amount: val.toFixed(2) })}
                  autoFocus={shouldFocus}
                  className={inputWidth}
                />
              )}
              <MonthSelect
                value={range.startMonth}
                onChange={(month) => onUpdate(range.id, { startMonth: month })}
                minMonth={startMonthMin}
                maxMonth={range.endMonth}
                cls={`${ghostSelectCls} w-20`}
              />
              <span className="text-theme-muted text-xs">→</span>
              <MonthSelect
                value={Math.min(range.endMonth, maxMonth)}
                onChange={(month) => onUpdate(range.id, { endMonth: month })}
                minMonth={range.startMonth}
                maxMonth={endMonthMax}
                cls={`${ghostSelectCls} w-20`}
              />
              <RemoveBtn onClick={() => onRemove(range.id)} />
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onAdd}
          disabled={fullyCovered}
          className={cn(
            'text-sm font-medium transition-colors',
            fullyCovered
              ? 'text-theme-muted cursor-not-allowed'
              : 'text-theme-primary hover:text-theme-primary',
          )}
        >
          + Add {isIncome ? 'income' : 'savings'} range
        </button>
        {hasQuickAddValue && onQuickAdd && (
          <button
            onClick={() => onQuickAdd(quickAddValue)}
            disabled={fullyCovered}
            className={cn(
              'text-xs font-medium transition-colors',
              fullyCovered
                ? 'text-theme-muted cursor-not-allowed'
                : 'text-theme-primary hover:underline',
            )}
          >
            Use current: {isIncome ? formatAmount(Number(quickAddValue)) : `${quickAddValue}%`}
          </button>
        )}
      </div>
    </SectionCard>
  )
}

interface FixedExpenseListProps {
  items: FixedItem[]
  year: number
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<FixedItem>) => void
  onPreset: (preset: { name: string; amount: string }) => void
  currentFixedDefs: FixedExpense[]
}

const HARDCODED_PRESETS = [
  { name: 'Rent', amount: '1200' },
  { name: 'Utilities', amount: '150' },
  { name: 'Insurance', amount: '200' },
  { name: 'Internet', amount: '80' },
  { name: 'Phone', amount: '50' },
]

export function FixedExpenseList({
  items,
  year,
  onAdd,
  onRemove,
  onUpdate,
  onPreset,
  currentFixedDefs,
}: FixedExpenseListProps) {
  const presets = useMemo(() => {
    const presetMap = new Map<string, string>()
    currentFixedDefs.forEach((def) => {
      if (def.name?.trim()) {
        presetMap.set(def.name.trim(), String(def.amount))
      }
    })
    HARDCODED_PRESETS.forEach((p) => {
      presetMap.set(p.name, p.amount)
    })
    return Array.from(presetMap.entries()).map(([name, amount]) => ({ name, amount }))
  }, [currentFixedDefs])

  const maxMonth = getMaxMonthForYear(year)
  const moneyConfig = resolveMoneyLocaleConfig('$')

  return (
    <SectionCard title="Fixed Expenses">
      {items.length === 0 && (
        <p className="text-xs text-theme-muted italic">No fixed expenses configured.</p>
      )}
      <div className="space-y-2">
        {items.map((item) => {
          const displayEndMonth = Math.min(item.endMonth, maxMonth)
          return (
            <div key={item.id} className="flex items-center gap-2 flex-wrap">
              <input
                value={item.name}
                onChange={(e) => onUpdate(item.id, { name: e.target.value })}
                placeholder="Name"
                className={`${ghostInputCls} w-36`}
              />
              <MoneyInput
                value={Number.parseFloat(String(item.amount || '0'))}
                onChange={(amount) => onUpdate(item.id, { amount: amount.toFixed(2) })}
                currency={moneyConfig.currency}
                locale={moneyConfig.locale}
                placeholder="Amount"
                size="sm"
                className="w-28"
              />
              <MonthSelect
                value={item.startMonth}
                onChange={(month) => onUpdate(item.id, { startMonth: month })}
                maxMonth={maxMonth}
                cls={`${ghostSelectCls} w-20`}
              />
              <span className="text-theme-muted text-xs">→</span>
              <MonthSelect
                value={displayEndMonth}
                onChange={(month) => onUpdate(item.id, { endMonth: month })}
                maxMonth={maxMonth}
                cls={`${ghostSelectCls} w-20`}
              />
              <RemoveBtn onClick={() => onRemove(item.id)} />
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onAdd}
          className="text-sm text-theme-primary hover:text-theme-primary font-medium transition-colors"
        >
          + Add another
        </button>
        <span className="text-xs text-theme-muted">Quick add:</span>
        {presets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onPreset(preset)}
            className="text-xs text-theme-primary hover:underline font-medium transition-all"
          >
            {preset.name}
          </button>
        ))}
      </div>
      <p className="text-xs text-theme-muted mt-1">
        Pre-fills name and amount. Adjust the amount if it was different in this year.
      </p>
    </SectionCard>
  )
}

interface PreviewTableProps {
  yearConfig: YearConfig
  variableTotals: number[]
  formatAmount: (n: number) => string
}

export function PreviewTable({ yearConfig, variableTotals, formatAmount }: PreviewTableProps) {
  const timeline = useMemo(() => {
    const incomeMap = flattenRangesToMonthMap(yearConfig.incomeRanges)
    const savingsMap = flattenRangesToMonthMap(yearConfig.savingsRanges)

    const fixedItems = yearConfig.fixedItems
      .filter((i) => i.name.trim() && !Number.isNaN(parseFloat(String(i.amount))))
      .map((i) => ({
        name: i.name.trim(),
        amount: parseFloat(String(i.amount)) || 0,
        startMonth: clamp(i.startMonth || 1, 1, 12),
        endMonth: clamp(i.endMonth || 12, 1, 12),
      }))

    return Array.from({ length: 12 }, (_, m) => {
      const month = m + 1
      const fixedTotal = fixedItems
        .filter((i) => month >= i.startMonth && month <= i.endMonth)
        .reduce((s, i) => s + i.amount, 0)
      const variableTotal = variableTotals?.[m] || 0
      const income = incomeMap[month] || 0
      const rate = savingsMap[month] || 0
      const autoSavings = Math.max(0, income * (rate / 100))
      const remaining = income - fixedTotal - variableTotal - autoSavings
      const totalSavings = autoSavings + remaining
      return {
        month,
        income,
        fixedTotal,
        autoSavings,
        totalSavings,
      }
    })
  }, [yearConfig, variableTotals])

  const totals = useMemo(() => {
    return {
      fixed: timeline.reduce((s, t) => s + t.fixedTotal, 0),
      income: timeline.reduce((s, t) => s + t.income, 0),
      autoSavings: timeline.reduce((s, t) => s + t.autoSavings, 0),
      totalSavings: timeline.reduce((s, t) => s + t.totalSavings, 0),
    }
  }, [timeline])

  const hasAnyData =
    yearConfig.incomeRanges.length > 0 ||
    yearConfig.savingsRanges.length > 0 ||
    yearConfig.fixedItems.length > 0 ||
    (variableTotals || []).some((v) => v > 0)

  if (!hasAnyData) return null

  const valueCell = (val: number, type: 'fixed' | 'income' | 'autoSavings' | 'totalSavings') => {
    if (val === 0) return <span className="text-theme-muted">—</span>
    const baseCls = 'tabular-nums'
    switch (type) {
      case 'fixed':
        return <span className={cn(baseCls, 'text-theme-text')}>{formatAmount(val)}</span>
      case 'income':
        return <span className={cn(baseCls, 'text-theme-success')}>{formatAmount(val)}</span>
      case 'autoSavings':
        return <span className={cn(baseCls, 'text-theme-primary')}>{formatAmount(val)}</span>
      case 'totalSavings':
        return (
          <span
            className={cn(
              baseCls,
              val > 0 ? 'text-theme-success' : val < 0 ? 'text-theme-danger' : 'text-theme-text',
            )}
          >
            {formatAmount(val)}
          </span>
        )
    }
  }

  return (
    <div>
      <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide block mb-2">
        Preview
      </label>
      <div className="rounded-theme-large border border-theme-border shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-theme-background border-b border-theme-border">
              <th className="text-left px-2 py-1.5 font-semibold text-theme-muted">Month</th>
              <th className="text-right px-2 py-1.5 font-semibold text-theme-muted">Fixed</th>
              <th className="text-right px-2 py-1.5 font-semibold text-theme-muted">Income</th>
              <th className="text-right px-2 py-1.5 font-semibold text-theme-muted">
                Auto Savings
              </th>
              <th className="text-right px-2 py-1.5 font-semibold text-theme-muted">
                Total Savings
              </th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((t) => (
              <tr key={t.month} className="border-b border-theme-border">
                <td className="px-2 py-1.5 text-theme-text font-medium">{MONTHS[t.month - 1]}</td>
                <td className="text-right px-2 py-1.5">{valueCell(t.fixedTotal, 'fixed')}</td>
                <td className="text-right px-2 py-1.5">{valueCell(t.income, 'income')}</td>
                <td className="text-right px-2 py-1.5">
                  {valueCell(t.autoSavings, 'autoSavings')}
                </td>
                <td className="text-right px-2 py-1.5">
                  {valueCell(t.totalSavings, 'totalSavings')}
                </td>
              </tr>
            ))}
            <tr className="bg-theme-background-semi font-semibold">
              <td className="px-2 py-1.5 text-theme-text">Total</td>
              <td className="text-right px-2 py-1.5">{valueCell(totals.fixed, 'fixed')}</td>
              <td className="text-right px-2 py-1.5">{valueCell(totals.income, 'income')}</td>
              <td className="text-right px-2 py-1.5">
                {valueCell(totals.autoSavings, 'autoSavings')}
              </td>
              <td className="text-right px-2 py-1.5">
                {valueCell(totals.totalSavings, 'totalSavings')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-theme-muted mt-2">
        Total Savings includes auto savings, remaining budget, and your recorded expenses for this
        period.
      </p>
    </div>
  )
}

export function getInitialRangeGap(
  ranges: RangeItem[],
  year: number,
): { startMonth: number; endMonth: number } | null {
  return findGapToFill(ranges, getMaxMonthForYear(year))
}
