import { useEffect, useMemo, useRef, useState } from 'react'
import MoneyInput from '../../components/inputs/MoneyInput'
import PercentInput from '../../components/inputs/PercentInput'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import { useSettings } from '../../context/settingsContext'
import { StorageService } from '../../services/storageService'
import type { Expense, FixedExpense, FixedExpenseSnapshot } from '../../types'
import { cn } from '../../utils/cn'
import {
  checkRangeOverlaps,
  clamp,
  findGapToFill,
  flattenRangesToMonthMap,
  getMaxMonthForYear,
  getYearlyVariableTotals,
  isFullyCovered,
  monthMapToRanges,
  type RangeItem,
  removeRangeAndMerge,
  updateRangeEndAndCascade,
} from '../../utils/historicalDataHelpers'
import { resolveMoneyLocaleConfig } from '../../utils/moneyInput'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

let _idCounter = 0
const nextId = () => `tmp-${++_idCounter}`

interface FixedItem {
  id: string
  name: string
  amount: string | number
  startMonth: number
  endMonth: number
  existingFixedExpenseId?: number
}

interface YearConfig {
  incomeRanges: import('../../utils/historicalDataHelpers').RangeItem[]
  savingsRanges: import('../../utils/historicalDataHelpers').RangeItem[]
  fixedItems: FixedItem[]
}

// ── Reusable sub-components (defined inside same file for cohesion) ──────────

// ── Reusable input style (uses global .input-theme) ─────────────────────────
const ghostInputCls = 'input-theme px-3 py-2 text-sm'

const ghostSelectCls = 'input-theme px-2 py-2 text-sm cursor-pointer'

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

// ── Reusable sub-components ──────────────────────────────────────────────────

interface HistoricalYearTabsProps {
  years: number[]
  activeYear: number | null
  dirtyYears: Set<number>
  onSelect: (year: number) => void
}

