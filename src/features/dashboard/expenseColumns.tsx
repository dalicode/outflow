import type { ColumnDef } from '@tanstack/react-table'
import CreatableCombobox from '../../components/inputs/CreatableCombobox'
import DatePicker from '../../components/inputs/DatePicker'
import { StorageService } from '../../services/storageService'
import type { Category, Expense, Payee } from '../../types'
import { cn } from '../../utils/cn'
import InlineEditCell from './InlineEditCell'
import InlineMoneyEditCell from './InlineMoneyEditCell'
import type { ExpenseDisplayRow } from './splitDisplayRows'
import type { CellEditingAPI } from './useExpenseCellEditing'

type EditableSplitField = 'date' | 'payeeId' | 'notes'

interface GetExpenseColumnsParams {
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  allSelected: boolean
  editing: CellEditingAPI
  formatDate: (iso: string) => string
  formatAmount: (n: number) => string
  catMap: Record<number, Category>
  activeCategories: Category[]
  activePayees: Payee[]
  payeeMap: Record<number, Payee>
  onToggleSplitExpanded: (splitId: number) => void
  isSplitExpanded: (splitId: number) => boolean
  editingSplitField?: { splitId: number; field: EditableSplitField } | null
  onStartSplitFieldEdit: (splitId: number, field: EditableSplitField) => void
  onCommitSplitDateEdit: (splitId: number, value: string) => void
  onCommitSplitPayeeEdit: (splitId: number, payeeId: number | undefined) => void
  onCommitSplitNotesEdit: (splitId: number, value: string) => void
  onCancelSplitFieldEdit: () => void
  refreshCategories?: () => Promise<void>
  refreshPayees?: () => Promise<void>
}

interface EditableCellDisplayConfig {
  className: string
  title?: string
  content: React.ReactNode
  expenseId?: number
  field?: string
  isEditableCell?: boolean
}

