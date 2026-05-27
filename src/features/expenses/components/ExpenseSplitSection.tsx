import DesktopDropdown from '../../../components/inputs/DesktopDropdown'
import MobileEntityPicker from '../../../components/inputs/MobileEntityPicker'
import MoneyInput from '../../../components/inputs/MoneyInput'
import SingleSelectTrigger from '../../../components/inputs/SingleSelectTrigger'
import { cn } from '../../../lib/cn'
import type { ComboboxOption } from '../../../components/inputs'

export interface SplitChildDraft {
  rowId: string
  expenseId?: number
  categoryId: string
  notes: string
  amount: string
}

interface SplitSectionProps {
  canToggleSplitMode: boolean
  isSplitMode: boolean
  toggleSplitMode: () => void
  splitChildren: SplitChildDraft[]
  splitPayeeInheritanceLabel: string
  isLoadingSplit: boolean
  categoryOptions: ComboboxOption[]
  recentCategoryOptions: ComboboxOption[]
  openSplitCategoryPickers: Record<string, boolean>
  isMobileViewport: boolean
  decimalPlaces: number
  moneyConfig: { locale: string; currency: string }
  inputCls: string
  splitReconciliation: { isBalanced: boolean; difference: number }
  formatAmount: (n: number) => string
  setOpenSplitCategoryPickers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setSplitChildField: <K extends keyof SplitChildDraft>(
    rowId: string,
    field: K,
    value: SplitChildDraft[K],
  ) => void
  createCategory: (name: string) => Promise<number>
  addSplitChild: () => void
  applyRemainingToChild: (rowId: string) => void
  removeSplitChild: (rowId: string) => void
}

