import type { ColumnDef } from '@tanstack/react-table'
import CreatableCombobox from '../../components/inputs/CreatableCombobox'
import DatePicker from '../../components/inputs/DatePicker'
import { StorageService } from '../../services/storageService'
import type { Category, Expense, Payee, Tag } from '../../types'
import { cn } from '../../lib/cn'
import InlineEditCell from './InlineEditCell'
import InlineMoneyEditCell from './InlineMoneyEditCell'
import type { ExpenseTableSort, SortableExpenseColumnId } from './expenseTableSorting'
import type { ExpenseDisplayRow } from './splitDisplayRows'
import {
  getStableTagIdentity,
  getTagSummaryChipStyle,
  getTagSummaryData,
  type TagSummaryData,
} from './tagSummaryChip'
import type { CellEditingAPI } from './useExpenseCellEditing'
import type { SplitBalanceTargetPreview } from './utils/splitBalance'

type EditableSplitField = 'date' | 'payeeId' | 'notes'

interface GetExpenseColumnsParams {
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  onToggleSplitParentSelect: (splitId: number) => void
  allSelected: boolean
  editing: CellEditingAPI
  onEnterNavigation?: (
    expense: Expense,
    field: 'date' | 'payeeId' | 'categoryId' | 'notes' | 'tags' | 'amount',
    shiftKey: boolean,
  ) => void
  onTabNavigation?: (
    expense: Expense,
    field: 'date' | 'payeeId' | 'categoryId' | 'notes' | 'tags' | 'amount',
    shiftKey: boolean,
  ) => void
  formatDate: (iso: string) => string
  formatAmount: (n: number) => string
  catMap: Record<number, Category>
  activeCategories: Category[]
  activePayees: Payee[]
  payeeMap: Record<number, Payee>
  expenseTagsMap: Record<number, Tag[]>
  showNotesColumn: boolean
  showTagsColumn: boolean
  sort: ExpenseTableSort | null
  onToggleSort: (columnId: SortableExpenseColumnId) => void
  onToggleSplitExpanded: (splitId: number) => void
  isSplitExpanded: (splitId: number) => boolean
  isSplitParentSelected: (splitId: number) => boolean
  editingSplitField?: { splitId: number; field: EditableSplitField } | null
  onStartSplitFieldEdit: (splitId: number, field: EditableSplitField) => void
  onCommitSplitDateEdit: (splitId: number, value: string) => void
  onCommitSplitPayeeEdit: (splitId: number, payeeId: number | undefined) => void
  onCommitSplitNotesEdit: (splitId: number, value: string) => void
  onCancelSplitFieldEdit: () => void
  editingSplitAmount: {
    splitId: number
    expenseId?: number
  } | null
  onStartSplitContainerAmountEdit: (splitId: number) => void
  onStartSplitChildAmountEdit: (splitId: number, expenseId: number) => void
  onCommitSplitContainerAmountEdit: (splitId: number, amount: number) => void
  onCommitSplitChildAmountEdit: (splitId: number, expenseId: number, amount: number) => void
  onCancelSplitAmountEdit: () => void
  pendingSplitAmountEdit: {
    kind: 'splitChild' | 'splitContainer'
    splitId: number
    editedExpenseId?: number
    draftAmount: number
    containerAmount: number
    remainingAmount: number
    anchorKey: string
    childPreviewAmounts: Record<number, number>
    targetPreviews: SplitBalanceTargetPreview[]
    pendingChildrenTotal: number
  } | null
  isReadOnlyActiveCell?: (
    row: ExpenseDisplayRow,
    field: 'date' | 'payeeId' | 'categoryId' | 'notes' | 'tags' | 'amount',
  ) => boolean
  refreshCategories?: () => Promise<void>
  refreshPayees?: () => Promise<void>
}

interface EditableCellDisplayConfig {
  className: string
  title?: string
  content: React.ReactNode
  expenseId?: number
  field?: string
  splitAmountAnchor?: string
  isEditableCell?: boolean
  isSplitEditableDisplay?: boolean
}

interface SelectionCheckboxConfig {
  checked: boolean
  ariaLabel: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  boxClassName: string
}

interface EntityEditorConfig {
  value: number | undefined
  options: Array<{ id: number; label: string }>
  placeholder: string
  createHint: string
  autoOpen: boolean
  onCommit: (id: number | undefined) => void
  onEnterSelect: (id: number | undefined, shiftKey: boolean) => void
  onTabSelect: (id: number | undefined) => void
  onCreate: (name: string) => Promise<number>
  onCancel: () => void
  onTab: (shiftKey: boolean) => void
}

function isSplitFieldEditing(
  editingSplitField: { splitId: number; field: EditableSplitField } | null | undefined,
  splitId: number,
  field: EditableSplitField,
): boolean {
  return editingSplitField?.splitId === splitId && editingSplitField.field === field
}

function getEditableCellCursorClass(
  rowData: ExpenseDisplayRow,
  options: {
    allowExpense?: boolean
    allowSplitContainer?: boolean
    allowSplitChild?: boolean
  },
): string {
  if (rowData.rowType === 'splitContainer') {
    return options.allowSplitContainer ? 'cursor-pointer' : ''
  }

  if (rowData.rowType === 'splitChild') {
    return options.allowSplitChild ? 'cursor-pointer' : ''
  }

  return options.allowExpense ? 'cursor-pointer' : ''
}

