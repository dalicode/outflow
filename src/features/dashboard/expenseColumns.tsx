import type { ColumnDef } from '@tanstack/react-table'
import CreatableCombobox from '../../components/inputs/CreatableCombobox'
import DatePicker from '../../components/inputs/DatePicker'
import { StorageService } from '../../services/storageService'
import type { Category, Expense, Payee } from '../../types'
import { cn } from '../../utils/cn'
import InlineEditCell from './InlineEditCell'
import InlineMoneyEditCell from './InlineMoneyEditCell'
import type { CellEditingAPI } from './useExpenseCellEditing'

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
  refreshCategories?: () => Promise<void>
  refreshPayees?: () => Promise<void>
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
  refreshCategories,
  refreshPayees,
}: GetExpenseColumnsParams): ColumnDef<Expense>[] {
  return [
    {
      id: 'select',
      header: () => (
        <label className={cn('expense-checkbox-wrapper cursor-pointer', allSelected && 'checked')}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            className="sr-only"
            aria-label="Select all"
          />
          <div
            className={cn(
              'w-3.5 h-3.5 rounded-theme-small border transition-colors flex items-center justify-center',
              allSelected ? 'border-theme-text bg-transparent' : 'border-theme-text bg-transparent',
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
      ),
      cell: ({ row }) => {
        const exp = row.original
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
              aria-label={`Select ${exp.description || 'expense'}`}
            />
            <div
              className={cn(
                'w-3.5 h-3.5 rounded-theme-small border transition-colors flex items-center justify-center',
                isSelected
                  ? 'border-theme-text bg-transparent'
                  : 'border-theme-text bg-transparent',
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
        const exp = row.original
        if (editing.isCellEditing(exp.id as number, 'date')) {
          return (
            <div data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
              <DatePicker
                value={exp.date ?? ''}
                variant="inline"
                autoOpen
                onChange={(iso) => {
                  editing.createOnCommit(exp.id as number, 'date')(iso)
                }}
                onCancel={editing.createOnCancel()}
                onTab={(shiftKey) => editing.handleTabNavigation(exp, 'date', shiftKey)}
              />
            </div>
          )
        }
        return (
          <span
            data-editable-cell
            data-expense-id={exp.id}
            data-field="date"
            {...editableCellActivate(editing, exp, 'date')}
            className="cursor-pointer"
          >
            {formatDate(exp.date)}
          </span>
        )
      },
      meta: {
        className: 'text-left',
        cellClassName: 'text-theme-text whitespace-nowrap overflow-hidden',
        getCellClassName: (exp: Expense) =>
          editing.isCellEditing(exp.id as number, 'date') ? 'cell-editing' : '',
        width: '6rem',
      },
    },
    {
      id: 'payee',
      header: 'Payee',
      cell: ({ row }) => {
        const exp = row.original
        if (editing.isCellEditing(exp.id as number, 'payeeId')) {
          return (
            <div data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
              <CreatableCombobox
                value={exp.payeeId}
                variant="inline"
                options={activePayees.map((p) => ({
                  id: p.id as number,
                  label: p.name,
                }))}
                placeholder="Select payee…"
                createHint="Type a new payee name to add it."
                allowCreate
                autoOpen={editing.shouldAutoOpenEditor(exp.id as number, 'payeeId')}
                autoFocus
                onChange={(id) => {
                  const numId = id != null ? Number(id) : undefined
                  editing.createOnCommit(exp.id as number, 'payeeId', {
                    stayInEdit: true,
                  })(numId)
                }}
                onCreate={async (name) => {
                  const newId = await StorageService.addPayee(name)
                  if (newId == null) throw new Error('Failed to create payee')
                  editing.setPendingName(exp.id as number, 'payeeId', name.trim())
                  await refreshPayees?.()
                  return newId as number
                }}
                onCancel={editing.createOnCancel()}
                onTab={(shiftKey) => editing.handleTabNavigation(exp, 'payeeId', shiftKey)}
              />
            </div>
          )
        }
        return (
          <span
            data-editable-cell
            data-expense-id={exp.id}
            data-field="payeeId"
            {...editableCellActivate(editing, exp, 'payeeId')}
            className={cn(
              'cursor-pointer block w-full truncate',
              payeeMap[exp.payeeId as number]?.isArchived
                ? 'text-theme-muted italic'
                : 'text-theme-text font-medium',
            )}
            title={
              exp.payeeId && payeeMap[exp.payeeId as number]
                ? payeeMap[exp.payeeId as number].name
                : undefined
            }
          >
            {exp.payeeId && payeeMap[exp.payeeId as number]
              ? payeeMap[exp.payeeId as number].name
              : exp.payeeId
                ? (editing.getPendingName(exp.id as number, 'payeeId') ?? '—')
                : '—'}
          </span>
        )
      },
      meta: {
        className: 'text-left hidden sm:table-cell',
        cellClassName: 'whitespace-nowrap overflow-hidden max-w-[12rem]',
        getCellClassName: (exp: Expense) =>
          editing.isCellEditing(exp.id as number, 'payeeId') ? 'cell-editing' : '',
        width: '18%',
      },
    },
    {
      id: 'category',
      header: 'Category',
      cell: ({ row }) => {
        const exp = row.original
        if (editing.isCellEditing(exp.id as number, 'categoryId')) {
          return (
            <div data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
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
              : (editing.getPendingName(exp.id as number, 'categoryId') ?? 'Uncategorized')}
          </span>
        )
      },
      meta: {
        className: 'text-left',
        cellClassName: 'whitespace-nowrap overflow-hidden',
        getCellClassName: (exp: Expense) =>
          editing.isCellEditing(exp.id as number, 'categoryId') ? 'cell-editing' : '',
        width: '18%',
      },
    },
    {
      id: 'description',
      header: 'Description',
      cell: ({ row }) => {
        const exp = row.original
        if (editing.isCellEditing(exp.id as number, 'description')) {
          return (
            <InlineEditCell
              initialValue={exp.description ?? ''}
              onCommit={editing.createOnCommit(exp.id as number, 'description')}
              onCancel={editing.createOnCancel()}
              onTab={(shiftKey) => editing.handleTabNavigation(exp, 'description', shiftKey)}
            />
          )
        }
        return (
          <span
            data-editable-cell
            data-expense-id={exp.id}
            data-field="description"
            {...editableCellActivate(editing, exp, 'description')}
            className="cursor-pointer block w-full truncate"
            title={exp.description ?? undefined}
          >
            {exp.description || <span className="text-theme-muted">—</span>}
          </span>
        )
      },
      meta: {
        className: 'text-left',
        cellClassName: 'text-theme-text overflow-hidden max-w-[14rem]',
        getCellClassName: (exp: Expense) =>
          editing.isCellEditing(exp.id as number, 'description') ? 'cell-editing' : '',
        width: '28%',
      },
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }) => {
        const exp = row.original
        const amountColor = (exp.amount ?? 0) < 0 ? 'text-theme-success' : 'text-theme-primary'
        if (editing.isCellEditing(exp.id as number, 'amount')) {
          return (
            <InlineMoneyEditCell
              initialValue={exp.amount ?? 0}
              onCommit={(value) => {
                editing.createOnCommit(exp.id as number, 'amount')(value)
              }}
              onCancel={editing.createOnCancel()}
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
            className={cn('cursor-pointer', amountColor)}
          >
            {formatAmount(exp.amount ?? 0)}
          </span>
        )
      },
      meta: {
        className: 'text-right tabular-nums',
        cellClassName: 'text-right tabular-nums font-semibold whitespace-nowrap',
        getCellClassName: (exp: Expense) =>
          editing.isCellEditing(exp.id as number, 'amount') ? 'cell-editing' : '',
        width: '7rem',
      },
    },
  ]
}