interface PayeeEditorConfig {
  value: number | undefined
  options: Array<{ id: number; label: string }>
  autoOpen: boolean
  onCommit: (payeeId: number | undefined) => void
  onEnterSelect: (payeeId: number | undefined, shiftKey: boolean) => void
  onTabSelect: (payeeId: number | undefined) => void
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

export function editableCellActivate(
  editing: CellEditingAPI,
  expense: Expense,
  field: Parameters<CellEditingAPI['switchCellEdit']>[1],
) {
  const activate = () => {
    editing.switchCellEdit(expense, field)
  }
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      if (e.target instanceof Element && e.target.closest('[data-no-cell-switch]')) return
      activate()
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
      data-expense-id={display.expenseId}
      data-field={display.field}
      data-testid={display.field ? `editable-cell-display-${display.field}` : undefined}
      className={display.className}
      title={display.title}
      onPointerDown={onActivate}
    >
      {display.content}
    </span>
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

function renderPayeeEditor(config: PayeeEditorConfig): React.ReactNode {
  return (
    <div className="w-full" data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
      <CreatableCombobox
        value={config.value}
        variant="inline"
        options={config.options}
        placeholder="Select payee…"
        createHint="Type a new payee name to add it."
        allowCreate
        autoOpen={config.autoOpen}
        autoFocus
        onChange={(id) => {
          const numId = id != null ? Number(id) : undefined
          config.onCommit(numId)
        }}
        onEnterSelect={(id, shiftKey) => {
          const numId = id != null ? Number(id) : undefined
          config.onEnterSelect(numId, shiftKey)
        }}
        onTabSelect={(id) => {
          const numId = id != null ? Number(id) : undefined
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
  allSelected,
  editing,
  formatDate,
  formatAmount,
  catMap,
  activeCategories,
  activePayees,
  payeeMap,
  onToggleSplitExpanded,
  isSplitExpanded,
  editingSplitField,
  onStartSplitFieldEdit,
  onCommitSplitDateEdit,
  onCommitSplitPayeeEdit,
  onCommitSplitNotesEdit,
  onCancelSplitFieldEdit,
  refreshCategories,
  refreshPayees,
}: GetExpenseColumnsParams): ColumnDef<ExpenseDisplayRow>[] {
  return [
    {
      id: 'select',
      header: () => (
        <div className="flex items-center justify-center">
          <label
            className={cn('expense-checkbox-wrapper cursor-pointer', allSelected && 'checked')}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              className="sr-only"
              aria-label="Select all"
            />
            <div
              className={cn(
                'expense-checkbox-box w-3.5 h-3.5 rounded-theme-small border transition-colors flex items-center justify-center',
                'border-theme-muted bg-transparent',
              )}
            >
              {allSelected && (
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
        </div>
      ),
      cell: ({ row }) => {
        const rowData = row.original
        if (rowData.rowType === 'splitContainer') {
          return null
        }
        const exp = rowData.expense
        const isSelected = selectedIds.has(exp.id as number)
        return (
          <label className={cn('expense-checkbox-wrapper cursor-pointer', isSelected && 'checked')}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation()
                onToggleSelect(exp.id as number)
              }}
              className="sr-only"
              aria-label={`Select ${exp.notes || 'expense'}`}
            />
            <div
              className={cn(
                'expense-checkbox-box w-3.5 h-3.5 rounded-theme-small border transition-colors flex items-center justify-center',
                isSelected
                  ? 'border-theme-text bg-transparent'
                  : 'border-theme-text bg-theme-primary-subtle',
              )}
            >
              {isSelected && (
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
      },
      meta: {
        className: 'text-center w-10',
        cellClassName: 'text-center',
        width: '2.5rem',
      },
    },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => {
        const rowData = row.original
        if (rowData.rowType === 'splitChild') {
          return null
        }
        if (rowData.rowType === 'splitContainer') {
          const dateValue = rowData.split?.date ?? rowData.childExpenses[0]?.date
          if (isSplitFieldEditing(editingSplitField, rowData.splitId, 'date')) {
            return renderDateEditor(
              dateValue ?? '',
              (iso) => onCommitSplitDateEdit(rowData.splitId, iso),
              onCancelSplitFieldEdit,
              () => onCancelSplitFieldEdit(),
              () => onCancelSplitFieldEdit(),
            )
          }
          return renderEditableDisplayCell(
            {
              className: dateValue ? 'cursor-pointer' : 'text-theme-muted cursor-pointer',
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
            (shiftKey) => editing.handleEnterNavigation(exp, 'date', shiftKey),
            (shiftKey) => editing.handleTabNavigation(exp, 'date', shiftKey),
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
        cellClassName: 'text-theme-text whitespace-nowrap overflow-hidden',
        getCellClassName: (rowData: ExpenseDisplayRow) =>
          rowData.rowType === 'splitContainer'
            ? isSplitFieldEditing(editingSplitField, rowData.splitId, 'date')
              ? 'cell-editing'
              : ''
            : rowData.rowType === 'expense' &&
                editing.isCellEditing(rowData.expense.id as number, 'date')
              ? 'cell-editing'
              : '',
        width: '6rem',
      },
    },
    {
      id: 'payee',
      header: 'Payee',
      cell: ({ row }) => {
        const rowData = row.original
        if (rowData.rowType === 'splitContainer') {
          const splitPayeeLabel = getSplitPayeeLabel(rowData, payeeMap)
          if (isSplitFieldEditing(editingSplitField, rowData.splitId, 'payeeId')) {
            return renderPayeeEditor({
              value: rowData.split?.payeeId,
              options: activePayees.map((payee) => ({
                id: payee.id as number,
                label: payee.name,
              })),
              autoOpen: true,
              onCommit: (payeeId) => onCommitSplitPayeeEdit(rowData.splitId, payeeId),
              onEnterSelect: (payeeId) => onCommitSplitPayeeEdit(rowData.splitId, payeeId),
              onTabSelect: (payeeId) => onCommitSplitPayeeEdit(rowData.splitId, payeeId),
              onCreate: async (name) => {
                const newId = await StorageService.addPayee(name)
                if (newId == null) throw new Error('Failed to create payee')
                await refreshPayees?.()
                return newId as number
              },
              onCancel: onCancelSplitFieldEdit,
              onTab: () => onCancelSplitFieldEdit(),
            })
          }
          return renderEditableDisplayCell(
            {
              className: 'block w-full cursor-pointer truncate font-medium text-theme-muted',
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
          return renderPayeeEditor({
            value: exp.payeeId,
            options: activePayees.map((p) => ({
              id: p.id as number,
              label: p.name,
            })),
            autoOpen: editing.shouldAutoOpenEditor(exp.id as number, 'payeeId'),
            onCommit: (payeeId) => {
              editing.createOnCommit(exp.id as number, 'payeeId', {
                stayInEdit: true,
              })(payeeId)
            },
            onEnterSelect: (payeeId, shiftKey) => {
              editing.createOnCommit(exp.id as number, 'payeeId')(payeeId)
              editing.handleEnterNavigation(exp, 'payeeId', shiftKey)
            },
            onTabSelect: (payeeId) => {
              editing.createOnCommit(exp.id as number, 'payeeId')(payeeId)
            },
            onCreate: async (name) => {
              const newId = await StorageService.addPayee(name)
              if (newId == null) throw new Error('Failed to create payee')
              editing.setPendingName(exp.id as number, 'payeeId', name.trim())
              await refreshPayees?.()
              return newId as number
            },
            onCancel: editing.createOnCancel(),
            onTab: (shiftKey) => editing.handleTabNavigation(exp, 'payeeId', shiftKey),
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
        cellClassName: 'whitespace-nowrap overflow-hidden max-w-[12rem]',
        getCellClassName: (rowData: ExpenseDisplayRow) =>
          rowData.rowType === 'splitContainer'
            ? isSplitFieldEditing(editingSplitField, rowData.splitId, 'payeeId')
              ? 'cell-editing'
              : ''
            : rowData.rowType === 'splitChild'
              ? ''
              : editing.isCellEditing(rowData.expense.id as number, 'payeeId')
                ? 'cell-editing'
                : '',
        width: '18%',
      },
    },
    {
      id: 'category',
      header: 'Category',
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
          return (
            <div className="w-full" data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
              <CreatableCombobox
                value={exp.categoryId}
                variant="inline"
                options={activeCategories.map((c) => ({
                  id: c.id as number,
                  label: c.name,
                }))}
                placeholder="Select category…"
                createHint="Type a new category name to add it."
                allowCreate
                autoOpen={editing.shouldAutoOpenEditor(exp.id as number, 'categoryId')}
                autoFocus
                onChange={(id) => {
                  const numId = id != null ? Number(id) : undefined
                  editing.createOnCommit(exp.id as number, 'categoryId', {
                    stayInEdit: true,
                  })(numId)
                }}
                onEnterSelect={(id, shiftKey) => {
                  const numId = id != null ? Number(id) : undefined
                  editing.createOnCommit(exp.id as number, 'categoryId')(numId)
                  editing.handleEnterNavigation(exp, 'categoryId', shiftKey)
                }}
                onTabSelect={(id) => {
                  const numId = id != null ? Number(id) : undefined
                  editing.createOnCommit(exp.id as number, 'categoryId')(numId)
                }}
                onCreate={async (name) => {
                  const newId = await StorageService.addCategory(name)
                  if (newId == null) throw new Error('Failed to create category')
                  editing.setPendingName(exp.id as number, 'categoryId', name.trim())
                  await refreshCategories?.()
                  return newId as number
                }}
                onCancel={editing.createOnCancel()}
                onTab={(shiftKey) => editing.handleTabNavigation(exp, 'categoryId', shiftKey)}
              />
            </div>
          )
        }
        return (
          <span
            data-editable-cell
            data-expense-id={exp.id}
            data-field="categoryId"
            {...editableCellActivate(editing, exp, 'categoryId')}
            className={cn(
              'cursor-pointer',
              catMap[exp.categoryId as number]?.isArchived
                ? 'text-theme-muted italic'
                : 'text-theme-text font-medium',
            )}
          >
            {catMap[exp.categoryId as number]
              ? catMap[exp.categoryId as number].isArchived
                ? `${catMap[exp.categoryId as number].name} (deleted)`
                : catMap[exp.categoryId as number].name
              : (editing.getPendingName(exp.id as number, 'categoryId') ?? 'No category')}
          </span>
        )
      },
      meta: {
        className: 'text-left',
        cellClassName: 'whitespace-nowrap overflow-hidden',
        getCellClassName: (rowData: ExpenseDisplayRow) =>
          rowData.rowType !== 'splitContainer' &&
          editing.isCellEditing(rowData.expense.id as number, 'categoryId')
            ? 'cell-editing'
            : '',
        width: '18%',
      },
    },
    {
      id: 'notes',
      header: 'Notes',
      cell: ({ row }) => {
        const rowData = row.original
        if (rowData.rowType === 'splitContainer') {
          const notesValue = rowData.split?.notes ?? ''
          if (isSplitFieldEditing(editingSplitField, rowData.splitId, 'notes')) {
            return renderNotesEditor(
              notesValue,
              (value) => onCommitSplitNotesEdit(rowData.splitId, value),
              onCancelSplitFieldEdit,
              () => onCancelSplitFieldEdit(),
              () => onCancelSplitFieldEdit(),
            )
          }
          return renderEditableDisplayCell(
            {
              className: 'block w-full cursor-pointer truncate text-theme-muted',
              field: 'notes',
              title: notesValue || undefined,
              content: notesValue || <span className="text-theme-muted">—</span>,
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
            (shiftKey) => editing.handleEnterNavigation(exp, 'notes', shiftKey),
            (shiftKey) => editing.handleTabNavigation(exp, 'notes', shiftKey),
          )
        }
        return renderEditableDisplayCell(
          {
            className: 'cursor-pointer block w-full truncate',
            title: exp.notes || undefined,
            isEditableCell: true,
            expenseId: exp.id as number,
            field: 'notes',
            content: exp.notes || <span className="text-theme-muted">—</span>,
          },
          editableCellActivate(editing, exp, 'notes').onPointerDown,
        )
      },
      meta: {
        className: 'text-left',
        cellClassName: 'text-theme-text overflow-hidden max-w-[14rem]',
        getCellClassName: (rowData: ExpenseDisplayRow) =>
          rowData.rowType === 'splitContainer'
            ? isSplitFieldEditing(editingSplitField, rowData.splitId, 'notes')
              ? 'cell-editing'
              : ''
            : editing.isCellEditing(rowData.expense.id as number, 'notes')
              ? 'cell-editing'
              : '',
        width: '28%',
      },
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }) => {
        const rowData = row.original
        if (rowData.rowType === 'splitContainer') {
          return <span className="text-theme-text">{formatAmount(rowData.amountDisplay ?? 0)}</span>
        }
        const exp = rowData.expense
        if (rowData.rowType === 'splitChild') {
          return (
            <span
              data-editable-cell
              data-expense-id={exp.id}
              data-field="amount"
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                e.stopPropagation()
                editing.startCellEdit(exp, 'amount')
              }}
              className="cursor-pointer text-theme-text"
            >
              {formatAmount(exp.amount ?? 0)}
            </span>
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
              onEnter={(shiftKey) => editing.handleEnterNavigation(exp, 'amount', shiftKey)}
              onTab={(shiftKey) => editing.handleTabNavigation(exp, 'amount', shiftKey)}
            />
          )
        }
        return (
          <span
            data-editable-cell
            data-expense-id={exp.id}
            data-field="amount"
            {...editableCellActivate(editing, exp, 'amount')}
            className="cursor-pointer text-theme-text"
          >
            {formatAmount(exp.amount ?? 0)}
          </span>
        )
      },
      meta: {
        className: 'text-right tabular-nums',
        cellClassName: 'text-right tabular-nums font-semibold whitespace-nowrap',
        getCellClassName: (rowData: ExpenseDisplayRow) =>
          rowData.rowType !== 'splitContainer' &&
          editing.isCellEditing(rowData.expense.id as number, 'amount')
            ? 'cell-editing'
            : '',
        width: '12ch',
      },
    },
  ]
}