function getSplitPayeeLabel(
  rowData: Extract<ExpenseDisplayRow, { rowType: 'splitContainer' }>,
  payeeMap: Record<number, Payee>,
): string {
  const splitPayeeId = rowData.split?.payeeId
  if (typeof splitPayeeId === 'number') {
    return payeeMap[splitPayeeId]?.name ?? rowData.split?.payeeNameSnapshot?.trim() ?? 'No payee'
  }

  const snapshot = rowData.split?.payeeNameSnapshot?.trim()
  if (snapshot) return snapshot

  return rowData.payeeDisplay
}

function getSplitContainerTags(
  rowData: Extract<ExpenseDisplayRow, { rowType: 'splitContainer' }>,
  expenseTagsMap: Record<number, Tag[]>,
): Tag[] {
  const dedupedTags: Tag[] = []
  const seenTagKeys = new Set<string>()

  rowData.childExpenses.forEach((expense) => {
    if (typeof expense.id !== 'number') return
    const tags = expenseTagsMap[expense.id] ?? []
    tags.forEach((tag) => {
      const tagKey = getStableTagIdentity(tag)
      if (seenTagKeys.has(tagKey)) return
      seenTagKeys.add(tagKey)
      dedupedTags.push(tag)
    })
  })

  return dedupedTags
}

function renderTagSummaryChip(summaryData: TagSummaryData): React.ReactNode {
  const { primaryTag, summary } = summaryData
  if (!primaryTag || !summary) return null

  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center rounded-theme-small border px-1.5 py-0.5 text-[11px] leading-tight',
        primaryTag.isArchived && 'italic',
      )}
      style={getTagSummaryChipStyle(primaryTag)}
      title={summary}
    >
      <span className="truncate">{summary}</span>
    </span>
  )
}

function shouldActivateFromPointerEvent(e: React.PointerEvent): boolean {
  if (e.button !== 0) return false
  if (e.target instanceof Element && e.target.closest('[data-no-cell-switch]')) return false
  return true
}

function activateFromPointerEvent(e: React.PointerEvent, onActivate: () => void): void {
  if (!shouldActivateFromPointerEvent(e)) return
  e.preventDefault()
  e.stopPropagation()
  onActivate()
}

