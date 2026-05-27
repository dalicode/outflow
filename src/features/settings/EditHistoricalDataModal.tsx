import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import {
  FixedExpenseList,
  HistoricalYearTabs,
  MultiRangeList,
  PreviewTable,
} from './components/HistoricalEditorSections'
import { useFinanceActions } from '../../context/financeDataContext'
import { useSettings } from '../../context/settingsContext'
import { StorageService } from '../../services/storageService'
import type {
  HistoricalFixedItem,
  HistoricalYearConfig,
} from '../../services/repositories/historicalSnapshotRepository'
import type { Expense, FixedExpense } from '../../types'
import {
  checkRangeOverlaps,
  findGapToFill,
  getMaxMonthForYear,
  getYearlyVariableTotals,
  monthMapToRanges,
  type RangeItem,
  removeRangeAndMerge,
  updateRangeEndAndCascade,
} from '../../utils/historicalDataHelpers'
import { createTemporaryId, fixedSnapshotsToItems } from './utils/historicalEditorSnapshots'

type FixedItem = HistoricalFixedItem
type YearConfig = HistoricalYearConfig
// ── Main Component ───────────────────────────────────────────────────────────

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
  const { saveHistoricalSnapshotConfigs } = useFinanceActions()
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
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [currentFixedDefs, setCurrentFixedDefs] = useState<FixedExpense[]>([])
  const [restoredFromDraft, setRestoredFromDraft] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)
  // Track the id of the most recently added range so its input gets focused
  const [focusedIncomeRangeId, setFocusedIncomeRangeId] = useState<string | null>(null)
  const [focusedSavingsRangeId, setFocusedSavingsRangeId] = useState<string | null>(null)

  // ── Draft persistence ──────────────────────────────────────────────────────
  // Key includes sorted years so drafts from different year sets don't collide.
  const draftKey = `outflow:editHistoricalDraft:${years.slice().sort().join(',')}`

  // Persist draft to localStorage whenever configs change (debounced 500ms)
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
          }),
        )
      } catch {
        // localStorage may be full or unavailable — silently ignore
      }
    }, 500)
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [yearConfigs, dirtyYears, draftKey])

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
    // Passing the nonce makes the reload trigger explicit for this effect run.
    const load = async (reloadNonceForLoad: number) => {
      setLoading(true)
      try {
        const [fixedDefs, incSnaps, savSnaps, allFixedSnaps] = await Promise.all([
          StorageService.getFixedExpenses(),
          StorageService.getIncomeSnapshots(),
          StorageService.getSavingsSnapshots(),
          StorageService.getFixedExpenseSnapshots(),
        ])

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
          const fixedItems = fixedSnapshotsToItems(snapshots)

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
                saveMode?: 'merge' | 'replace'
              }
              // Merge draft on top of DB-loaded configs (draft wins for dirty years)
              const merged = { ...configs }
              for (const [yearStr, cfg] of Object.entries(draft.yearConfigs)) {
                const y = Number(yearStr)
                if (years.includes(y)) merged[y] = cfg
              }
              setYearConfigs(merged)
              setDirtyYears(new Set(draft.dirtyYears))
              restoredFromDraft = true
            }
          } catch {
            // Corrupt draft — ignore and use DB data
          }

          if (!restoredFromDraft) {
            setYearConfigs(configs)
            setDirtyYears(new Set())
          }
          setRestoredFromDraft(restoredFromDraft)
          setActiveYear(years[0])
          setErrors({})
          setResultMsg('')
          setCurrentFixedDefs(fixedDefs as FixedExpense[])
        }
      } catch (err) {
        console.error('Failed to load historical data:', err, { reloadNonce: reloadNonceForLoad })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load(reloadNonce)
    return () => {
      cancelled = true
    }
  }, [draftKey, isOpen, reloadNonce, years])

  const updateYearConfig = (year: number, patch: Partial<YearConfig>) => {
    setYearConfigs((prev) => ({
      ...prev,
      [year]: { ...prev[year], ...patch },
    }))
    setDirtyYears((prev) => new Set(prev).add(year))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[year]
      delete next._global
      return next
    })
  }

  const addIncomeRange = (year: number) => {
    const ranges = [...(yearConfigs[year]?.incomeRanges || [])]
    const gap = findGapToFill(ranges, getMaxMonthForYear(year))
    if (!gap) return
    const id = createTemporaryId()
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
    const id = createTemporaryId()
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
    const id = createTemporaryId()
    setFocusedIncomeRangeId(id)
    updateYearConfig(year, {
      incomeRanges: [...ranges, { id, amount: value, ...gap }],
    })
  }

  const quickAddSavingsRange = (year: number, value: string) => {
    const ranges = [...(yearConfigs[year]?.savingsRanges || [])]
    const gap = findGapToFill(ranges, getMaxMonthForYear(year))
    if (!gap) return
    const id = createTemporaryId()
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
          id: createTemporaryId(),
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
          id: createTemporaryId(),
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

    if (dirtyYears.size === 0) {
      nextErrors._global = ['No changes to save.']
      setErrors(nextErrors)
      return false
    }

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

      if (yearErrors.length) {
        nextErrors[year] = yearErrors
        hasError = true
      }
    }

    setErrors(nextErrors)
    return !hasError
  }

  const handleConfirm = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await saveHistoricalSnapshotConfigs({
        dirtyYears,
        yearConfigs,
      })
      await onComplete?.()
      clearDraft()
      setYearConfigs({})
      setActiveYear(years.length > 0 ? years[0] : null)
      setDirtyYears(new Set())
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
    setErrors({})
    setResultMsg('')
    onClose()
  }

  const discardDraft = () => {
    clearDraft()
    setRestoredFromDraft(false)
    setReloadNonce((nonce) => nonce + 1) // re-triggers the load effect to reload from DB
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

            <p className="text-xs text-theme-muted leading-relaxed">
              Saving applies only the differences for each edited year: changed months are updated,
              removed months are deleted, and unchanged snapshots are left as-is.
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