export default function ExpenseSplitSection({
  canToggleSplitMode,
  isSplitMode,
  toggleSplitMode,
  splitChildren,
  splitPayeeInheritanceLabel,
  isLoadingSplit,
  categoryOptions,
  recentCategoryOptions,
  openSplitCategoryPickers,
  isMobileViewport,
  decimalPlaces,
  moneyConfig,
  inputCls,
  splitReconciliation,
  formatAmount,
  setOpenSplitCategoryPickers,
  setSplitChildField,
  createCategory,
  addSplitChild,
  applyRemainingToChild,
  removeSplitChild,
}: SplitSectionProps) {
  return (
    <div className="space-y-3">
      <label
        className={cn(
          'flex items-start gap-3 rounded-theme-medium border border-theme-border bg-theme-surface px-3 py-2.5 transition-colors',
          canToggleSplitMode ? 'cursor-pointer' : 'opacity-60',
        )}
      >
        <input
          type="checkbox"
          checked={isSplitMode}
          onChange={toggleSplitMode}
          disabled={!canToggleSplitMode}
          data-testid="toggle-split-mode"
          className="sr-only"
          aria-label="Enable split transaction"
        />
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
            isSplitMode
              ? 'border-theme-primary bg-theme-primary-subtle text-theme-primary'
              : 'border-theme-border bg-theme-background text-transparent',
          )}
        >
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6.25L4.75 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-sm text-theme-text">Split transaction</span>
          <span className="block text-xs text-theme-muted">
            {canToggleSplitMode
              ? 'Break this expense into multiple category allocations.'
              : 'This expense already belongs to a saved split transaction.'}
          </span>
        </span>
      </label>

      {isSplitMode && (
        <div className="space-y-3 rounded-theme-large border border-theme-border bg-theme-background p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-theme-text">Split allocations</div>
              <div className="mt-0.5 text-xs text-theme-muted">
                Each row uses the parent payee: {splitPayeeInheritanceLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={addSplitChild}
              className="btn-cancel-sm flex-none px-3 py-1.5 text-xs"
              data-testid="btn-add-split-row"
            >
              + Add row
            </button>
          </div>
          {isLoadingSplit && (
            <div className="text-xs text-theme-muted" data-testid="split-loading">
              Loading split rows…
            </div>
          )}
          {splitChildren.map((child, index) => {
            const selectedSplitCategoryName = categoryOptions.find(
              (option) => option.id === Number(child.categoryId),
            )?.label
            const isSplitCategoryPickerOpen = openSplitCategoryPickers[child.rowId] ?? false

            return (
              <div
                key={child.rowId}
                className="space-y-3 rounded-theme-medium border border-theme-border bg-theme-surface p-3"
                data-testid={`split-row-${index}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-theme-primary-subtle text-xs font-semibold text-theme-primary">
                      {index + 1}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-theme-text">
                      Allocation
                    </span>
                  </div>
                  <span className="min-w-0 truncate text-xs text-theme-muted">
                    {splitPayeeInheritanceLabel}
                  </span>
                </div>
                <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="flex flex-col gap-1">
                    <label className="block text-sm text-theme-muted">{`Split category ${index + 1}`}</label>
                    {isMobileViewport ? (
                      <div data-testid={`mobile-split-category-trigger-${index}`}>
                        <SingleSelectTrigger
                          value={selectedSplitCategoryName}
                          placeholder="Select category"
                          isOpen={isSplitCategoryPickerOpen}
                          ariaLabel={`Split category ${index + 1}`}
                          onClick={() =>
                            setOpenSplitCategoryPickers((prev) => ({
                              ...prev,
                              [child.rowId]: true,
                            }))
                          }
                        />
                        <MobileEntityPicker
                          open={isSplitCategoryPickerOpen}
                          title="Choose Category"
                          value={child.categoryId ? Number(child.categoryId) : undefined}
                          options={categoryOptions}
                          recentOptions={recentCategoryOptions}
                          placeholder="Search or add category"
                          emptyMessage="No categories found."
                          createHint="Type a new category name to add it."
                          allowCreate
                          onChange={(id) =>
                            setSplitChildField(
                              child.rowId,
                              'categoryId',
                              id != null ? String(id) : '',
                            )
                          }
                          onCreate={createCategory}
                          onClose={() =>
                            setOpenSplitCategoryPickers((prev) => ({
                              ...prev,
                              [child.rowId]: false,
                            }))
                          }
                        />
                      </div>
                    ) : (
                      <div data-testid={`desktop-split-category-dropdown-${index}`}>
                        <DesktopDropdown
                          value={child.categoryId ? Number(child.categoryId) : undefined}
                          options={categoryOptions}
                          recentOptions={recentCategoryOptions}
                          placeholder="Select category"
                          emptyMessage="No categories found."
                          createHint="Type a new category name to add it."
                          allowCreate
                          ariaLabel={`Split category ${index + 1}`}
                          autoFocus={false}
                          onChange={(id) =>
                            setSplitChildField(
                              child.rowId,
                              'categoryId',
                              id != null ? String(id) : '',
                            )
                          }
                          onCreate={createCategory}
                        />
                      </div>
                    )}
                  </div>
                  <MoneyInput
                    label={`Split amount ${index + 1}`}
                    value={Number.parseFloat(child.amount || '0')}
                    onChange={(amount) =>
                      setSplitChildField(child.rowId, 'amount', amount.toFixed(decimalPlaces))
                    }
                    currency={moneyConfig.currency}
                    locale={moneyConfig.locale}
                    allowNegative
                    entryMode={isMobileViewport ? 'cents' : 'decimal'}
                    size="md"
                    className="w-full"
                    inputClassName="text-right"
                  />
                </div>
                <label className="flex flex-col gap-1 text-xs text-theme-muted">
                  Notes
                  <input
                    type="text"
                    value={child.notes}
                    onChange={(event) =>
                      setSplitChildField(child.rowId, 'notes', event.target.value)
                    }
                    className={inputCls}
                    placeholder="Optional"
                    aria-label={`Split notes ${index + 1}`}
                  />
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => applyRemainingToChild(child.rowId)}
                    className="btn-cancel-sm whitespace-nowrap"
                    data-testid={`btn-apply-remaining-${index}`}
                  >
                    Apply remaining
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSplitChild(child.rowId)}
                    disabled={splitChildren.length === 1}
                    className="btn-cancel-sm whitespace-nowrap disabled:opacity-50"
                    data-testid={`btn-remove-split-row-${index}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
          <div
            className={cn(
              'rounded-theme-medium border px-3 py-2 text-sm',
              splitReconciliation.isBalanced
                ? 'border-[color:color-mix(in_srgb,var(--theme-success)_30%,var(--theme-border))] bg-[color:color-mix(in_srgb,var(--theme-success)_7%,var(--theme-surface))]'
                : splitReconciliation.difference > 0
                  ? 'border-theme-warning-subtle bg-theme-warning-subtle'
                  : 'border-theme-danger-subtle bg-theme-danger-subtle',
            )}
          >
            {splitReconciliation.isBalanced ? (
              <span className="font-medium text-theme-success" data-testid="split-balanced">
                Balanced: split rows match the total.
              </span>
            ) : splitReconciliation.difference > 0 ? (
              <span className="text-theme-muted" data-testid="split-remaining">
                Remaining: <strong>{formatAmount(splitReconciliation.difference)}</strong>
              </span>
            ) : (
              <span className="text-theme-muted" data-testid="split-over">
                Over by: <strong>{formatAmount(Math.abs(splitReconciliation.difference))}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