function getColumnAriaSort(
  sort: ExpenseTableSort | null,
  columnId: SortableExpenseColumnId,
): React.AriaAttributes['aria-sort'] {
  if (sort?.columnId !== columnId) return 'none'
  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

function renderSortableHeader(params: {
  label: string
  columnId: SortableExpenseColumnId
  sort: ExpenseTableSort | null
  onToggleSort: (columnId: SortableExpenseColumnId) => void
  align?: 'left' | 'right'
}): React.ReactNode {
  const { label, columnId, sort, onToggleSort, align = 'left' } = params
  const isActive = sort?.columnId === columnId
  const indicator = isActive ? (sort.direction === 'asc' ? '↑' : '↓') : null

  return (
    <button
      type="button"
      className={cn(
        'inline-flex w-full items-center gap-1 text-left transition-colors hover:text-theme-text',
        align === 'right' ? 'justify-end text-right' : 'justify-start',
        isActive ? 'text-theme-text' : 'text-theme-muted',
      )}
      onClick={() => onToggleSort(columnId)}
    >
      <span>{label}</span>
      {indicator ? (
        <span aria-hidden="true" className="text-xs leading-none">
          {indicator}
        </span>
      ) : null}
    </button>
  )
}

export function editableCellActivate(
  editing: CellEditingAPI,
  expense: Expense,
  field: Parameters<CellEditingAPI['switchCellEdit']>[1],
) {
  return {
    onPointerDown: (e: React.PointerEvent) => {
      activateFromPointerEvent(e, () => {
        editing.switchCellEdit(expense, field)
      })
    },
  }
}

function renderEditableDisplayCell(
  display: EditableCellDisplayConfig,
  onActivate: (e: React.PointerEvent) => void,
): React.ReactNode {
  return (
    <span
      data-editable-cell={display.isEditableCell ? true : undefined}
      data-split-editable-display={display.isSplitEditableDisplay ? true : undefined}
      data-expense-id={display.expenseId}
      data-field={display.field}
      data-split-amount-anchor={display.splitAmountAnchor}
      data-testid={display.field ? `editable-cell-display-${display.field}` : undefined}
      className={display.className}
      title={display.title}
      onPointerDown={onActivate}
    >
      {display.content}
    </span>
  )
}

function renderSelectionCheckbox({
  checked,
  ariaLabel,
  onChange,
  boxClassName,
}: SelectionCheckboxConfig): React.ReactNode {
  return (
    <label className={cn('expense-checkbox-wrapper cursor-pointer', checked && 'checked')}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
        aria-label={ariaLabel}
      />
      <div
        className={cn(
          'expense-checkbox-box w-3.5 h-3.5 rounded-[2px] border transition-colors flex items-center justify-center',
          boxClassName,
        )}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-theme-text" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6.5L5 9l4.5-5.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </label>
  )
}

function renderDateEditor(
  value: string,
  onCommit: (nextValue: string) => void,
  onCancel: () => void,
  onEnter: (shiftKey: boolean) => void,
  onTab: (shiftKey: boolean) => void,
): React.ReactNode {
  return (
    <div className="w-full" data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
      <DatePicker
        value={value}
        variant="inline"
        autoOpen
        onChange={onCommit}
        onCancel={onCancel}
        onEnter={onEnter}
        onTab={onTab}
      />
    </div>
  )
}

function toOptionalNumber(id: number | string | null | undefined): number | undefined {
  return id != null ? Number(id) : undefined
}

function toEntityOptions(
  items: Array<{ id: number; name: string }>,
): Array<{ id: number; label: string }> {
  return items.map((item) => ({
    id: item.id,
    label: item.name,
  }))
}

async function createEntityAndRefresh(
  createEntity: (name: string) => Promise<number | undefined>,
  errorMessage: string,
  name: string,
  refresh?: () => Promise<void>,
  afterCreate?: (trimmedName: string) => void,
): Promise<number> {
  const newId = await createEntity(name)
  if (newId == null) throw new Error(errorMessage)
  afterCreate?.(name.trim())
  await refresh?.()
  return newId as number
}

function renderEntityEditor(config: EntityEditorConfig): React.ReactNode {
  return (
    <div className="w-full" data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
      <CreatableCombobox
        value={config.value}
        variant="inline"
        options={config.options}
        placeholder={config.placeholder}
        createHint={config.createHint}
        allowCreate
        autoOpen={config.autoOpen}
        autoFocus
        onChange={(id) => {
          const numId = toOptionalNumber(id)
          config.onCommit(numId)
        }}
        onEnterSelect={(id, shiftKey) => {
          const numId = toOptionalNumber(id)
          config.onEnterSelect(numId, shiftKey)
        }}
        onTabSelect={(id) => {
          const numId = toOptionalNumber(id)
          config.onTabSelect(numId)
        }}
        onCreate={config.onCreate}
        onCancel={config.onCancel}
        onTab={config.onTab}
      />
    </div>
  )
}

function renderNotesEditor(
  value: string,
  onCommit: (nextValue: string) => void,
  onCancel: () => void,
  onEnter: (shiftKey: boolean) => void,
  onTab: (shiftKey: boolean) => void,
): React.ReactNode {
  return (
    <InlineEditCell
      initialValue={value}
      onCommit={onCommit}
      onCancel={onCancel}
      onEnter={onEnter}
      onTab={onTab}
    />
  )
}

export function getExpenseColumns({
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onToggleSplitParentSelect,
  allSelected,
  editing,
  onEnterNavigation,
  onTabNavigation,
  formatDate,
  formatAmount,
  catMap,
  activeCategories,
  activePayees,
  payeeMap,
  expenseTagsMap,
  showNotesColumn,
  showTagsColumn,
  sort,
  onToggleSort,
  onToggleSplitExpanded,
  isSplitExpanded,
  isSplitParentSelected,
  editingSplitField,
  onStartSplitFieldEdit,
  onCommitSplitDateEdit,
  onCommitSplitPayeeEdit,
  onCommitSplitNotesEdit,
  onCancelSplitFieldEdit,
  editingSplitAmount,
  onStartSplitContainerAmountEdit,
  onStartSplitChildAmountEdit,
  onCommitSplitContainerAmountEdit,
  onCommitSplitChildAmountEdit,
  onCancelSplitAmountEdit,
  pendingSplitAmountEdit,
  isReadOnlyActiveCell,
  refreshCategories,
  refreshPayees,
}: GetExpenseColumnsParams): ColumnDef<ExpenseDisplayRow>[] {
  const runEnterNavigation = (
    expense: Expense,
    field: 'date' | 'payeeId' | 'categoryId' | 'notes' | 'tags' | 'amount',
    shiftKey: boolean,
  ) => {
    if (onEnterNavigation) {
      onEnterNavigation(expense, field, shiftKey)
      return
    }
    editing.handleEnterNavigation(expense, field, shiftKey)
  }

  const runTabNavigation = (
    expense: Expense,
    field: 'date' | 'payeeId' | 'categoryId' | 'notes' | 'tags' | 'amount',
    shiftKey: boolean,
  ) => {
    if (onTabNavigation) {
      onTabNavigation(expense, field, shiftKey)
      return
    }
    editing.handleTabNavigation(expense, field, shiftKey)
  }

  const getSplitNavigationExpense = (
    rowData: Extract<ExpenseDisplayRow, { rowType: 'splitContainer' }>,
  ): Expense | null => {
    return rowData.childExpenses[0] ?? null
  }

  const notesWidth = showTagsColumn ? '20%' : '28%'
  const tagsWidth = showNotesColumn ? '13%' : '18%'
  const payeeWidth = showNotesColumn || showTagsColumn ? '20%' : '24%'
  const categoryWidth = showNotesColumn || showTagsColumn ? '20%' : '24%'
  const activePayeeOptions = toEntityOptions(
    activePayees.map((payee) => ({
      id: payee.id as number,
      name: payee.name,
    })),
  )
  const activeCategoryOptions = toEntityOptions(
    activeCategories.map((category) => ({
      id: category.id as number,
      name: category.name,
    })),
  )

  const columns: ColumnDef<ExpenseDisplayRow>[] = [
    {
      id: 'select',
      header: () => (
        <div className="flex items-center justify-center">
          {renderSelectionCheckbox({
            checked: allSelected,
            onChange: onToggleSelectAll,
            ariaLabel: 'Select all',
            boxClassName: 'border-theme-muted bg-transparent',
          })}
        </div>
      ),
      cell: ({ row }) => {
        const rowData = row.original
        if (rowData.rowType === 'splitContainer') {
          const isSelected = isSplitParentSelected(rowData.splitId)
          return renderSelectionCheckbox({
            checked: isSelected,
            onChange: (e) => {
              e.stopPropagation()
              onToggleSplitParentSelect(rowData.splitId)
            },
            ariaLabel: 'Select split transaction',
            boxClassName: isSelected
              ? 'border-theme-text bg-transparent'
              : 'border-theme-muted bg-transparent',
          })
        }
        const exp = rowData.expense
        const isSelected = selectedIds.has(exp.id as number)
        return renderSelectionCheckbox({
          checked: isSelected,
          onChange: (e) => {
            e.stopPropagation()
            onToggleSelect(exp.id as number)
          },
          ariaLabel: `Select ${exp.notes || 'expense'}`,
          boxClassName: isSelected
            ? 'border-theme-text bg-transparent'
            : 'border-theme-muted bg-transparent',
        })
      },
      meta: {
        className: 'text-center w-10',
        cellClassName: 'text-center',
        width: '2.5rem',
      },
    },
    {
      id: 'date',
      header: () =>
        renderSortableHeader({
          label: 'Date',
          columnId: 'date',
          sort,
          onToggleSort,
        }),
      cell: ({ row }) => {
        const rowData = row.original
        if (rowData.rowType === 'splitChild') {
          return null
        }
        if (rowData.rowType === 'splitContainer') {
          const dateValue = rowData.split?.date ?? rowData.childExpenses[0]?.date
          const splitNavigationExpense = getSplitNavigationExpense(rowData)
          if (isSplitFieldEditing(editingSplitField, rowData.splitId, 'date')) {
            return renderDateEditor(
              dateValue ?? '',
              (iso) => onCommitSplitDateEdit(rowData.splitId, iso),
              onCancelSplitFieldEdit,
              (shiftKey) => {
                if (!splitNavigationExpense) {
                  onCancelSplitFieldEdit()
                  return
                }
                runEnterNavigation(splitNavigationExpense, 'date', shiftKey)
              },
              (shiftKey) => {
                if (!splitNavigationExpense) {
                  onCancelSplitFieldEdit()
                  return
                }
                runTabNavigation(splitNavigationExpense, 'date', shiftKey)
              },
            )
          }
          return renderEditableDisplayCell(
            {
              className: dateValue ? 'cursor-pointer' : 'text-theme-muted cursor-pointer',
              isSplitEditableDisplay: true,
              content: dateValue ? formatDate(dateValue) : '—',
            },
            (e) => {
              if (e.button !== 0) return
              e.preventDefault()
              e.stopPropagation()
              onStartSplitFieldEdit(rowData.splitId, 'date')
            },
          )
        }
        const exp = rowData.expense
        if (editing.isCellEditing(exp.id as number, 'date')) {
          return renderDateEditor(
            exp.date ?? '',
            (iso) => {
              editing.createOnCommit(exp.id as number, 'date')(iso)
            },
            editing.createOnCancel(),
            (shiftKey) => runEnterNavigation(exp, 'date', shiftKey),
            (shiftKey) => runTabNavigation(exp, 'date', shiftKey),
          )
        }
        return renderEditableDisplayCell(
          {
            className: 'cursor-pointer',
            isEditableCell: true,
            expenseId: exp.id as number,
            field: 'date',
            content: formatDate(exp.date),
          },
          editableCellActivate(editing, exp, 'date').onPointerDown,
        )
      },
      meta: {
        className: 'text-left',
        ariaSort: getColumnAriaSort(sort, 'date'),
        cellClassName: 'text-theme-text whitespace-nowrap overflow-hidden',
        onBodyCellPointerDown: (e, rowData) => {
          if (rowData.rowType === 'splitChild') return
          if (rowData.rowType === 'splitContainer') {
            activateFromPointerEvent(e, () => onStartSplitFieldEdit(rowData.splitId, 'date'))
            return
          }
          activateFromPointerEvent(e, () => editing.switchCellEdit(rowData.expense, 'date'))
        },
        getCellClassName: (rowData: ExpenseDisplayRow) =>
          cn(
            getEditableCellCursorClass(rowData, {
              allowExpense: true,
              allowSplitContainer: true,
            }),
            rowData.rowType === 'splitContainer'
              ? isSplitFieldEditing(editingSplitField, rowData.splitId, 'date')
                ? 'cell-editing'
                : ''
              : rowData.rowType === 'expense' &&
                  editing.isCellEditing(rowData.expense.id as number, 'date')
                ? 'cell-editing'
                : isReadOnlyActiveCell?.(rowData, 'date')
                  ? 'cell-editing'
                  : '',
          ),
        width: '6rem',
      },
    },
    {
      id: 'payee',
      header: () =>
        renderSortableHeader({
          label: 'Payee',
          columnId: 'payee',
          sort,
          onToggleSort,
        }),
      cell: ({ row }) => {
        const rowData = row.original
        if (rowData.rowType === 'splitContainer') {
          const splitPayeeLabel = getSplitPayeeLabel(rowData, payeeMap)
          const splitNavigationExpense = getSplitNavigationExpense(rowData)
          if (isSplitFieldEditing(editingSplitField, rowData.splitId, 'payeeId')) {
            return renderEntityEditor({
              value: rowData.split?.payeeId,
              options: activePayeeOptions,
              placeholder: 'Select payee…',
              createHint: 'Type a new payee name to add it.',
              autoOpen: true,
              onCommit: (payeeId) => onCommitSplitPayeeEdit(rowData.splitId, payeeId),
              onEnterSelect: (payeeId, shiftKey) => {
                onCommitSplitPayeeEdit(rowData.splitId, payeeId)
                if (!splitNavigationExpense) {
                  onCancelSplitFieldEdit()
                  return
                }
                runEnterNavigation(splitNavigationExpense, 'payeeId', shiftKey)
              },
              onTabSelect: (payeeId) => onCommitSplitPayeeEdit(rowData.splitId, payeeId),
              onCreate: (name) =>
                createEntityAndRefresh(
                  StorageService.addPayee,
                  'Failed to create payee',
                  name,
                  refreshPayees,
                ),
              onCancel: onCancelSplitFieldEdit,
              onTab: (shiftKey) => {
                if (!splitNavigationExpense) {
                  onCancelSplitFieldEdit()
                  return
                }
                runTabNavigation(splitNavigationExpense, 'payeeId', shiftKey)
              },
            })
          }
          return renderEditableDisplayCell(
            {
              className: 'block w-full cursor-pointer truncate font-medium text-theme-muted',
              isSplitEditableDisplay: true,
              title: splitPayeeLabel,
              content: splitPayeeLabel,
            },
            (e) => {
              if (e.button !== 0) return
              e.preventDefault()
              e.stopPropagation()
              onStartSplitFieldEdit(rowData.splitId, 'payeeId')
            },
          )
        }
        if (rowData.rowType === 'splitChild') {
          return null
        }
        const exp = rowData.expense
        if (editing.isCellEditing(exp.id as number, 'payeeId')) {
          return renderEntityEditor({
            value: exp.payeeId,
            options: activePayeeOptions,
            placeholder: 'Select payee…',
            createHint: 'Type a new payee name to add it.',
            autoOpen: editing.shouldAutoOpenEditor(exp.id as number, 'payeeId'),
            onCommit: (payeeId) => {
              editing.createOnCommit(exp.id as number, 'payeeId', {
                stayInEdit: true,
              })(payeeId)
            },
            onEnterSelect: (payeeId, shiftKey) => {
              editing.createOnCommit(exp.id as number, 'payeeId')(payeeId)
              runEnterNavigation(exp, 'payeeId', shiftKey)
            },
            onTabSelect: (payeeId) => {
              editing.createOnCommit(exp.id as number, 'payeeId')(payeeId)
            },
            onCreate: (name) =>
              createEntityAndRefresh(
                StorageService.addPayee,
                'Failed to create payee',
                name,
                refreshPayees,
                (trimmedName) => {
                  editing.setPendingName(exp.id as number, 'payeeId', trimmedName)
                },
              ),
            onCancel: editing.createOnCancel(),
            onTab: (shiftKey) => runTabNavigation(exp, 'payeeId', shiftKey),
          })
        }
        return renderEditableDisplayCell(
          {
            className: cn(
              'cursor-pointer block w-full truncate',
              payeeMap[exp.payeeId as number]?.isArchived
                ? 'text-theme-muted italic'
                : 'text-theme-text font-medium',
            ),
            title:
              exp.payeeId && payeeMap[exp.payeeId as number]
                ? payeeMap[exp.payeeId as number].name
                : undefined,
            isEditableCell: true,
            expenseId: exp.id as number,
            field: 'payeeId',
            content:
              exp.payeeId && payeeMap[exp.payeeId as number]
                ? payeeMap[exp.payeeId as number].name
                : exp.payeeId
                  ? (editing.getPendingName(exp.id as number, 'payeeId') ?? 'No payee')
                  : 'No payee',
          },
          editableCellActivate(editing, exp, 'payeeId').onPointerDown,
        )
      },
      meta: {
        className: 'text-left hidden sm:table-cell',
        ariaSort: getColumnAriaSort(sort, 'payee'),
        cellClassName: 'whitespace-nowrap overflow-hidden max-w-[12rem]',
        onBodyCellPointerDown: (e, rowData) => {
          if (rowData.rowType === 'splitChild') return
          if (rowData.rowType === 'splitContainer') {
            activateFromPointerEvent(e, () => onStartSplitFieldEdit(rowData.splitId, 'payeeId'))
            return
          }
          activateFromPointerEvent(e, () => editing.switchCellEdit(rowData.expense, 'payeeId'))
        },
        getCellClassName: (rowData: ExpenseDisplayRow) =>
          cn(
            getEditableCellCursorClass(rowData, {
              allowExpense: true,
              allowSplitContainer: true,
            }),
            rowData.rowType === 'splitContainer'
              ? isSplitFieldEditing(editingSplitField, rowData.splitId, 'payeeId')
                ? 'cell-editing'
                : ''
              : rowData.rowType === 'splitChild'
                ? isReadOnlyActiveCell?.(rowData, 'payeeId')
                  ? 'cell-editing'
                  : ''
                : editing.isCellEditing(rowData.expense.id as number, 'payeeId')
                  ? 'cell-editing'
                  : '',
          ),
        width: payeeWidth,
      },
    },
    {
      id: 'category',
      header: () =>
        renderSortableHeader({
          label: 'Category',
          columnId: 'category',
          sort,
          onToggleSort,
        }),
      cell: ({ row }) => {
        const rowData = row.original
        if (rowData.rowType === 'splitContainer') {
          const expanded = isSplitExpanded(rowData.splitId)
          return (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 font-medium text-theme-muted"
              onClick={() => onToggleSplitExpanded(rowData.splitId)}
              aria-expanded={expanded}
            >
              <span className="text-theme-muted">{expanded ? '▾' : '▸'}</span>
              <span>Split</span>
            </button>
          )
        }
        const exp = rowData.expense
        if (editing.isCellEditing(exp.id as number, 'categoryId')) {
          return renderEntityEditor({
            value: exp.categoryId,
            options: activeCategoryOptions,
            placeholder: 'Select category…',
            createHint: 'Type a new category name to add it.',
            autoOpen: editing.shouldAutoOpenEditor(exp.id as number, 'categoryId'),
            onCommit: (categoryId) => {
              editing.createOnCommit(exp.id as number, 'categoryId', {
                stayInEdit: true,
              })(categoryId)
            },
            onEnterSelect: (categoryId, shiftKey) => {
              editing.createOnCommit(exp.id as number, 'categoryId')(categoryId)
              runEnterNavigation(exp, 'categoryId', shiftKey)
            },
            onTabSelect: (categoryId) => {
              editing.createOnCommit(exp.id as number, 'categoryId')(categoryId)
            },
            onCreate: (name) =>
              createEntityAndRefresh(
                StorageService.addCategory,
                'Failed to create category',
                name,
                refreshCategories,
                (trimmedName) => {
                  editing.setPendingName(exp.id as number, 'categoryId', trimmedName)
                },
              ),
            onCancel: editing.createOnCancel(),
            onTab: (shiftKey) => runTabNavigation(exp, 'categoryId', shiftKey),
          })
        }
        const activeCategory = catMap[exp.categoryId as number]
        const categoryLabel = activeCategory
          ? activeCategory.isArchived
            ? `${activeCategory.name} (deleted)`
            : activeCategory.name
          : (editing.getPendingName(exp.id as number, 'categoryId') ?? 'No category')
        return renderEditableDisplayCell(
          {
            className: cn(
              'cursor-pointer',
              activeCategory?.isArchived
                ? 'text-theme-muted italic'
                : 'text-theme-text font-medium',
            ),
            title: categoryLabel,
            isEditableCell: true,
            expenseId: exp.id as number,
            field: 'categoryId',
            content: categoryLabel,
          },
          editableCellActivate(editing, exp, 'categoryId').onPointerDown,
        )
      },
      meta: {
        className: 'text-left',
        ariaSort: getColumnAriaSort(sort, 'category'),
        cellClassName: 'whitespace-nowrap overflow-hidden',
        onBodyCellPointerDown: (e, rowData) => {
          if (rowData.rowType === 'splitContainer') return
          activateFromPointerEvent(e, () => editing.switchCellEdit(rowData.expense, 'categoryId'))
        },
        getCellClassName: (rowData: ExpenseDisplayRow) =>
          cn(
            getEditableCellCursorClass(rowData, {
              allowExpense: true,
              allowSplitChild: true,
            }),
            rowData.rowType === 'splitContainer'
              ? isReadOnlyActiveCell?.(rowData, 'categoryId')
                ? 'cell-editing'
                : ''
              : editing.isCellEditing(rowData.expense.id as number, 'categoryId')
                ? 'cell-editing'
                : '',
          ),
        width: categoryWidth,
      },
    },
  ]

  if (showNotesColumn) {
    columns.push({
      id: 'notes',
      header: () =>
        renderSortableHeader({
          label: 'Notes',
          columnId: 'notes',
          sort,
          onToggleSort,
        }),
      cell: ({ row }) => {
        const rowData = row.original
        if (rowData.rowType === 'splitContainer') {
          const notesValue = rowData.split?.notes ?? ''
          const splitNavigationExpense = getSplitNavigationExpense(rowData)
          if (isSplitFieldEditing(editingSplitField, rowData.splitId, 'notes')) {
            return renderNotesEditor(
              notesValue,
              (value) => onCommitSplitNotesEdit(rowData.splitId, value),
              onCancelSplitFieldEdit,
              (shiftKey) => {
                if (!splitNavigationExpense) {
                  onCancelSplitFieldEdit()
                  return
                }
                runEnterNavigation(splitNavigationExpense, 'notes', shiftKey)
              },
              (shiftKey) => {
                if (!splitNavigationExpense) {
                  onCancelSplitFieldEdit()
                  return
                }
                runTabNavigation(splitNavigationExpense, 'notes', shiftKey)
              },
            )
          }
          return renderEditableDisplayCell(
            {
              className: 'block min-h-[1.25rem] w-full cursor-pointer truncate text-theme-muted',
              field: 'notes',
              isSplitEditableDisplay: true,
              title: notesValue || undefined,
              content: notesValue,
            },
            (e) => {
              if (e.button !== 0) return
              e.preventDefault()
              e.stopPropagation()
              onStartSplitFieldEdit(rowData.splitId, 'notes')
            },
          )
        }
        const exp = rowData.expense
        if (editing.isCellEditing(exp.id as number, 'notes')) {
          return renderNotesEditor(
            exp.notes ?? '',
            editing.createOnCommit(exp.id as number, 'notes'),
            editing.createOnCancel(),
            (shiftKey) => runEnterNavigation(exp, 'notes', shiftKey),
            (shiftKey) => runTabNavigation(exp, 'notes', shiftKey),
          )
        }
        return renderEditableDisplayCell(
          {
            className: 'block min-h-[1.25rem] w-full cursor-pointer truncate',
            title: exp.notes || undefined,
            isEditableCell: true,
            expenseId: exp.id as number,
            field: 'notes',
            content: exp.notes ?? '',
          },
          editableCellActivate(editing, exp, 'notes').onPointerDown,
        )
      },
      meta: {
        className: 'text-left',
        ariaSort: getColumnAriaSort(sort, 'notes'),
        cellClassName: 'text-theme-text overflow-hidden max-w-[14rem]',
        onBodyCellPointerDown: (e, rowData) => {
          if (rowData.rowType === 'splitContainer') {
            activateFromPointerEvent(e, () => onStartSplitFieldEdit(rowData.splitId, 'notes'))
            return
          }
          activateFromPointerEvent(e, () => editing.switchCellEdit(rowData.expense, 'notes'))
        },
        getCellClassName: (rowData: ExpenseDisplayRow) =>
          cn(
            getEditableCellCursorClass(rowData, {
              allowExpense: true,
              allowSplitContainer: true,
            }),
            rowData.rowType === 'splitContainer'
              ? isSplitFieldEditing(editingSplitField, rowData.splitId, 'notes')
                ? 'cell-editing'
                : ''
              : editing.isCellEditing(rowData.expense.id as number, 'notes')
                ? 'cell-editing'
                : isReadOnlyActiveCell?.(rowData, 'notes')
                  ? 'cell-editing'
                  : '',
          ),
        width: notesWidth,
      },
    })
  }

  if (showTagsColumn) {
    columns.push({
      id: 'tags',
      header: () =>
        renderSortableHeader({
          label: 'Tags',
          columnId: 'tags',
          sort,
          onToggleSort,
        }),
      cell: ({ row }) => {
        const rowData = row.original

        if (rowData.rowType === 'splitContainer') {
          const splitTags = getSplitContainerTags(rowData, expenseTagsMap)
          const splitSummary = getTagSummaryData(splitTags)
          return renderEditableDisplayCell(
            {
              className: 'flex min-h-[1.25rem] w-full items-center overflow-hidden text-xs',
              field: 'tags',
              title: splitSummary.summary || undefined,
              content: renderTagSummaryChip(splitSummary),
            },
            () => {},
          )
        }

        const exp = rowData.expense
        const expenseTags = typeof exp.id === 'number' ? (expenseTagsMap[exp.id] ?? []) : []
        const expenseSummary = getTagSummaryData(expenseTags)
        return renderEditableDisplayCell(
          {
            className:
              'flex min-h-[1.25rem] w-full cursor-pointer items-center overflow-hidden text-xs',
            field: 'tags',
            title: expenseSummary.summary || undefined,
            isEditableCell: true,
            expenseId: exp.id as number,
            content: renderTagSummaryChip(expenseSummary),
          },
          (e) => {
            if (typeof e.button === 'number' && e.button !== 0) return
            e.preventDefault()
            e.stopPropagation()
            if (e.target instanceof Element && e.target.closest('[data-no-cell-switch]')) return
            editing.switchCellEdit(exp, 'tags')
          },
        )
      },
      meta: {
        className: 'text-left',
        ariaSort: getColumnAriaSort(sort, 'tags'),
        cellClassName: 'whitespace-nowrap overflow-hidden max-w-[10rem]',
        onBodyCellPointerDown: (e, rowData) => {
          if (rowData.rowType === 'splitContainer') return
          activateFromPointerEvent(e, () => editing.switchCellEdit(rowData.expense, 'tags'))
        },
        getCellClassName: (rowData: ExpenseDisplayRow) =>
          cn(
            getEditableCellCursorClass(rowData, {
              allowExpense: true,
              allowSplitChild: true,
            }),
            rowData.rowType === 'splitContainer'
              ? isReadOnlyActiveCell?.(rowData, 'tags')
                ? 'cell-editing'
                : ''
              : editing.isCellEditing(rowData.expense.id as number, 'tags')
                ? 'cell-editing'
                : '',
          ),
        width: tagsWidth,
      },
    })
  }

  columns.push({
    id: 'amount',
    header: () =>
      renderSortableHeader({
        label: 'Amount',
        columnId: 'amount',
        sort,
        onToggleSort,
        align: 'right',
      }),
    cell: ({ row }) => {
      const rowData = row.original
      if (rowData.rowType === 'splitContainer') {
        const splitAmount = rowData.split?.amount ?? rowData.amountDisplay ?? 0
        const splitNavigationExpense = getSplitNavigationExpense(rowData)
        if (
          editingSplitAmount?.splitId === rowData.splitId &&
          typeof editingSplitAmount.expenseId !== 'number'
        ) {
          return (
            <InlineMoneyEditCell
              initialValue={splitAmount}
              onCommit={(value) => onCommitSplitContainerAmountEdit(rowData.splitId, value)}
              onCancel={onCancelSplitAmountEdit}
              onEnter={(shiftKey) => {
                if (!splitNavigationExpense) {
                  onCancelSplitAmountEdit()
                  return
                }
                runEnterNavigation(splitNavigationExpense, 'amount', shiftKey)
              }}
              onTab={(shiftKey) => {
                if (!splitNavigationExpense) {
                  onCancelSplitAmountEdit()
                  return
                }
                runTabNavigation(splitNavigationExpense, 'amount', shiftKey)
              }}
            />
          )
        }
        return renderEditableDisplayCell(
          {
            className: 'cursor-pointer text-theme-text',
            splitAmountAnchor: `split-container-${rowData.splitId}`,
            field: 'amount',
            isSplitEditableDisplay: true,
            content: formatAmount(splitAmount),
          },
          (e) => {
            if (e.button !== 0) return
            e.preventDefault()
            e.stopPropagation()
            onStartSplitContainerAmountEdit(rowData.splitId)
          },
        )
      }
      const exp = rowData.expense
      if (rowData.rowType === 'splitChild') {
        const splitChildAmount =
          pendingSplitAmountEdit?.kind === 'splitChild' &&
          pendingSplitAmountEdit.splitId === rowData.splitId &&
          pendingSplitAmountEdit.editedExpenseId === (exp.id as number)
            ? pendingSplitAmountEdit.draftAmount
            : (exp.amount ?? 0)
        if (
          editingSplitAmount?.splitId === rowData.splitId &&
          editingSplitAmount.expenseId === (exp.id as number)
        ) {
          return (
            <InlineMoneyEditCell
              initialValue={splitChildAmount}
              onCommit={(value) =>
                onCommitSplitChildAmountEdit(rowData.splitId, exp.id as number, value)
              }
              onCancel={onCancelSplitAmountEdit}
              onEnter={(shiftKey) => runEnterNavigation(exp, 'amount', shiftKey)}
              onTab={(shiftKey) => runTabNavigation(exp, 'amount', shiftKey)}
            />
          )
        }
        return renderEditableDisplayCell(
          {
            className: 'cursor-pointer text-theme-text',
            splitAmountAnchor: `split-child-${exp.id as number}`,
            field: 'amount',
            isSplitEditableDisplay: true,
            content: formatAmount(splitChildAmount),
          },
          (e) => {
            if (e.button !== 0) return
            e.preventDefault()
            e.stopPropagation()
            onStartSplitChildAmountEdit(rowData.splitId, exp.id as number)
          },
        )
      }
      if (editing.isCellEditing(exp.id as number, 'amount')) {
        return (
          <InlineMoneyEditCell
            initialValue={exp.amount ?? 0}
            onCommit={(value) => {
              editing.createOnCommit(exp.id as number, 'amount')(value)
            }}
            onCancel={editing.createOnCancel()}
            onEnter={(shiftKey) => runEnterNavigation(exp, 'amount', shiftKey)}
            onTab={(shiftKey) => runTabNavigation(exp, 'amount', shiftKey)}
          />
        )
      }
      return renderEditableDisplayCell(
        {
          className: 'cursor-pointer text-theme-text',
          isEditableCell: true,
          expenseId: exp.id as number,
          field: 'amount',
          content: formatAmount(exp.amount ?? 0),
        },
        editableCellActivate(editing, exp, 'amount').onPointerDown,
      )
    },
    meta: {
      className: 'text-right tabular-nums',
      ariaSort: getColumnAriaSort(sort, 'amount'),
      cellClassName: 'text-right tabular-nums font-semibold whitespace-nowrap',
      onBodyCellPointerDown: (e, rowData) => {
        if (rowData.rowType === 'splitContainer') {
          activateFromPointerEvent(e, () => onStartSplitContainerAmountEdit(rowData.splitId))
          return
        }
        if (rowData.rowType === 'splitChild') {
          activateFromPointerEvent(e, () =>
            onStartSplitChildAmountEdit(rowData.splitId, rowData.expense.id as number),
          )
          return
        }
        activateFromPointerEvent(e, () => editing.switchCellEdit(rowData.expense, 'amount'))
      },
      getCellClassName: (rowData: ExpenseDisplayRow) =>
        cn(
          getEditableCellCursorClass(rowData, {
            allowExpense: true,
            allowSplitContainer: true,
            allowSplitChild: true,
          }),
          rowData.rowType === 'splitContainer'
            ? editingSplitAmount?.splitId === rowData.splitId &&
              typeof editingSplitAmount.expenseId !== 'number'
              ? 'cell-editing'
              : ''
            : rowData.rowType === 'splitChild'
              ? editingSplitAmount?.splitId === rowData.splitId &&
                editingSplitAmount.expenseId === (rowData.expense.id as number)
                ? 'cell-editing'
                : ''
              : editing.isCellEditing(rowData.expense.id as number, 'amount')
                ? 'cell-editing'
                : '',
        ),
      width: '14ch',
    },
  })

  return columns
}