function HistoricalYearTabs({ years, activeYear, dirtyYears, onSelect }: HistoricalYearTabsProps) {
  return (
    <div className="shrink-0 flex items-end gap-0.5 overflow-x-auto scrollbar-auto-hide px-1 pb-0">
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
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  minMonth?: number
  maxMonth?: number
  cls?: string
}

function MonthSelect({ value, onChange, minMonth = 1, maxMonth = 12, cls }: MonthSelectProps) {
  return (
    <select value={value} onChange={onChange} className={cls}>
      {MONTHS.map((m, i) => {
        const monthNum = i + 1
        if (monthNum < minMonth || monthNum > maxMonth) return null
        return (
          <option key={m} value={monthNum}>
            {m}
          </option>
        )
      })}
    </select>
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
  /** Id of the range that was just added — its input will be auto-focused */
  focusedRangeId?: string | null
  formatAmount: (n: number) => string
}

function MultiRangeList({
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

  // Sort by startMonth for display and cascade logic
  const sortedRanges = [...ranges].sort((a, b) => a.startMonth - b.startMonth)

  // Determine if the year is fully covered (no gaps)
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
              {/* Start month — editable, constrained to after previous range */}
              <MonthSelect
                value={range.startMonth}
                onChange={(e) => onUpdate(range.id, { startMonth: parseInt(e.target.value, 10) })}
                minMonth={startMonthMin}
                maxMonth={range.endMonth}
                cls={`${ghostSelectCls} w-18`}
              />
              <span className="text-theme-muted text-xs">→</span>
              <MonthSelect
                value={Math.min(range.endMonth, maxMonth)}
                onChange={(e) => onUpdate(range.id, { endMonth: parseInt(e.target.value, 10) })}
                minMonth={range.startMonth}
                maxMonth={endMonthMax}
                cls={`${ghostSelectCls} w-18`}
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

function FixedExpenseList({
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
    return Array.from(presetMap.entries()).map(([name, amount]) => ({
      name,
      amount,
    }))
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
                onChange={(e) =>
                  onUpdate(item.id, {
                    startMonth: parseInt(e.target.value, 10),
                  })
                }
                maxMonth={maxMonth}
                cls={`${ghostSelectCls} w-18`}
              />
              <span className="text-theme-muted text-xs">→</span>
              <MonthSelect
                value={displayEndMonth}
                onChange={(e) => onUpdate(item.id, { endMonth: parseInt(e.target.value, 10) })}
                maxMonth={maxMonth}
                cls={`${ghostSelectCls} w-18`}
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

function PreviewTable({ yearConfig, variableTotals, formatAmount }: PreviewTableProps) {
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
        rate,
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

// ── Main Component ───────────────────────────────────────────────────────────

type HistoricalStorage = Pick<
  typeof StorageService,
  | 'bulkUpsertIncomeSnapshots'
  | 'bulkUpsertSavingsSnapshots'
  | 'bulkUpsertSnapshots'
  | 'deleteIncomeSnapshotsForYear'
  | 'deleteSavingsSnapshotsForYear'
  | 'deleteSnapshotsForYear'
  | 'addArchivedFixedExpense'
>

interface SaveHistoricalDataConfigsParams {
  storage: HistoricalStorage
  dirtyYears: Set<number>
  yearConfigs: Record<number, YearConfig>
  saveMode: 'merge' | 'replace'
}

export async function saveHistoricalDataConfigs({
  storage,
  dirtyYears,
  yearConfigs,
  saveMode,
}: SaveHistoricalDataConfigsParams): Promise<void> {
  for (const year of dirtyYears) {
    const config = yearConfigs[year]
    if (!config) continue

    const hasData =
      config.incomeRanges.length > 0 ||
      config.savingsRanges.length > 0 ||
      config.fixedItems.length > 0
    if (!hasData) continue

    const incomeMap = flattenRangesToMonthMap(config.incomeRanges)
    const savingsMap = flattenRangesToMonthMap(config.savingsRanges)
    if (saveMode === 'replace') {
      await storage.deleteIncomeSnapshotsForYear(year)
      await storage.deleteSavingsSnapshotsForYear(year)
    }

    const incomeSnapshots = Object.entries(incomeMap).map(([month, amount]) => ({
      year,
      month: parseInt(month, 10),
      amountSnapshot: amount as number,
    }))
    const savingsSnapshots = Object.entries(savingsMap).map(([month, rate]) => ({
      year,
      month: parseInt(month, 10),
      rateSnapshot: rate as number,
    }))
    if (incomeSnapshots.length > 0) {
      await storage.bulkUpsertIncomeSnapshots(incomeSnapshots)
    }
    if (savingsSnapshots.length > 0) {
      await storage.bulkUpsertSavingsSnapshots(savingsSnapshots)
    }

    const validFixedItems = config.fixedItems.filter(
      (i) =>
        i.name.trim() &&
        !Number.isNaN(parseFloat(String(i.amount))) &&
        parseFloat(String(i.amount)) !== 0,
    )

    if (saveMode === 'replace') {
      await storage.deleteSnapshotsForYear(year)
    }

    if (validFixedItems.length === 0) {
      continue
    }

    const newSnapshots: FixedExpenseSnapshot[] = []
    for (const item of validFixedItems) {
      const fixedAmount = parseFloat(String(item.amount))
      const fixedName = item.name.trim()
      const existingId = item.existingFixedExpenseId
      const fixedExpenseId =
        existingId ??
        (await storage.addArchivedFixedExpense({
          name: fixedName,
          amount: fixedAmount,
        }))
      const sm = clamp(parseInt(String(item.startMonth), 10) || 1, 1, 12)
      const em = clamp(parseInt(String(item.endMonth), 10) || 12, 1, 12)
      for (let m = sm; m <= em; m++) {
        newSnapshots.push({
          fixedExpenseId,
          year,
          month: m,
          amountSnapshot: fixedAmount,
          nameSnapshot: fixedName,
        })
      }
    }

    if (newSnapshots.length > 0) {
      await storage.bulkUpsertSnapshots(newSnapshots)
    }
  }
}

interface EditHistoricalDataModalProps {
  isOpen: boolean
  onClose: () => void
  years: number[]
  expenses?: Expense[]
  onComplete?: () => void | Promise<void>
  defaultIncome?: string
  defaultSavingsRate?: string
}

export default function EditHistoricalDataModal({
  isOpen,
  onClose,
  years: rawYears,
  expenses = [],
  onComplete,
  defaultIncome = '',
  defaultSavingsRate = '',
}: EditHistoricalDataModalProps) {
  const { formatAmount } = useSettings()
  // Filter out current year if it has 0 editable months (e.g., January)
  const years = useMemo(
    () =>
      rawYears.filter((y) => {
        const maxMonth = getMaxMonthForYear(y)
        return maxMonth >= 1
      }),
    [rawYears],
  )

  const [activeYear, setActiveYear] = useState<number | null>(() =>
    years.length > 0 ? years[0] : null,
  )
  const [yearConfigs, setYearConfigs] = useState<Record<number, YearConfig>>({})
  const [dirtyYears, setDirtyYears] = useState<Set<number>>(new Set())
  const [saveMode, setSaveMode] = useState<'merge' | 'replace'>('merge')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [currentFixedDefs, setCurrentFixedDefs] = useState<FixedExpense[]>([])
  const [restoredFromDraft, setRestoredFromDraft] = useState(false)
  const [_reloadKey, setReloadKey] = useState(0)
  // Track the id of the most recently added range so its input gets focused
  const [focusedIncomeRangeId, setFocusedIncomeRangeId] = useState<string | null>(null)
  const [focusedSavingsRangeId, setFocusedSavingsRangeId] = useState<string | null>(null)

  // ── Draft persistence ──────────────────────────────────────────────────────
  // Key includes sorted years so drafts from different year sets don't collide.
  const draftKey = `outflow:editHistoricalDraft:${years.slice().sort().join(',')}`

  // Persist draft to localStorage whenever configs/mode change (debounced 500ms)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (dirtyYears.size === 0) return // nothing to persist yet
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            yearConfigs,
            dirtyYears: [...dirtyYears],
            saveMode,
          }),
        )
      } catch {
        // localStorage may be full or unavailable — silently ignore
      }
    }, 500)
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [yearConfigs, dirtyYears, saveMode, draftKey])

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey)
    } catch {
      /* ignore */
    }
  }

  // Load existing data when modal opens
  useEffect(() => {
    if (!isOpen || years.length === 0) {
      setLoading(false)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [fixedDefs, incSnaps, savSnaps, allFixedSnaps] = await Promise.all([
          StorageService.getFixedExpenses(),
          StorageService.getAllIncomeSnapshots(),
          StorageService.getAllSavingsSnapshots(),
          StorageService.getAllFixedExpenseSnapshots(),
        ])

        const defMap = new Map(
          (fixedDefs as Array<{ id?: number; name: string }>).map((f) => [f.id, f]),
        )

        const configs: Record<number, YearConfig> = {}

        for (const year of years) {
          // Income: load from snapshots
          const yearIncSnaps = incSnaps.filter((s) => s.year === year)
          const incMonthMap: Record<number, number> = {}
          for (const s of yearIncSnaps) incMonthMap[s.month] = s.amountSnapshot
          const incomeRanges = monthMapToRanges(incMonthMap)

          // Savings: load from snapshots
          const yearSavSnaps = savSnaps.filter((s) => s.year === year)
          const savMonthMap: Record<number, number> = {}
          for (const s of yearSavSnaps) savMonthMap[s.month] = s.rateSnapshot
          const savingsRanges = monthMapToRanges(savMonthMap)

          // Fixed expenses from snapshots
          const snapshots = allFixedSnaps.filter((s) => s.year === year)
          const byDef = new Map<number, FixedExpenseSnapshot[]>()
          for (const s of snapshots) {
            if (!byDef.has(s.fixedExpenseId)) byDef.set(s.fixedExpenseId, [])
            byDef.get(s.fixedExpenseId)?.push(s)
          }
          const fixedItems: FixedItem[] = []
          for (const [defId, snaps] of byDef) {
            const def = defMap.get(defId)
            const monthMap: Record<number, number> = {}
            for (const s of snaps) monthMap[s.month] = s.amountSnapshot
            const ranges = monthMapToRanges(monthMap)
            for (const r of ranges) {
              fixedItems.push({
                id: nextId(),
                name:
                  (def as { name?: string } | undefined)?.name ||
                  snaps[0]?.nameSnapshot ||
                  'Unknown',
                amount: r.amount,
                startMonth: r.startMonth,
                endMonth: r.endMonth,
                existingFixedExpenseId: defId,
              })
            }
          }

          configs[year] = { incomeRanges, savingsRanges, fixedItems }
        }

        if (!cancelled) {
          // Check for a persisted draft and restore it if present
          let restoredFromDraft = false
          try {
            const raw = localStorage.getItem(draftKey)
            if (raw) {
              const draft = JSON.parse(raw) as {
                yearConfigs: Record<number, YearConfig>
                dirtyYears: number[]
                saveMode: 'merge' | 'replace'
              }
              // Merge draft on top of DB-loaded configs (draft wins for dirty years)
              const merged = { ...configs }
              for (const [yearStr, cfg] of Object.entries(draft.yearConfigs)) {
                const y = Number(yearStr)
                if (years.includes(y)) merged[y] = cfg
              }
              setYearConfigs(merged)
              setDirtyYears(new Set(draft.dirtyYears))
              setSaveMode(draft.saveMode ?? 'merge')
              restoredFromDraft = true
            }
          } catch {
            // Corrupt draft — ignore and use DB data
          }

          if (!restoredFromDraft) {
            setYearConfigs(configs)
            setDirtyYears(new Set())
            setSaveMode('merge')
          }
          setRestoredFromDraft(restoredFromDraft)
          setActiveYear(years[0])
          setErrors({})
          setResultMsg('')
          setCurrentFixedDefs(fixedDefs as FixedExpense[])
        }
      } catch (err) {
        console.error('Failed to load historical data:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isOpen, years, draftKey])

  const updateYearConfig = (year: number, patch: Partial<YearConfig>) => {
    setYearConfigs((prev) => ({
      ...prev,
      [year]: { ...prev[year], ...patch },
    }))
    setDirtyYears((prev) => new Set(prev).add(year))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[year]
      return next
    })
  }

  const addIncomeRange = (year: number) => {
    const ranges = [...(yearConfigs[year]?.incomeRanges || [])]
    const gap = findGapToFill(ranges, getMaxMonthForYear(year))
    if (!gap) return
    const id = nextId()
    setFocusedIncomeRangeId(id)
    updateYearConfig(year, {
      incomeRanges: [...ranges, { id, amount: '', ...gap }],
    })
  }

  const removeIncomeRange = (year: number, id: string) => {
    const ranges = yearConfigs[year]?.incomeRanges || []
    setFocusedIncomeRangeId(null)
    updateYearConfig(year, {
      incomeRanges: removeRangeAndMerge(ranges, id),
    })
  }

  const updateIncomeRange = (year: number, id: string, patch: Partial<RangeItem>) => {
    const ranges = yearConfigs[year]?.incomeRanges || []
    if (patch.endMonth != null) {
      updateYearConfig(year, {
        incomeRanges: updateRangeEndAndCascade(ranges, id, patch.endMonth),
      })
    } else {
      updateYearConfig(year, {
        incomeRanges: ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      })
    }
  }

  const addSavingsRange = (year: number) => {
    const ranges = [...(yearConfigs[year]?.savingsRanges || [])]
    const gap = findGapToFill(ranges, getMaxMonthForYear(year))
    if (!gap) return
    const id = nextId()
    setFocusedSavingsRangeId(id)
    updateYearConfig(year, {
      savingsRanges: [...ranges, { id, amount: '', ...gap }],
    })
  }

  const removeSavingsRange = (year: number, id: string) => {
    const ranges = yearConfigs[year]?.savingsRanges || []
    setFocusedSavingsRangeId(null)
    updateYearConfig(year, {
      savingsRanges: removeRangeAndMerge(ranges, id),
    })
  }

  const updateSavingsRange = (year: number, id: string, patch: Partial<RangeItem>) => {
    const ranges = yearConfigs[year]?.savingsRanges || []
    if (patch.endMonth != null) {
      updateYearConfig(year, {
        savingsRanges: updateRangeEndAndCascade(ranges, id, patch.endMonth),
      })
    } else {
      updateYearConfig(year, {
        savingsRanges: ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      })
    }
  }

  const quickAddIncomeRange = (year: number, value: string) => {
    const ranges = [...(yearConfigs[year]?.incomeRanges || [])]
    const gap = findGapToFill(ranges, getMaxMonthForYear(year))
    if (!gap) return
    const id = nextId()
    setFocusedIncomeRangeId(id)
    updateYearConfig(year, {
      incomeRanges: [...ranges, { id, amount: value, ...gap }],
    })
  }

  const quickAddSavingsRange = (year: number, value: string) => {
    const ranges = [...(yearConfigs[year]?.savingsRanges || [])]
    const gap = findGapToFill(ranges, getMaxMonthForYear(year))
    if (!gap) return
    const id = nextId()
    setFocusedSavingsRangeId(id)
    updateYearConfig(year, {
      savingsRanges: [...ranges, { id, amount: value, ...gap }],
    })
  }

  const addFixedItem = (year: number) => {
    const items = yearConfigs[year]?.fixedItems || []
    updateYearConfig(year, {
      fixedItems: [
        ...items,
        {
          id: nextId(),
          name: '',
          amount: '',
          startMonth: 1,
          endMonth: getMaxMonthForYear(year),
        },
      ],
    })
  }

  const removeFixedItem = (year: number, id: string) => {
    const items = yearConfigs[year]?.fixedItems || []
    updateYearConfig(year, {
      fixedItems: items.filter((i) => i.id !== id),
    })
  }

  const updateFixedItem = (year: number, id: string, patch: Partial<FixedItem>) => {
    const items = yearConfigs[year]?.fixedItems || []
    updateYearConfig(year, {
      fixedItems: items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })
  }

  const addPreset = (year: number, preset: { name: string; amount: string }) => {
    const items = yearConfigs[year]?.fixedItems || []
    updateYearConfig(year, {
      fixedItems: [
        ...items,
        {
          id: nextId(),
          name: preset.name,
          amount: preset.amount,
          startMonth: 1,
          endMonth: getMaxMonthForYear(year),
        },
      ],
    })
  }

  const validate = (): boolean => {
    const nextErrors: Record<string, string[]> = {}
    let hasError = false
    let hasAnyData = false

    for (const year of dirtyYears) {
      const config = yearConfigs[year]
      if (!config) continue

      const yearErrors: string[] = []

      // Validate income ranges
      for (const range of config.incomeRanges) {
        const amt = parseFloat(String(range.amount))
        if (Number.isNaN(amt)) yearErrors.push('Income amount must be a number.')
        else if (amt <= 0) yearErrors.push('Income amount must be > 0.')
      }
      yearErrors.push(...checkRangeOverlaps(config.incomeRanges, 'Income'))

      // Validate savings ranges
      for (const range of config.savingsRanges) {
        const rate = parseFloat(String(range.amount))
        if (Number.isNaN(rate)) yearErrors.push('Savings rate must be a number.')
        else if (rate < 0 || rate > 100) yearErrors.push('Savings rate must be 0–100.')
      }
      yearErrors.push(...checkRangeOverlaps(config.savingsRanges, 'Savings'))

      // Validate fixed items
      for (const item of config.fixedItems) {
        if (!item.name.trim()) yearErrors.push('Fixed expense name is required.')
        const amt = parseFloat(String(item.amount))
        if (Number.isNaN(amt)) yearErrors.push('Fixed expense amount must be a number.')
        else if (amt === 0) yearErrors.push('Fixed expense amount cannot be zero.')
        if (item.startMonth > item.endMonth)
          yearErrors.push('Fixed expense start month must be ≤ end month.')
      }

      const yearHasData =
        config.incomeRanges.length > 0 ||
        config.savingsRanges.length > 0 ||
        config.fixedItems.length > 0
      if (yearHasData) hasAnyData = true

      if (yearErrors.length) {
        nextErrors[year] = yearErrors
        hasError = true
      }
    }

    if (!hasAnyData) {
      nextErrors._global = ['Select at least one year and configure data for it.']
      hasError = true
    }

    setErrors(nextErrors)
    return !hasError
  }

  const handleConfirm = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await saveHistoricalDataConfigs({
        storage: StorageService,
        dirtyYears,
        yearConfigs,
        saveMode,
      })
      await onComplete?.()
      clearDraft()
      setYearConfigs({})
      setActiveYear(years.length > 0 ? years[0] : null)
      setDirtyYears(new Set())
      setSaveMode('merge')
      setErrors({})
      setResultMsg('')
      onClose()
    } catch (err) {
      console.error('Edit historical data failed:', err)
      setResultMsg(`Error: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setYearConfigs({})
    setActiveYear(years.length > 0 ? years[0] : null)
    setDirtyYears(new Set())
    setSaveMode('merge')
    setErrors({})
    setResultMsg('')
    onClose()
  }

  const discardDraft = () => {
    clearDraft()
    setRestoredFromDraft(false)
    setReloadKey((k) => k + 1) // re-triggers the load effect to reload from DB
  }

  const activeConfig: YearConfig = yearConfigs[activeYear ?? 0] || {
    incomeRanges: [],
    savingsRanges: [],
    fixedItems: [],
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Historical Data"
      size="full"
      bodyClassName="flex min-h-0 flex-col overflow-hidden"
      mobileActionLabel="Save"
      onMobileAction={handleConfirm}
      mobileActionDisabled={saving || Object.keys(errors).length > 0}
      footer={
        <ModalFooter className="justify-end">
          <button
            onClick={handleClose}
            className="btn-cancel-sm flex-1 sm:min-w-[8.5rem] sm:flex-none"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="btn-modal-primary flex-1 sm:min-w-[9.5rem] sm:flex-none"
            disabled={saving || Object.keys(errors).length > 0}
          >
            {saving ? 'Saving…' : 'Confirm Save'}
          </button>
        </ModalFooter>
      }
    >
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-8 text-center text-sm text-theme-muted">
          Loading existing data…
        </div>
      ) : years.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-center text-sm text-theme-muted">
          No historical data available. There are no past months to edit yet.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 mb-2 px-3 py-2">
            <p className="text-xs leading-relaxed text-theme-muted">
              Use this to complete past months with budget details that imports do not include:
              monthly income, savings rate, and fixed expenses. It saves historical snapshots for
              summaries and analytics and does not import or change transactions.
            </p>
          </div>

          {/* Draft restored banner */}
          {restoredFromDraft && (
            <div className="shrink-0 flex items-center justify-between gap-3 rounded-theme-medium border border-theme-primary bg-[color:color-mix(in_srgb,var(--theme-primary)_8%,transparent)] px-3 py-2 text-xs mb-2">
              <span className="text-theme-primary font-medium">
                Unsaved changes restored from your last session.
              </span>
              <button
                onClick={discardDraft}
                className="text-theme-muted hover:text-theme-danger transition-colors shrink-0"
              >
                Discard
              </button>
            </div>
          )}

          {/* Year tabs — attached to the card below */}
          {years.length > 0 && (
            <HistoricalYearTabs
              years={years}
              activeYear={activeYear}
              dirtyYears={dirtyYears}
              onSelect={setActiveYear}
            />
          )}

          {/* Containing card — anchors to the tabs above */}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-theme-large bg-theme-surface border border-theme-border shadow-sm p-4 sm:p-5 space-y-5">
            {activeYear && (
              <>
                {/* Income ranges */}
                <MultiRangeList
                  ranges={activeConfig.incomeRanges}
                  type="income"
                  year={activeYear}
                  onAdd={() => addIncomeRange(activeYear)}
                  onRemove={(id) => removeIncomeRange(activeYear, id)}
                  onUpdate={(id, patch) => updateIncomeRange(activeYear, id, patch)}
                  quickAddValue={defaultIncome}
                  onQuickAdd={(value) => quickAddIncomeRange(activeYear, value)}
                  focusedRangeId={focusedIncomeRangeId}
                  formatAmount={formatAmount}
                />

                {/* Savings ranges */}
                <MultiRangeList
                  ranges={activeConfig.savingsRanges}
                  type="savings"
                  year={activeYear}
                  onAdd={() => addSavingsRange(activeYear)}
                  onRemove={(id) => removeSavingsRange(activeYear, id)}
                  onUpdate={(id, patch) => updateSavingsRange(activeYear, id, patch)}
                  quickAddValue={defaultSavingsRate}
                  onQuickAdd={(value) => quickAddSavingsRange(activeYear, value)}
                  focusedRangeId={focusedSavingsRangeId}
                  formatAmount={formatAmount}
                />

                {/* Fixed expenses */}
                <FixedExpenseList
                  items={activeConfig.fixedItems}
                  year={activeYear}
                  onAdd={() => addFixedItem(activeYear)}
                  onRemove={(id) => removeFixedItem(activeYear, id)}
                  onUpdate={(id, patch) => updateFixedItem(activeYear, id, patch)}
                  onPreset={(preset) => addPreset(activeYear, preset)}
                  currentFixedDefs={currentFixedDefs}
                />

                {/* Preview */}
                <PreviewTable
                  yearConfig={activeConfig}
                  variableTotals={getYearlyVariableTotals(activeYear, expenses)}
                  formatAmount={formatAmount}
                />
              </>
            )}

            {/* Save mode — segmented control */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-theme-muted">Save mode</span>
              <div className="inline-flex rounded-theme-medium bg-theme-background border border-theme-border p-0.5">
                <button
                  onClick={() => setSaveMode('merge')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-theme-medium transition-all ${
                    saveMode === 'merge'
                      ? 'bg-theme-surface text-theme-primary shadow-sm'
                      : 'text-theme-muted hover:text-theme-text'
                  }`}
                >
                  Merge
                </button>
                <button
                  onClick={() => setSaveMode('replace')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-theme-medium transition-all ${
                    saveMode === 'replace'
                      ? 'bg-theme-surface text-theme-primary shadow-sm'
                      : 'text-theme-muted hover:text-theme-text'
                  }`}
                >
                  Replace
                </button>
              </div>
            </div>
            <p className="text-xs text-theme-muted leading-relaxed">
              <strong className="text-theme-text">Merge</strong>: New values overwrite existing
              months. Unchanged months keep their old values. Old snapshots remain.
              <br />
              <strong className="text-theme-text">Replace</strong>: All existing snapshots for the
              year are deleted and replaced. Income/savings overrides are fully rewritten.
            </p>

            {/* Validation errors */}
            {errors._global && <p className="text-theme-danger text-xs">{errors._global}</p>}
            {Object.entries(errors)
              .filter(([k]) => k !== '_global')
              .map(([year, errs]) => (
                <div key={year} className="space-y-0.5">
                  <p className="text-theme-danger text-xs font-semibold">{year}:</p>
                  {errs.map((err) => (
                    <p key={err} className="text-theme-danger text-xs">
                      {err}
                    </p>
                  ))}
                </div>
              ))}

            {resultMsg && (
              <p
                className={`text-xs ${
                  resultMsg.startsWith('Error') ? 'text-theme-danger' : 'text-theme-success'
                }`}
              >
                {resultMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
