import {
  Suspense,
  forwardRef,
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LazyModalFallback from '../../components/ui/LazyModalFallback'
import ContextMenu from './components/ContextMenu'
import DashboardDataTable from './components/DashboardDataTable'
import SplitBalancePopover from './components/SplitBalancePopover'
import TagsEditorPopover from './components/TagsEditorPopover'
import { useSettings } from '../../context/settingsContext'
import { useToasts } from '../../context/toastContext'
import { useContextMenu } from './hooks/useContextMenu'
import ExpenseForm from '../expenses/ExpenseForm'
import type { Category, Expense, Payee, Tag } from '../../types'
import { cn } from '../../lib/cn'
import { copyExpensesToClipboard } from '../../utils/copyExpenses'
import { getDropdownFloatingPosition, type FloatingPosition } from '../../utils/floatingPosition'
import ExpenseTableMobile from './ExpenseTableMobile'
import { getExpenseColumns } from './expenseColumns'
import {
  buildExpenseDisplayRows,
  getEffectiveSplitParentExpanded,
  type ExpenseDisplayRow,
} from './splitDisplayRows'
import { useExpenseCellEditing } from './useExpenseCellEditing'
import { StorageService } from '../../services/storageService'
import {
  findTagsAnchorElement,
  getTagIds,
  getTagsAnchorRect,
  haveSameTagIds,
} from './utils/tagsEditor'
import {
  getSplitBalanceTargetPreviews,
  getSplitPopoverTargetChildIds,
  getSplitRemainingAmount,
  isSplitBalanced,
  roundToCents,
  type SplitBalanceTargetPreview,
} from './utils/splitBalance'
import { centsToSignedDollars, parseDecimalMoneyInput } from '../../utils/moneyInput'

const BulkEditExpensesModal = lazy(() => import('./BulkEditExpensesModal'))

type EditableSplitField = 'date' | 'payeeId' | 'notes'

interface EditingSplitField {
  splitId: number
  field: EditableSplitField
}

interface ActiveTagsEditorState {
  expenseId: number
  originalTagIds: number[]
  draftTagIds: number[]
}
interface EditingSplitAmountState {
  splitId: number
  expenseId?: number
}

type PendingSplitEditKind = 'splitChild' | 'splitContainer'
type NavigationField = 'date' | 'payeeId' | 'categoryId' | 'notes' | 'tags' | 'amount'

interface ReadOnlyNavigationCell {
  rowId: string
  field: NavigationField
}

interface PendingSplitAmountEditState {
  kind: PendingSplitEditKind
  splitId: number
  editedExpenseId?: number
  draftAmount: number
  containerAmount: number
  remainingAmount: number
  anchorKey: string
  childPreviewAmounts: Record<number, number>
  targetPreviews: SplitBalanceTargetPreview[]
  pendingChildrenTotal: number
}

const TAGS_POPOVER_MIN_WIDTH = 260
const TAGS_POPOVER_MAX_WIDTH = 360
const TAGS_POPOVER_IDEAL_HEIGHT = 120
const TAGS_POPOVER_MAX_HEIGHT = 320
const TAGS_POPOVER_MIN_USABLE_HEIGHT = 120
const TAGS_POPOVER_GAP = 6

interface ExpenseTableProps {
  expenses: Expense[]
  onUpdate: (id: number, changes: Partial<Expense>) => void | Promise<void>
  onDelete: (id: number) => void
  onBulkDelete?: (ids: number[]) => void
  categories?: Category[]
  payees?: Payee[]
  expenseTagsMap?: Record<number, Tag[]>
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  isMobile?: boolean
  showNotesColumn?: boolean
  showTagsColumn?: boolean
  mobileEditTrigger?: number | null
  refreshCategories?: () => Promise<void>
  refreshPayees?: () => Promise<void>
  refreshExpenses?: () => Promise<void>
  triggerSync?: () => void
  onMobileExtraMenuActionsChange?: (
    actions: Array<{ label: string; onClick: () => void; danger?: boolean }>,
  ) => void
  onMobileSplitParentSelectionChange?: (splitId: number | null) => void
  isSplitParentExpanded?: (splitId: number) => boolean
  onToggleSplitParentExpanded?: (splitId: number) => void
}

export interface ExpenseTableHandle {
  handleEditRequest: (ids: number[]) => void
  handleSplitEditRequest: (splitId: number) => void
  handleCopyRequest: (ids: number[]) => Promise<void>
}

const ExpenseTable = forwardRef<ExpenseTableHandle, ExpenseTableProps>(function ExpenseTable(
  {
    expenses,
    onUpdate,
    onDelete,
    onBulkDelete,
    categories = [],
    payees = [],
    expenseTagsMap = {},
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    isMobile = false,
    showNotesColumn = true,
    showTagsColumn = true,
    mobileEditTrigger,
    refreshCategories,
    refreshPayees,
    refreshExpenses,
    triggerSync,
    onMobileExtraMenuActionsChange,
    onMobileSplitParentSelectionChange,
    isSplitParentExpanded,
    onToggleSplitParentExpanded,
  }: ExpenseTableProps,
  ref: React.Ref<ExpenseTableHandle>,
) {
  const { formatAmount, formatDate } = useSettings()
  const { showToast } = useToasts()
  const { menu, open: openContextMenu, close: closeContextMenu, menuRef } = useContextMenu()

  const [showMobileEditModal, setShowMobileEditModal] = useState(false)
  const [mobileEditExpense, setMobileEditExpense] = useState<Expense | null>(null)
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [bulkEditTargetIds, setBulkEditTargetIds] = useState<number[]>([])

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetIds, setDeleteTargetIds] = useState<number[]>([])
  const [localSplitParentExpansionOverrides, setLocalSplitParentExpansionOverrides] = useState<
    Record<number, boolean>
  >({})
  const [activeSplitTargetId, setActiveSplitTargetId] = useState<number | null>(null)
  const [activeSplitChildTargetId, setActiveSplitChildTargetId] = useState<number | null>(null)
  const [editingSplitField, setEditingSplitField] = useState<EditingSplitField | null>(null)
  const [splits, setSplits] = useState<Awaited<ReturnType<typeof StorageService.getExpenseSplits>>>(
    [],
  )
  const [activeTags, setActiveTags] = useState<Tag[]>([])
  const [activeTagsEditor, setActiveTagsEditor] = useState<ActiveTagsEditorState | null>(null)
  const [tagsEditorPosition, setTagsEditorPosition] = useState<FloatingPosition | null>(null)
  const [isSavingTagsEditor, setIsSavingTagsEditor] = useState(false)
  const [editingSplitAmount, setEditingSplitAmount] = useState<EditingSplitAmountState | null>(null)
  const [pendingSplitAmountEdit, setPendingSplitAmountEdit] = useState<PendingSplitAmountEditState | null>(
    null,
  )
  const [splitBalancePopoverPosition, setSplitBalancePopoverPosition] = useState<FloatingPosition | null>(
    null,
  )
  const [activeReadOnlyCell, setActiveReadOnlyCell] = useState<ReadOnlyNavigationCell | null>(null)
  const editingSplitFieldRef = useRef<EditingSplitField | null>(null)
  const pendingSplitFieldSwitchRef = useRef<EditingSplitField | null>(null)
  const pendingSplitFieldTimeoutRef = useRef<number | null>(null)
  const editingSplitAmountRef = useRef<EditingSplitAmountState | null>(null)
  const pendingSplitAmountSwitchRef = useRef<EditingSplitAmountState | null>(null)
  const pendingSplitAmountTimeoutRef = useRef<number | null>(null)
  const pendingExpenseCellSwitchRef = useRef<{ expense: Expense; field: NavigationField } | null>(
    null,
  )
  const pendingExpenseCellSwitchTimeoutRef = useRef<number | null>(null)
  const splitFieldCommitInFlightRef = useRef<Set<string>>(new Set())
  const tagsEditorRef = useRef<HTMLDivElement>(null)
  const splitBalancePopoverRef = useRef<HTMLDivElement>(null)
  const splitBalanceOpenRequestRef = useRef(0)
  const lastOpenedTagsEditorKeyRef = useRef<string | null>(null)

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const payeeMap = useMemo(() => Object.fromEntries(payees.map((p) => [p.id, p])), [payees])
  const activeCategories = useMemo(() => categories.filter((c) => !c.isArchived), [categories])
  const activePayees = useMemo(() => payees.filter((p) => !p.isArchived), [payees])
  editingSplitAmountRef.current = editingSplitAmount
  const closeTagsEditor = useCallback(() => {
    setActiveTagsEditor(null)
    setTagsEditorPosition(null)
    setIsSavingTagsEditor(false)
  }, [])
  const closeSplitBalancePopover = useCallback(() => {
    splitBalanceOpenRequestRef.current += 1
    setPendingSplitAmountEdit(null)
    setSplitBalancePopoverPosition(null)
  }, [])
  const isSplitBalancePopoverSafeInteraction = useCallback(
    (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false
      if (splitBalancePopoverRef.current?.contains(target)) return true
      if (
        target.closest(
          '[data-editable-cell], [data-split-editable-display], [data-split-amount-anchor], [data-no-cell-switch]',
        )
      ) {
        return true
      }
      if (target.closest('[data-testid="expense-table"] td')) return true
      return false
    },
    [],
  )
  const loadActiveTags = useCallback(async () => {
    const nextTags = await StorageService.getActiveTags()
    setActiveTags(nextTags)
    return nextTags
  }, [])
  const updateTagsEditorPosition = useCallback((anchorElement: HTMLElement) => {
    const rect = getTagsAnchorRect(anchorElement)
    setTagsEditorPosition(
      getDropdownFloatingPosition(rect, {
        idealHeight: TAGS_POPOVER_IDEAL_HEIGHT,
        maxHeight: TAGS_POPOVER_MAX_HEIGHT,
        minUsableHeight: TAGS_POPOVER_MIN_USABLE_HEIGHT,
        minWidth: TAGS_POPOVER_MIN_WIDTH,
        maxWidth: TAGS_POPOVER_MAX_WIDTH,
        desiredWidth: Math.max(TAGS_POPOVER_MIN_WIDTH, rect.width),
        gap: TAGS_POPOVER_GAP,
      }),
    )
  }, [])
  const openTagsEditor = useCallback(
    (expenseId: number, anchorElement: HTMLElement) => {
      if (isMobile) return
      const nextTagIds = getTagIds(expenseTagsMap[expenseId] ?? [])
      setActiveTagsEditor({
        expenseId,
        originalTagIds: nextTagIds,
        draftTagIds: nextTagIds,
      })
      setIsSavingTagsEditor(false)
      updateTagsEditorPosition(anchorElement)
      void loadActiveTags()
    },
    [expenseTagsMap, isMobile, loadActiveTags, updateTagsEditorPosition],
  )
  const resolvedIsSplitParentExpanded = useCallback(
    (splitId: number) => {
      if (isSplitParentExpanded) {
        return isSplitParentExpanded(splitId)
      }
      return getEffectiveSplitParentExpanded({
        splitId,
        defaultExpanded: true,
        overrides: localSplitParentExpansionOverrides,
      })
    },
    [isSplitParentExpanded, localSplitParentExpansionOverrides],
  )
  const resolvedOnToggleSplitParentExpanded = useCallback(
    (splitId: number) => {
      if (onToggleSplitParentExpanded) {
        onToggleSplitParentExpanded(splitId)
        return
      }
      setLocalSplitParentExpansionOverrides((prev) => ({
        ...prev,
        [splitId]: !getEffectiveSplitParentExpanded({
          splitId,
          defaultExpanded: true,
          overrides: prev,
        }),
      }))
    },
    [onToggleSplitParentExpanded],
  )

  useEffect(() => {
    if (mobileEditTrigger == null) return
    const expense = expenses.find((e) => e.id === mobileEditTrigger)
    if (expense) {
      setMobileEditExpense(expense)
      setShowMobileEditModal(true)
    }
  }, [mobileEditTrigger, expenses])

  useEffect(() => {
    if (isMobile) {
      closeTagsEditor()
      return
    }
    void loadActiveTags()
  }, [closeTagsEditor, isMobile, loadActiveTags])

  useEffect(() => {
    const splitIds = new Set(
      expenses
        .map((expense) => expense.splitId)
        .filter((splitId): splitId is number => typeof splitId === 'number'),
    )

    if (splitIds.size === 0) {
      setSplits([])
      return
    }

    let isCancelled = false
    void StorageService.getExpenseSplits().then((allSplits) => {
      if (isCancelled) return
      setSplits(allSplits.filter((split) => typeof split.id === 'number' && splitIds.has(split.id)))
    })
    return () => {
      isCancelled = true
    }
  }, [expenses])

  const resolveName = useCallback(
    (exp: Expense) => {
      const cat = catMap[exp.categoryId as number]
      if (cat) return cat.isArchived ? `${cat.name} (deleted)` : cat.name
      return 'No category'
    },
    [catMap],
  )

  const allSelected = expenses.length > 0 && expenses.every((e) => selectedIds.has(e.id as number))
  const displayRows = useMemo(
    () =>
      buildExpenseDisplayRows({
        expenses,
        splits,
        payeeMap,
        expandedSplitIds: new Set(
          expenses
            .map((expense) => expense.splitId)
            .filter((splitId): splitId is number => typeof splitId === 'number')
            .filter((splitId, index, splitIds) => splitIds.indexOf(splitId) === index)
            .filter((splitId) => resolvedIsSplitParentExpanded(splitId)),
        ),
      }),
    [expenses, splits, payeeMap, resolvedIsSplitParentExpanded],
  )
  const splitChildIdsBySplitId = useMemo(() => {
    const map = new Map<number, number[]>()
    expenses.forEach((expense) => {
      if (typeof expense.splitId !== 'number' || typeof expense.id !== 'number') return
      const existing = map.get(expense.splitId) ?? []
      existing.push(expense.id)
      map.set(expense.splitId, existing)
    })
    return map
  }, [expenses])
  const splitChildIds = useMemo(() => {
    const ids = new Set<number>()
    splitChildIdsBySplitId.forEach((childIds) => {
      childIds.forEach((childId) => {
        ids.add(childId)
      })
    })
    return ids
  }, [splitChildIdsBySplitId])

  const cancelMobileEdit = useCallback(() => {
    setShowMobileEditModal(false)
    setMobileEditExpense(null)
  }, [])

  const clearPendingSplitFieldSwitch = useCallback(() => {
    pendingSplitFieldSwitchRef.current = null
    if (pendingSplitFieldTimeoutRef.current != null) {
      window.clearTimeout(pendingSplitFieldTimeoutRef.current)
      pendingSplitFieldTimeoutRef.current = null
    }
  }, [])

  const activateSplitFieldEdit = useCallback((field: EditingSplitField) => {
    setEditingSplitField(field)
    editingSplitFieldRef.current = field
  }, [])

  const findSplitEditorExpense = useCallback(
    (splitId: number): Expense | null => {
      return expenses.find((expense) => expense.splitId === splitId) ?? null
    },
    [expenses],
  )

  const openExpenseEditor = useCallback(
    (expense: Expense | null) => {
      if (expense) {
        setMobileEditExpense(expense)
        setShowMobileEditModal(true)
      } else {
        cancelMobileEdit()
      }
    },
    [cancelMobileEdit],
  )

  const openSplitEditor = useCallback(
    (splitId: number) => {
      openExpenseEditor(findSplitEditorExpense(splitId))
    },
    [findSplitEditorExpense, openExpenseEditor],
  )

  const closeBulkEditModal = useCallback(() => {
    setShowBulkEditModal(false)
    setBulkEditTargetIds([])
  }, [])

  const openBulkEditModal = useCallback((ids: number[]) => {
    setBulkEditTargetIds(ids)
    setShowBulkEditModal(true)
  }, [])

  const editing = useExpenseCellEditing({
    expenses,
    onUpdate,
    isMobile,
    showNotesColumn,
    showTagsColumn,
    selectedIds,
    onToggleSelect,
    setMobileEditExpense: openExpenseEditor,
    setShowMobileEditModal,
  })

  const navigationFieldOrder = useMemo(() => {
    const order: NavigationField[] = ['date', 'payeeId', 'categoryId']
    if (showNotesColumn) order.push('notes')
    if (showTagsColumn) order.push('tags')
    order.push('amount')
    return order
  }, [showNotesColumn, showTagsColumn])

  const findRowByExpenseId = useCallback(
    (expenseId: number): ExpenseDisplayRow | null =>
      displayRows.find(
        (row) =>
          (row.rowType === 'expense' || row.rowType === 'splitChild') && row.expense.id === expenseId,
      ) ?? null,
    [displayRows],
  )

  const getCellMode = useCallback(
    (
      row: ExpenseDisplayRow,
      field: NavigationField,
    ): 'editableExpense' | 'editableSplitField' | 'editableSplitAmount' | 'readOnly' | 'hidden' => {
      if (row.rowType === 'expense') {
        return 'editableExpense'
      }
      if (row.rowType === 'splitContainer') {
        if (field === 'date' || field === 'payeeId' || field === 'notes') return 'editableSplitField'
        if (field === 'amount') return 'editableSplitAmount'
        return 'readOnly'
      }
      if (field === 'payeeId') return 'hidden'
      if (field === 'date') return 'readOnly'
      if (field === 'amount') return 'editableSplitAmount'
      return 'editableExpense'
    },
    [],
  )

  const dismissTagsEditor = useCallback(() => {
    closeTagsEditor()
  }, [closeTagsEditor])
  const cancelTagsEditor = useCallback(() => {
    editing.cancelCurrentCellEdit()
    dismissTagsEditor()
  }, [dismissTagsEditor, editing])
  const saveTagsEditorDraft = useCallback(async (): Promise<boolean> => {
    if (!activeTagsEditor || isSavingTagsEditor) return false
    const nextTagIds = Array.from(new Set(activeTagsEditor.draftTagIds))
    if (haveSameTagIds(nextTagIds, activeTagsEditor.originalTagIds)) {
      editing.cancelCurrentCellEdit()
      dismissTagsEditor()
      return true
    }
    setIsSavingTagsEditor(true)
    try {
      await StorageService.setExpenseTags(activeTagsEditor.expenseId, nextTagIds)
      triggerSync?.()
      editing.cancelCurrentCellEdit()
      dismissTagsEditor()
      return true
    } catch (error) {
      console.error('Failed to update expense tags:', error)
      showToast({ message: 'Could not update tags.', tone: 'danger' })
      setIsSavingTagsEditor(false)
      return false
    }
  }, [activeTagsEditor, dismissTagsEditor, editing, isSavingTagsEditor, showToast, triggerSync])
  const handleSaveTagsEditor = useCallback(async () => {
    await saveTagsEditorDraft()
  }, [saveTagsEditorDraft])
  const handleTagsEditorChange = useCallback((tagIds: number[]) => {
    setActiveTagsEditor((current) => {
      if (!current) return null
      return { ...current, draftTagIds: tagIds }
    })
  }, [])
  const handleCreateTagFromEditor = useCallback(
    async (name: string) => {
      const trimmedName = name.trim()
      const tagId = await StorageService.addTag(name)
      triggerSync?.()
      setActiveTags((current) => {
        if (current.some((tag) => tag.id === tagId)) {
          return current
        }
        return [
          ...current,
          {
            id: tagId as number,
            name: trimmedName,
            normalizedName: trimmedName.toLowerCase(),
            isArchived: false,
          },
        ]
      })
      return tagId as number
    },
    [triggerSync],
  )

  const handleEditRequest = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) return
      if (ids.length === 1) {
        const expense = expenses.find((item) => item.id === ids[0])
        if (expense) openExpenseEditor(expense)
        return
      }
      const includesSplitChild = expenses.some(
        (expense) => ids.includes(expense.id as number) && typeof expense.splitId === 'number',
      )
      if (includesSplitChild) {
        showToast({
          message: 'Bulk edit is unavailable when selection includes split allocations.',
          tone: 'default',
          durationMs: 5000,
        })
        return
      }
      openBulkEditModal(ids)
    },
    [expenses, openBulkEditModal, openExpenseEditor, showToast],
  )

  const handleCopyRequest = useCallback(
    async (ids: number[]) => {
      const selected = expenses.filter((e) => ids.includes(e.id as number))
      await copyExpensesToClipboard(selected, categories, payees, formatDate, formatAmount)
      if (!isMobile) {
        showToast({ message: 'Copied to clipboard', tone: 'success' })
      }
    },
    [expenses, categories, payees, formatDate, formatAmount, showToast, isMobile],
  )

  useImperativeHandle(ref, () => ({
    handleEditRequest,
    handleSplitEditRequest: openSplitEditor,
    handleCopyRequest,
  }))

  const handleDeleteRequest = useCallback((ids: number[]) => {
    setDeleteTargetIds(ids)
    setShowDeleteConfirm(true)
  }, [])

  const confirmDelete = useCallback(() => {
    if (deleteTargetIds.length === 1) {
      onDelete(deleteTargetIds[0])
    } else if (onBulkDelete) {
      onBulkDelete(deleteTargetIds)
    }
    setShowDeleteConfirm(false)
    setDeleteTargetIds([])
  }, [deleteTargetIds, onDelete, onBulkDelete])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, row: ExpenseDisplayRow) => {
      if (isMobile) return
      if (row.rowType === 'splitContainer') {
        setActiveSplitTargetId(row.splitId)
        setActiveSplitChildTargetId(null)
        openContextMenu(e, -(row.splitId + 1))
        return
      }
      if (row.rowType === 'splitChild') {
        setActiveSplitTargetId(null)
        setActiveSplitChildTargetId(row.expense.id as number)
        openContextMenu(e, row.expense.id as number)
        return
      }
      setActiveSplitTargetId(null)
      setActiveSplitChildTargetId(null)
      openContextMenu(e, row.expense.id as number)
    },
    [openContextMenu, isMobile],
  )

  const handleUnsplit = useCallback(
    async (splitId: number) => {
      try {
        await StorageService.unsplitExpenseSplit(splitId)
        await refreshExpenses?.()
        triggerSync?.()
        showToast({ message: 'Transaction unsplit', tone: 'success' })
      } catch (error) {
        console.error('Failed to unsplit transaction:', error)
        showToast({ message: 'Could not unsplit transaction.', tone: 'danger' })
      }
    },
    [refreshExpenses, showToast, triggerSync],
  )

  const handleUnsplitChild = useCallback(
    async (expenseId: number) => {
      try {
        await StorageService.unsplitSplitChildExpense(expenseId)
        await refreshExpenses?.()
        triggerSync?.()
        showToast({ message: 'Split allocation unsplit', tone: 'success' })
      } catch (error) {
        console.error('Failed to unsplit split allocation:', error)
        showToast({ message: 'Could not unsplit split allocation.', tone: 'danger' })
      }
    },
    [refreshExpenses, showToast, triggerSync],
  )

  const toggleSplitParentSelection = useCallback(
    (splitId: number) => {
      const childIds = splitChildIdsBySplitId.get(splitId) ?? []
      if (childIds.length === 0) return
      const allSelectedForSplit = childIds.every((id) => selectedIds.has(id))
      childIds.forEach((id) => {
        const shouldSelect = !allSelectedForSplit
        const isSelected = selectedIds.has(id)
        if (shouldSelect && !isSelected) onToggleSelect(id)
        if (!shouldSelect && isSelected) onToggleSelect(id)
      })
    },
    [onToggleSelect, selectedIds, splitChildIdsBySplitId],
  )

  const handleStartSplitFieldEdit = useCallback(
    (splitId: number, field: EditableSplitField) => {
      closeTagsEditor()
      const nextField: EditingSplitField = { splitId, field }
      const currentField = editingSplitFieldRef.current
      const hasActiveExpenseCellEdit = editing.editingCell != null

      if (currentField?.splitId === splitId && currentField.field === field) return

      if (currentField == null) {
        clearPendingSplitFieldSwitch()
        if (!hasActiveExpenseCellEdit) {
          activateSplitFieldEdit(nextField)
          return
        }
      } else {
        clearPendingSplitFieldSwitch()
        pendingSplitFieldSwitchRef.current = nextField

        const activeElement = document.activeElement
        if (activeElement instanceof HTMLElement) {
          activeElement.blur()
        }

        pendingSplitFieldTimeoutRef.current = window.setTimeout(() => {
          window.setTimeout(() => {
            const pendingField = pendingSplitFieldSwitchRef.current
            if (pendingField?.splitId !== splitId || pendingField.field !== field) {
              return
            }
            editing.cancelCurrentCellEdit()
            activateSplitFieldEdit(nextField)
            clearPendingSplitFieldSwitch()
          }, 0)
        }, 0)
        return
      }

      clearPendingSplitFieldSwitch()
      pendingSplitFieldSwitchRef.current = nextField

      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement) {
        activeElement.blur()
      }

      pendingSplitFieldTimeoutRef.current = window.setTimeout(() => {
        window.setTimeout(() => {
          const pendingField = pendingSplitFieldSwitchRef.current
          if (pendingField?.splitId !== splitId || pendingField.field !== field) {
            return
          }
          editing.cancelCurrentCellEdit()
          activateSplitFieldEdit(nextField)
          clearPendingSplitFieldSwitch()
        }, 0)
      }, 0)
    },
    [
      activateSplitFieldEdit,
      clearPendingSplitFieldSwitch,
      closeTagsEditor,
      editing.editingCell,
    ],
  )

  const handleCancelSplitFieldEdit = useCallback(() => {
    if (pendingSplitFieldSwitchRef.current) return
    clearPendingSplitFieldSwitch()
    setEditingSplitField(null)
    editingSplitFieldRef.current = null
  }, [clearPendingSplitFieldSwitch])
  const getActiveSplitAmountInput = useCallback((): HTMLInputElement | null => {
    const currentAmount = editingSplitAmountRef.current
    if (!currentAmount) return null

    const rowSelector =
      typeof currentAmount.expenseId === 'number'
        ? `[data-testid="split-child-${currentAmount.expenseId}"]`
        : `[data-testid="split-container-${currentAmount.splitId}"]`
    return document.querySelector(`${rowSelector} input[type="text"]`) as HTMLInputElement | null
  }, [])
  const blurActiveSplitAmountEditor = useCallback(() => {
    const activeInput = getActiveSplitAmountInput()
    if (activeInput) {
      if (document.activeElement === activeInput) {
        activeInput.blur()
      } else {
        activeInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      }
      return
    }

    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) {
      activeElement.blur()
    }
  }, [getActiveSplitAmountInput])
  const clearPendingExpenseCellSwitch = useCallback(() => {
    pendingExpenseCellSwitchRef.current = null
    if (pendingExpenseCellSwitchTimeoutRef.current != null) {
      window.clearTimeout(pendingExpenseCellSwitchTimeoutRef.current)
      pendingExpenseCellSwitchTimeoutRef.current = null
    }
  }, [])
  const clearPendingSplitAmountSwitch = useCallback(() => {
    pendingSplitAmountSwitchRef.current = null
    if (pendingSplitAmountTimeoutRef.current != null) {
      window.clearTimeout(pendingSplitAmountTimeoutRef.current)
      pendingSplitAmountTimeoutRef.current = null
    }
  }, [])
  const activateSplitAmountEdit = useCallback(
    (nextAmount: EditingSplitAmountState) => {
      setEditingSplitAmount(nextAmount)
      editingSplitAmountRef.current = nextAmount
    },
    [],
  )
  const finishSplitAmountEdit = useCallback((target: EditingSplitAmountState) => {
    setEditingSplitAmount((current) => {
      const isMatchingTarget =
        current?.splitId === target.splitId && current?.expenseId === target.expenseId
      if (!isMatchingTarget) return current
      editingSplitAmountRef.current = null
      return null
    })
  }, [])
  const handleStartSplitContainerAmountEdit = useCallback(
    (splitId: number) => {
      if (pendingSplitAmountEdit) return
      editing.cancelCurrentCellEdit()
      handleCancelSplitFieldEdit()
      closeTagsEditor()
      const nextAmount: EditingSplitAmountState = { splitId }
      const currentAmount = editingSplitAmountRef.current

      if (currentAmount?.splitId === splitId && typeof currentAmount.expenseId !== 'number') return

      if (currentAmount == null) {
        clearPendingSplitAmountSwitch()
        activateSplitAmountEdit(nextAmount)
        return
      }

      clearPendingSplitAmountSwitch()
      pendingSplitAmountSwitchRef.current = nextAmount

      blurActiveSplitAmountEditor()

      pendingSplitAmountTimeoutRef.current = window.setTimeout(() => {
        window.setTimeout(() => {
          const pendingAmount = pendingSplitAmountSwitchRef.current
          if (pendingAmount?.splitId !== splitId || typeof pendingAmount.expenseId === 'number') {
            return
          }
          activateSplitAmountEdit(nextAmount)
          clearPendingSplitAmountSwitch()
        }, 0)
      }, 0)
    },
    [
      activateSplitAmountEdit,
      clearPendingSplitAmountSwitch,
      closeTagsEditor,
      editing,
      handleCancelSplitFieldEdit,
      pendingSplitAmountEdit,
    ],
  )
  const handleStartSplitChildAmountEdit = useCallback(
    (splitId: number, expenseId: number) => {
      if (pendingSplitAmountEdit) return
      editing.cancelCurrentCellEdit()
      handleCancelSplitFieldEdit()
      closeTagsEditor()
      const nextAmount: EditingSplitAmountState = { splitId, expenseId }
      const currentAmount = editingSplitAmountRef.current

      if (currentAmount?.splitId === splitId && currentAmount.expenseId === expenseId) return

      if (currentAmount == null) {
        clearPendingSplitAmountSwitch()
        activateSplitAmountEdit(nextAmount)
        return
      }

      clearPendingSplitAmountSwitch()
      pendingSplitAmountSwitchRef.current = nextAmount

      blurActiveSplitAmountEditor()

      pendingSplitAmountTimeoutRef.current = window.setTimeout(() => {
        window.setTimeout(() => {
          const pendingAmount = pendingSplitAmountSwitchRef.current
          if (pendingAmount?.splitId !== splitId || pendingAmount.expenseId !== expenseId) {
            return
          }
          activateSplitAmountEdit(nextAmount)
          clearPendingSplitAmountSwitch()
        }, 0)
      }, 0)
    },
    [
      activateSplitAmountEdit,
      clearPendingSplitAmountSwitch,
      closeTagsEditor,
      editing,
      handleCancelSplitFieldEdit,
      pendingSplitAmountEdit,
    ],
  )
  const handleCancelSplitAmountEdit = useCallback(() => {
    clearPendingSplitAmountSwitch()
    setEditingSplitAmount(null)
    editingSplitAmountRef.current = null
    closeSplitBalancePopover()
  }, [clearPendingSplitAmountSwitch, closeSplitBalancePopover])
  const dismissActiveEditorBeforePopoverClose = useCallback((): boolean => {
    const hasActiveEditor = Boolean(
      editing.editingCell || editingSplitField || editingSplitAmount || activeTagsEditor,
    )
    if (!hasActiveEditor) return false

    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && activeElement !== document.body) {
      activeElement.blur()
    } else if (activeTagsEditor) {
      cancelTagsEditor()
    } else if (editing.editingCell) {
      editing.cancelCurrentCellEdit()
    } else if (editingSplitField) {
      handleCancelSplitFieldEdit()
    } else if (editingSplitAmount) {
      clearPendingSplitAmountSwitch()
      setEditingSplitAmount(null)
      editingSplitAmountRef.current = null
    }

    return true
  }, [
    activeTagsEditor,
    cancelTagsEditor,
    clearPendingSplitAmountSwitch,
    editing,
    editingSplitAmount,
    editingSplitField,
    handleCancelSplitFieldEdit,
  ])
  const getCurrentNavigationCell = useCallback((): ReadOnlyNavigationCell | null => {
    if (activeReadOnlyCell) return activeReadOnlyCell
    if (editingSplitAmount) {
      if (typeof editingSplitAmount.expenseId === 'number') {
        return { rowId: `split-child-${editingSplitAmount.expenseId}`, field: 'amount' }
      }
      return { rowId: `split-container-${editingSplitAmount.splitId}`, field: 'amount' }
    }
    if (editingSplitField) {
      return { rowId: `split-container-${editingSplitField.splitId}`, field: editingSplitField.field }
    }
    if (editing.editingCell) {
      const row = findRowByExpenseId(editing.editingCell.expenseId)
      if (!row) return null
      return { rowId: row.rowId, field: editing.editingCell.field }
    }
    return null
  }, [activeReadOnlyCell, editing.editingCell, editingSplitAmount, editingSplitField, findRowByExpenseId])

  const activateNavigationTarget = useCallback(
    (target: ReadOnlyNavigationCell) => {
      const row = displayRows.find((item) => item.rowId === target.rowId)
      if (!row) return
      const mode = getCellMode(row, target.field)
      if (mode === 'hidden') return

      if (mode === 'readOnly') {
        editing.cancelCurrentCellEdit()
        handleCancelSplitFieldEdit()
        handleCancelSplitAmountEdit()
        setActiveReadOnlyCell(target)
        return
      }

      setActiveReadOnlyCell(null)
      if (mode === 'editableSplitField' && row.rowType === 'splitContainer') {
        if (target.field === 'date' || target.field === 'payeeId' || target.field === 'notes') {
          handleStartSplitFieldEdit(row.splitId, target.field)
        }
        return
      }
      if (mode === 'editableSplitAmount') {
        if (row.rowType === 'splitContainer') {
          handleStartSplitContainerAmountEdit(row.splitId)
          return
        }
        if (row.rowType === 'splitChild') {
          handleStartSplitChildAmountEdit(row.splitId, row.expense.id as number)
          return
        }
      }
      if (mode === 'editableExpense') {
        if (row.rowType === 'expense' || row.rowType === 'splitChild') {
          switchExpenseCellEdit(row.expense, target.field)
        }
      }
    },
    [
      displayRows,
      editing,
      getCellMode,
      handleCancelSplitAmountEdit,
      handleCancelSplitFieldEdit,
      handleStartSplitChildAmountEdit,
      handleStartSplitContainerAmountEdit,
      handleStartSplitFieldEdit,
      switchExpenseCellEdit,
    ],
  )

  const navigateFromCell = useCallback(
    (field: NavigationField, shiftKey: boolean, movement: 'horizontal' | 'vertical') => {
      const current = getCurrentNavigationCell()
      if (!current) return

      const rowIndex = displayRows.findIndex((row) => row.rowId === current.rowId)
      if (rowIndex < 0) return

      const fieldIndex = navigationFieldOrder.indexOf(field)
      if (fieldIndex < 0) return

      const rowStep = shiftKey ? -1 : 1
      const fieldStep = shiftKey ? -1 : 1

      if (movement === 'vertical') {
        let nextRowIndex = rowIndex + rowStep
        while (nextRowIndex >= 0 && nextRowIndex < displayRows.length) {
          const targetRow = displayRows[nextRowIndex]
          if (getCellMode(targetRow, field) !== 'hidden') {
            activateNavigationTarget({ rowId: targetRow.rowId, field })
            return
          }
          nextRowIndex += rowStep
        }
        setActiveReadOnlyCell(null)
        editing.cancelCurrentCellEdit()
        handleCancelSplitFieldEdit()
        handleCancelSplitAmountEdit()
        return
      }

      let nextRowIndex = rowIndex
      let nextFieldIndex = fieldIndex + fieldStep

      while (nextRowIndex >= 0 && nextRowIndex < displayRows.length) {
        while (nextFieldIndex >= 0 && nextFieldIndex < navigationFieldOrder.length) {
          const nextField = navigationFieldOrder[nextFieldIndex]
          const targetRow = displayRows[nextRowIndex]
          if (getCellMode(targetRow, nextField) !== 'hidden') {
            activateNavigationTarget({ rowId: targetRow.rowId, field: nextField })
            return
          }
          nextFieldIndex += fieldStep
        }

        nextRowIndex += rowStep
        nextFieldIndex = shiftKey ? navigationFieldOrder.length - 1 : 0
      }

      setActiveReadOnlyCell(null)
      editing.cancelCurrentCellEdit()
      handleCancelSplitFieldEdit()
      handleCancelSplitAmountEdit()
    },
    [
      activateNavigationTarget,
      displayRows,
      editing,
      getCurrentNavigationCell,
      getCellMode,
      handleCancelSplitAmountEdit,
      handleCancelSplitFieldEdit,
      navigationFieldOrder,
    ],
  )

  const handleTableEnterNavigation = useCallback(
    (_expense: Expense, field: NavigationField, shiftKey: boolean) => {
      const current = getCurrentNavigationCell()
      const sourceField = current?.field ?? field
      navigateFromCell(sourceField, shiftKey, 'vertical')
    },
    [getCurrentNavigationCell, navigateFromCell],
  )

  const handleTableTabNavigation = useCallback(
    (_expense: Expense, field: NavigationField, shiftKey: boolean) => {
      const current = getCurrentNavigationCell()
      const sourceField = current?.field ?? field
      navigateFromCell(sourceField, shiftKey, 'horizontal')
    },
    [getCurrentNavigationCell, navigateFromCell],
  )
  const handleTagsEnterNavigation = useCallback(
    async (shiftKey: boolean) => {
      if (!activeTagsEditor) return
      const activeExpense = expenses.find((expense) => expense.id === activeTagsEditor.expenseId)
      if (!activeExpense) return
      const didSave = await saveTagsEditorDraft()
      if (!didSave) return
      handleTableEnterNavigation(activeExpense, 'tags', shiftKey)
    },
    [activeTagsEditor, expenses, handleTableEnterNavigation, saveTagsEditorDraft],
  )
  const handleTagsTabNavigation = useCallback(
    async (shiftKey: boolean) => {
      if (!activeTagsEditor) return
      const activeExpense = expenses.find((expense) => expense.id === activeTagsEditor.expenseId)
      if (!activeExpense) return
      const didSave = await saveTagsEditorDraft()
      if (!didSave) return
      handleTableTabNavigation(activeExpense, 'tags', shiftKey)
    },
    [activeTagsEditor, expenses, handleTableTabNavigation, saveTagsEditorDraft],
  )

  const updateLocalSplit = useCallback((splitId: number, changes: Record<string, unknown>) => {
    setSplits((current) =>
      current.map((split) => (split.id === splitId ? { ...split, ...changes } : split)),
    )
  }, [])

  const finishSplitFieldCommit = useCallback((splitId: number, field: EditableSplitField) => {
    setEditingSplitField((current) => {
      if (current?.splitId === splitId && current.field === field) {
        editingSplitFieldRef.current = null
        return null
      }
      return current
    })
  }, [])

  const beginSplitFieldCommit = useCallback(
    (splitId: number, field: EditableSplitField): boolean => {
      const key = `${splitId}:${field}`
      if (splitFieldCommitInFlightRef.current.has(key)) return false
      splitFieldCommitInFlightRef.current.add(key)
      finishSplitFieldCommit(splitId, field)
      return true
    },
    [finishSplitFieldCommit],
  )

  const endSplitFieldCommit = useCallback((splitId: number, field: EditableSplitField) => {
    splitFieldCommitInFlightRef.current.delete(`${splitId}:${field}`)
  }, [])

  const handleCommitSplitNotesEdit = useCallback(
    async (splitId: number, value: string) => {
      if (!beginSplitFieldCommit(splitId, 'notes')) return
      const notes = value.trim()
      try {
        await StorageService.updateExpenseSplit(splitId, { notes })
        updateLocalSplit(splitId, { notes })
      } catch (error) {
        console.error('Failed to update split notes:', error)
        showToast({ message: 'Could not update split notes.', tone: 'danger' })
      } finally {
        endSplitFieldCommit(splitId, 'notes')
      }
    },
    [beginSplitFieldCommit, endSplitFieldCommit, showToast, updateLocalSplit],
  )

  const handleCommitSplitDateEdit = useCallback(
    async (splitId: number, date: string) => {
      if (!beginSplitFieldCommit(splitId, 'date')) return
      try {
        await StorageService.updateExpenseSplit(splitId, { date })
        updateLocalSplit(splitId, { date })
        await refreshExpenses?.()
      } catch (error) {
        console.error('Failed to update split date:', error)
        showToast({ message: 'Could not update split date.', tone: 'danger' })
      } finally {
        endSplitFieldCommit(splitId, 'date')
      }
    },
    [beginSplitFieldCommit, endSplitFieldCommit, refreshExpenses, showToast, updateLocalSplit],
  )

  const handleCommitSplitPayeeEdit = useCallback(
    async (splitId: number, payeeId: number | undefined) => {
      if (!beginSplitFieldCommit(splitId, 'payeeId')) return
      const nextPayee =
        typeof payeeId === 'number' ? payees.find((payee) => payee.id === payeeId) : null
      const changes = {
        payeeId,
        payeeNameSnapshot: nextPayee?.name ?? null,
      }
      try {
        await StorageService.updateExpenseSplit(splitId, changes)
        updateLocalSplit(splitId, changes)
        await refreshExpenses?.()
      } catch (error) {
        console.error('Failed to update split payee:', error)
        showToast({ message: 'Could not update split payee.', tone: 'danger' })
      } finally {
        endSplitFieldCommit(splitId, 'payeeId')
      }
    },
    [
      beginSplitFieldCommit,
      endSplitFieldCommit,
      payees,
      refreshExpenses,
      showToast,
      updateLocalSplit,
    ],
  )
  const openSplitBalancePopover = useCallback(
    (payload: PendingSplitAmountEditState) => {
      const requestId = splitBalanceOpenRequestRef.current + 1
      splitBalanceOpenRequestRef.current = requestId
      window.setTimeout(() => {
        if (splitBalanceOpenRequestRef.current !== requestId) return
        const anchor = document.querySelector(
          `[data-split-amount-anchor="${payload.anchorKey}"]`,
        ) as HTMLElement | null
        if (!anchor?.isConnected) {
          closeSplitBalancePopover()
          return
        }
        const rect = anchor.getBoundingClientRect()
        setPendingSplitAmountEdit(payload)
        setSplitBalancePopoverPosition(
          getDropdownFloatingPosition(rect, {
            minWidth: 220,
            maxWidth: 260,
            desiredWidth: 240,
            idealHeight: 180,
            maxHeight: 280,
            minUsableHeight: 100,
            gap: 6,
          }),
        )
      }, 0)
    },
    [closeSplitBalancePopover],
  )
  const handleSplitAmountCommit = useCallback(
    (params: {
      splitId: number
      editedExpenseId?: number
      nextAmount: number
      isContainerEdit: boolean
    }) => {
      const { splitId, editedExpenseId, nextAmount, isContainerEdit } = params
      const children = expenses.filter((expense) => expense.splitId === splitId)
      const childAmountsById = new Map<number, number>()
      const childAmounts = children.map((child) => {
        const amount = child.id === editedExpenseId ? nextAmount : (child.amount ?? 0)
        if (typeof child.id === 'number') {
          childAmountsById.set(child.id, amount)
        }
        return amount
      })
      const containerAmount = isContainerEdit
        ? nextAmount
        : (splits.find((split) => split.id === splitId)?.amount ?? 0)

      const remainingAmount = getSplitRemainingAmount(containerAmount, childAmounts)
      if (isSplitBalanced(containerAmount, childAmounts)) {
        closeSplitBalancePopover()
        if (isContainerEdit) {
          void StorageService.updateExpenseSplit(splitId, { amount: nextAmount })
            .then(() => {
              updateLocalSplit(splitId, { amount: nextAmount })
            })
            .catch((error) => {
              console.error('Failed to update split amount:', error)
              showToast({ message: 'Could not update split amount.', tone: 'danger' })
            })
          return
        }
        if (typeof editedExpenseId === 'number') {
          onUpdate(editedExpenseId, { amount: nextAmount })
        }
        return
      }

      const targetChildIds = getSplitPopoverTargetChildIds({
        children,
        editedExpenseId,
        prioritizeSiblingsForChildEdit: !isContainerEdit,
      })
      const childPreviewAmounts = Object.fromEntries(childAmountsById)
      const targetPreviews = getSplitBalanceTargetPreviews({
        containerAmount,
        childAmountsById: childPreviewAmounts,
        targetChildIds,
        remainingAmount,
      })
      const pendingChildrenTotal = roundToCents(Object.values(childPreviewAmounts).reduce((sum, amount) => sum + amount, 0))
      openSplitBalancePopover({
        kind: isContainerEdit ? 'splitContainer' : 'splitChild',
        splitId,
        editedExpenseId,
        draftAmount: nextAmount,
        containerAmount,
        remainingAmount,
        anchorKey: isContainerEdit ? `split-container-${splitId}` : `split-child-${editedExpenseId}`,
        childPreviewAmounts,
        targetPreviews,
        pendingChildrenTotal,
      })
    },
    [closeSplitBalancePopover, expenses, onUpdate, openSplitBalancePopover, showToast, splits, updateLocalSplit],
  )
  const handleCommitSplitContainerAmountEdit = useCallback(
    (splitId: number, amount: number) => {
      finishSplitAmountEdit({ splitId })
      handleSplitAmountCommit({ splitId, nextAmount: amount, isContainerEdit: true })
    },
    [finishSplitAmountEdit, handleSplitAmountCommit],
  )
  const handleCommitSplitChildAmountEdit = useCallback(
    (splitId: number, expenseId: number, amount: number) => {
      finishSplitAmountEdit({ splitId, expenseId })
      handleSplitAmountCommit({
        splitId,
        editedExpenseId: expenseId,
        nextAmount: amount,
        isContainerEdit: false,
      })
    },
    [finishSplitAmountEdit, handleSplitAmountCommit],
  )
  function switchExpenseCellEdit(expense: Expense, field: NavigationField): void {
    const currentSplitAmount = editingSplitAmountRef.current
    const currentSplitField = editingSplitFieldRef.current
    if (!currentSplitAmount && !currentSplitField) {
      editing.switchCellEdit(expense, field)
      return
    }

    if (currentSplitAmount) {
      const activeInput = getActiveSplitAmountInput()
      if (activeInput) {
        const parsed = parseDecimalMoneyInput(activeInput.value, { allowNegative: true })
        if (parsed.isValid) {
          const parsedValue = centsToSignedDollars(parsed.cents, parsed.isNegative)
          if (typeof currentSplitAmount.expenseId === 'number') {
            handleCommitSplitChildAmountEdit(
              currentSplitAmount.splitId,
              currentSplitAmount.expenseId,
              parsedValue,
            )
          } else {
            handleCommitSplitContainerAmountEdit(currentSplitAmount.splitId, parsedValue)
          }
        }
      } else {
        handleCancelSplitAmountEdit()
      }
    }

    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) {
      activeElement.blur()
    }

    clearPendingExpenseCellSwitch()
    pendingExpenseCellSwitchRef.current = { expense, field }
    pendingExpenseCellSwitchTimeoutRef.current = window.setTimeout(() => {
      const pendingTarget = pendingExpenseCellSwitchRef.current
      if (
        !pendingTarget ||
        pendingTarget.expense.id !== expense.id ||
        pendingTarget.field !== field
      ) {
        return
      }
      editing.switchCellEdit(expense, field)
      clearPendingExpenseCellSwitch()
    }, 16)
  }
  const handleApplySplitRemainingToChild = useCallback(
    (expenseId: number) => {
      if (!pendingSplitAmountEdit) return
      const targetExpense = expenses.find((expense) => expense.id === expenseId)
      if (!targetExpense) {
        closeSplitBalancePopover()
        return
      }
      const targetAmount = roundToCents(
        (pendingSplitAmountEdit.childPreviewAmounts[expenseId] ?? targetExpense.amount ?? 0) +
          pendingSplitAmountEdit.remainingAmount,
      )

      if (pendingSplitAmountEdit.kind === 'splitContainer') {
        void StorageService.updateExpenseSplit(pendingSplitAmountEdit.splitId, {
          amount: pendingSplitAmountEdit.draftAmount,
        })
          .then(() => {
            updateLocalSplit(pendingSplitAmountEdit.splitId, { amount: pendingSplitAmountEdit.draftAmount })
            onUpdate(expenseId, { amount: targetAmount })
          })
          .catch((error) => {
            console.error('Failed to update split amount:', error)
            showToast({ message: 'Could not update split amount.', tone: 'danger' })
          })
        closeSplitBalancePopover()
        return
      }

      if (typeof pendingSplitAmountEdit.editedExpenseId === 'number') {
        if (pendingSplitAmountEdit.editedExpenseId !== expenseId) {
          onUpdate(pendingSplitAmountEdit.editedExpenseId, { amount: pendingSplitAmountEdit.draftAmount })
        }
        onUpdate(expenseId, { amount: targetAmount })
      }
      closeSplitBalancePopover()
    },
    [pendingSplitAmountEdit, closeSplitBalancePopover, expenses, onUpdate, showToast, updateLocalSplit],
  )
  const handleApplySplitBalanceTotal = useCallback(() => {
    if (!pendingSplitAmountEdit) return
    if (pendingSplitAmountEdit.kind !== 'splitChild') return
    if (typeof pendingSplitAmountEdit.editedExpenseId !== 'number') {
      closeSplitBalancePopover()
      return
    }

    const { editedExpenseId, draftAmount, splitId, pendingChildrenTotal } = pendingSplitAmountEdit
    void StorageService.updateExpenseSplit(splitId, {
      amount: pendingChildrenTotal,
    })
      .then(() => {
        updateLocalSplit(splitId, { amount: pendingChildrenTotal })
        onUpdate(editedExpenseId, { amount: draftAmount })
      })
      .catch((error) => {
        console.error('Failed to update split amount:', error)
        showToast({ message: 'Could not update split amount.', tone: 'danger' })
      })

    closeSplitBalancePopover()
  }, [closeSplitBalancePopover, onUpdate, pendingSplitAmountEdit, showToast, updateLocalSplit])

  const editingCell = editing.editingCell

  useEffect(() => {
    if (showTagsColumn) return
    if (activeTagsEditor) {
      closeTagsEditor()
    }
    if (editingCell?.field === 'tags') {
      editing.cancelCurrentCellEdit()
    }
  }, [activeTagsEditor, closeTagsEditor, editing, editingCell?.field, showTagsColumn])

  useEffect(() => {
    if (showNotesColumn) return
    if (editingCell?.field === 'notes') {
      editing.cancelCurrentCellEdit()
    }
  }, [editing, editingCell?.field, showNotesColumn])

  useEffect(() => {
    if (!isMobile && activeReadOnlyCell) return
    setActiveReadOnlyCell(null)
  }, [activeReadOnlyCell, isMobile])

  useEffect(() => {
    if (!activeReadOnlyCell) return
    if (editing.editingCell || editingSplitField || editingSplitAmount) {
      setActiveReadOnlyCell(null)
    }
  }, [activeReadOnlyCell, editing.editingCell, editingSplitAmount, editingSplitField])

  useEffect(() => {
    if (!activeReadOnlyCell || isMobile) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' && event.key !== 'Enter') return
      event.preventDefault()
      navigateFromCell(activeReadOnlyCell.field, event.shiftKey, event.key === 'Tab' ? 'horizontal' : 'vertical')
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeReadOnlyCell, isMobile, navigateFromCell])

  useEffect(() => {
    if (isMobile) return
    if (editingCell?.field !== 'tags') {
      if (activeTagsEditor) {
        dismissTagsEditor()
      }
      lastOpenedTagsEditorKeyRef.current = null
      return
    }

    const editingKey = `${editingCell.expenseId}:tags`
    if (activeTagsEditor?.expenseId === editingCell.expenseId) {
      lastOpenedTagsEditorKeyRef.current = editingKey
      return
    }
    if (lastOpenedTagsEditorKeyRef.current === editingKey) return

    const target = document.querySelector(
      `[data-expense-id="${editingCell.expenseId}"][data-field="tags"]`,
    )
    if (target instanceof HTMLElement) {
      lastOpenedTagsEditorKeyRef.current = editingKey
      openTagsEditor(editingCell.expenseId, target)
    }
  }, [activeTagsEditor, dismissTagsEditor, editingCell, isMobile, openTagsEditor])

  useEffect(() => {
    if (!activeTagsEditor) return
    if (editingSplitField) {
      cancelTagsEditor()
    }
  }, [activeTagsEditor, cancelTagsEditor, editingSplitField])
  useEffect(() => {
    if (!pendingSplitAmountEdit) return
    const handlePointerDown = (event: PointerEvent) => {
      if (isSplitBalancePopoverSafeInteraction(event.target)) return
      if (dismissActiveEditorBeforePopoverClose()) return
      closeSplitBalancePopover()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeSplitBalancePopover()
    }
    const handleViewportChange = () => {
      closeSplitBalancePopover()
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [
    pendingSplitAmountEdit,
    closeSplitBalancePopover,
    dismissActiveEditorBeforePopoverClose,
    isSplitBalancePopoverSafeInteraction,
  ])

  useLayoutEffect(() => {
    if (!activeTagsEditor) return
    const updatePosition = () => {
      const anchorElement = findTagsAnchorElement(activeTagsEditor.expenseId)
      if (!anchorElement?.isConnected) {
        closeTagsEditor()
        return
      }
      updateTagsEditorPosition(anchorElement)
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [activeTagsEditor, closeTagsEditor, updateTagsEditorPosition])

  useEffect(() => {
    if (!activeTagsEditor) return
    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (tagsEditorRef.current?.contains(event.target as Node)) return
      if (
        event.target instanceof Element &&
        event.target.closest('[data-editable-cell], [data-split-editable-display]')
      ) {
        return
      }
      cancelTagsEditor()
    }
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cancelTagsEditor()
    }
    document.addEventListener('pointerdown', handleDocumentPointerDown, true)
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [activeTagsEditor, cancelTagsEditor])

  useEffect(() => {
    return () => {
      clearPendingExpenseCellSwitch()
      clearPendingSplitFieldSwitch()
      clearPendingSplitAmountSwitch()
    }
  }, [
    clearPendingExpenseCellSwitch,
    clearPendingSplitAmountSwitch,
    clearPendingSplitFieldSwitch,
  ])

  const contextMenuItems = useMemo(() => {
    if (!menu) return []
    if (activeSplitTargetId != null) {
      return [
        {
          label: 'Edit split transaction',
          onClick: () => openSplitEditor(activeSplitTargetId),
        },
        {
          label: 'Unsplit transaction',
          onClick: () => void handleUnsplit(activeSplitTargetId),
          danger: true,
        },
      ]
    }
    if (activeSplitChildTargetId != null) {
      return [
        {
          label: 'Edit',
          onClick: () => handleEditRequest([activeSplitChildTargetId]),
        },
        {
          label: 'Copy',
          onClick: () => void handleCopyRequest([activeSplitChildTargetId]),
        },
        {
          label: 'Delete',
          onClick: () => handleDeleteRequest([activeSplitChildTargetId]),
          danger: true,
        },
        {
          label: 'Unsplit allocation',
          onClick: () => void handleUnsplitChild(activeSplitChildTargetId),
        },
      ]
    }
    const ids =
      selectedIds.size > 1 && selectedIds.has(menu.expenseId)
        ? Array.from(selectedIds)
        : [menu.expenseId]
    const isMulti = ids.length > 1
    const items: {
      label: string
      onClick: () => void
      disabled?: boolean
      danger?: boolean
    }[] = []

    items.push({
      label: isMulti ? `Edit ${ids.length} rows` : 'Edit',
      onClick: () => handleEditRequest(ids),
    })

    items.push({
      label: isMulti ? `Copy ${ids.length} rows` : 'Copy',
      onClick: () => void handleCopyRequest(ids),
    })

    items.push({
      label: isMulti ? `Delete ${ids.length} rows` : 'Delete',
      onClick: () => handleDeleteRequest(ids),
      danger: true,
    })

    return items
  }, [
    menu,
    activeSplitTargetId,
    selectedIds,
    handleDeleteRequest,
    handleEditRequest,
    handleCopyRequest,
    openSplitEditor,
    handleUnsplit,
    activeSplitChildTargetId,
    handleUnsplitChild,
  ])

  const bulkEditExpenses = useMemo(
    () => expenses.filter((expense) => bulkEditTargetIds.includes(expense.id as number)),
    [expenses, bulkEditTargetIds],
  )

  const handleBulkEditApply = useCallback(
    async (changes: Partial<Expense>) => {
      await Promise.all(bulkEditTargetIds.map((id) => Promise.resolve(onUpdate(id, changes))))
    },
    [bulkEditTargetIds, onUpdate],
  )

  const columns = useMemo(
    () =>
      getExpenseColumns({
        selectedIds,
        onToggleSelect,
        onToggleSelectAll,
        onToggleSplitParentSelect: toggleSplitParentSelection,
        allSelected,
        editing: {
          ...editing,
          switchCellEdit: switchExpenseCellEdit,
        },
        onEnterNavigation: handleTableEnterNavigation,
        onTabNavigation: handleTableTabNavigation,
        formatDate,
        formatAmount,
        catMap,
        activeCategories,
        activePayees,
        payeeMap,
        expenseTagsMap,
        showNotesColumn,
        showTagsColumn,
        onToggleSplitExpanded: resolvedOnToggleSplitParentExpanded,
        isSplitExpanded: resolvedIsSplitParentExpanded,
        isSplitParentSelected: (splitId) => {
          const childIds = splitChildIdsBySplitId.get(splitId) ?? []
          return childIds.length > 0 && childIds.every((id) => selectedIds.has(id))
        },
        editingSplitField,
        onStartSplitFieldEdit: handleStartSplitFieldEdit,
        onCommitSplitDateEdit: handleCommitSplitDateEdit,
        onCommitSplitPayeeEdit: handleCommitSplitPayeeEdit,
        onCommitSplitNotesEdit: handleCommitSplitNotesEdit,
        onCancelSplitFieldEdit: handleCancelSplitFieldEdit,
        editingSplitAmount,
        onStartSplitContainerAmountEdit: handleStartSplitContainerAmountEdit,
        onStartSplitChildAmountEdit: handleStartSplitChildAmountEdit,
        onCommitSplitContainerAmountEdit: handleCommitSplitContainerAmountEdit,
        onCommitSplitChildAmountEdit: handleCommitSplitChildAmountEdit,
        onCancelSplitAmountEdit: handleCancelSplitAmountEdit,
        pendingSplitAmountEdit,
        isReadOnlyActiveCell: (row, field) =>
          activeReadOnlyCell?.rowId === row.rowId && activeReadOnlyCell.field === field,
        refreshCategories,
        refreshPayees,
      }),
    [
      selectedIds,
      onToggleSelect,
      onToggleSelectAll,
      toggleSplitParentSelection,
      allSelected,
      editing,
      switchExpenseCellEdit,
      handleTableEnterNavigation,
      handleTableTabNavigation,
      formatDate,
      formatAmount,
      catMap,
      activeCategories,
      activePayees,
      payeeMap,
      expenseTagsMap,
      showNotesColumn,
      showTagsColumn,
      resolvedOnToggleSplitParentExpanded,
      resolvedIsSplitParentExpanded,
      splitChildIdsBySplitId,
      editingSplitField,
      handleStartSplitFieldEdit,
      handleCommitSplitDateEdit,
      handleCommitSplitPayeeEdit,
      handleCommitSplitNotesEdit,
      handleCancelSplitFieldEdit,
      editingSplitAmount,
      handleStartSplitContainerAmountEdit,
      handleStartSplitChildAmountEdit,
      handleCommitSplitContainerAmountEdit,
      handleCommitSplitChildAmountEdit,
      handleCancelSplitAmountEdit,
      pendingSplitAmountEdit,
      activeReadOnlyCell,
      refreshCategories,
      refreshPayees,
    ],
  )

  const getRowClassName = useCallback(
    (row: ExpenseDisplayRow) => {
      if (row.rowType === 'splitContainer') {
        const childIds = splitChildIdsBySplitId.get(row.splitId) ?? []
        const isSelected = childIds.length > 0 && childIds.every((id) => selectedIds.has(id))
        return cn(isSelected && 'selected-row', 'row-hover')
      }
      const isSelected = selectedIds.has(row.expense.id as number)
      return cn(
        isSelected && 'selected-row',
        'row-hover',
        row.rowType === 'splitChild' && 'opacity-90',
      )
    },
    [selectedIds, splitChildIdsBySplitId],
  )

  const mobileSplitContext = useMemo(() => {
    if (selectedIds.size === 0) {
      return {
        singleSplitParentContext: null as number | null,
        singleSplitChildContext: null as number | null,
      }
    }

    const selectedIdArray = Array.from(selectedIds)
    let singleSplitParentContext: number | null = null
    splitChildIdsBySplitId.forEach((childIds, splitId) => {
      if (childIds.length === 0 || childIds.length !== selectedIdArray.length) return
      const fullMatch = childIds.every((id) => selectedIds.has(id))
      if (fullMatch) singleSplitParentContext = splitId
    })
    if (singleSplitParentContext != null) {
      return { singleSplitParentContext, singleSplitChildContext: null as number | null }
    }

    if (selectedIdArray.length === 1 && splitChildIds.has(selectedIdArray[0])) {
      return {
        singleSplitParentContext: null as number | null,
        singleSplitChildContext: selectedIdArray[0],
      }
    }

    return {
      singleSplitParentContext: null as number | null,
      singleSplitChildContext: null as number | null,
    }
  }, [selectedIds, splitChildIdsBySplitId, splitChildIds])

  useEffect(() => {
    if (!onMobileExtraMenuActionsChange) return
    if (!isMobile || selectedIds.size === 0) {
      onMobileExtraMenuActionsChange([])
      return
    }

    const actions: Array<{ label: string; onClick: () => void; danger?: boolean }> = []
    if (mobileSplitContext.singleSplitParentContext != null) {
      const splitId = mobileSplitContext.singleSplitParentContext
      actions.push({
        label: 'Unsplit transaction',
        onClick: () => void handleUnsplit(splitId),
        danger: true,
      })
    } else if (mobileSplitContext.singleSplitChildContext != null) {
      const expenseId = mobileSplitContext.singleSplitChildContext
      actions.push({
        label: 'Unsplit allocation',
        onClick: () => void handleUnsplitChild(expenseId),
      })
    }
    onMobileExtraMenuActionsChange(actions)
  }, [
    onMobileExtraMenuActionsChange,
    isMobile,
    selectedIds,
    mobileSplitContext,
    handleUnsplit,
    handleUnsplitChild,
  ])

  useEffect(() => {
    if (!onMobileSplitParentSelectionChange) return
    if (!isMobile || selectedIds.size === 0) {
      onMobileSplitParentSelectionChange(null)
      return
    }
    onMobileSplitParentSelectionChange(mobileSplitContext.singleSplitParentContext)
  }, [onMobileSplitParentSelectionChange, isMobile, selectedIds, mobileSplitContext])

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12" data-testid="expense-table-empty">
        <p className="text-sm text-theme-muted">
          No expenses yet. Hit <strong className="text-theme-primary">+</strong> to add one.
        </p>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-3" data-testid="expense-table">
      {isMobile ? (
        <ExpenseTableMobile
          expenses={expenses}
          displayRows={displayRows}
          expenseTagsMap={expenseTagsMap}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onCellEdit={(exp) => editing.startCellEdit(exp, 'notes')}
          onSplitParentEdit={openSplitEditor}
          onToggleSplitParentSelect={toggleSplitParentSelection}
          isSplitParentSelected={(splitId) => {
            const childIds = splitChildIdsBySplitId.get(splitId) ?? []
            return childIds.length > 0 && childIds.every((id) => selectedIds.has(id))
          }}
          onToggleSplitExpanded={resolvedOnToggleSplitParentExpanded}
          isSplitExpanded={resolvedIsSplitParentExpanded}
          formatDate={formatDate}
          formatAmount={formatAmount}
          resolveName={resolveName}
          resolvePayeeName={(exp) => {
            const p = payeeMap[exp.payeeId as number]
            return p ? p.name : 'No payee'
          }}
        />
      ) : (
        <DashboardDataTable
          data={displayRows}
          columns={columns}
          fixedLayout
          headerCellClassName="px-2"
          bodyCellClassName="px-2"
          removeLastRowBottomBorder
          getRowClassName={getRowClassName}
          getRowTestId={(row) => row.rowId}
          onRowContextMenu={handleContextMenu}
        />
      )}

      {showMobileEditModal && mobileEditExpense && (
        <ExpenseForm
          initialExpense={mobileEditExpense}
          onUpdate={onUpdate}
          onClose={cancelMobileEdit}
          categories={categories}
          refreshCategories={refreshCategories}
          refreshPayees={refreshPayees}
        />
      )}

      {showBulkEditModal && (
        <Suspense
          fallback={
            <LazyModalFallback
              title={`Edit ${bulkEditTargetIds.length} Expenses`}
              size="lg"
              message="Loading bulk editor…"
              onClose={closeBulkEditModal}
            />
          }
        >
          <BulkEditExpensesModal
            isOpen={showBulkEditModal}
            selectedExpenses={bulkEditExpenses}
            categories={categories}
            payees={payees}
            onClose={closeBulkEditModal}
            onApply={handleBulkEditApply}
            refreshCategories={refreshCategories}
            refreshPayees={refreshPayees}
          />
        </Suspense>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Confirm Delete"
        description={
          <span className="text-sm text-theme-muted">
            Are you sure you want to delete{' '}
            <strong className="text-theme-text">{deleteTargetIds.length}</strong> expense
            {deleteTargetIds.length !== 1 ? 's' : ''}?
          </span>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={confirmDelete}
      />

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={contextMenuItems}
          onClose={closeContextMenu}
          menuRef={menuRef}
        />
      )}
      <TagsEditorPopover
        isMobile={isMobile}
        activeTagsEditor={activeTagsEditor}
        tagsEditorPosition={tagsEditorPosition}
        tagsEditorRef={tagsEditorRef}
        activeTags={activeTags}
        isSavingTagsEditor={isSavingTagsEditor}
        onChange={handleTagsEditorChange}
        onCreate={handleCreateTagFromEditor}
        onCancel={cancelTagsEditor}
        onSave={handleSaveTagsEditor}
        onEnter={handleTagsEnterNavigation}
        onTab={handleTagsTabNavigation}
      />
      <SplitBalancePopover
        isOpen={Boolean(pendingSplitAmountEdit)}
        position={splitBalancePopoverPosition}
        popoverRef={splitBalancePopoverRef}
        remainingAmount={pendingSplitAmountEdit?.remainingAmount ?? 0}
        targetRows={(pendingSplitAmountEdit?.targetPreviews ?? []).map((preview) => ({
          ...preview,
          label: (() => {
            const target = expenses.find((expense) => expense.id === preview.expenseId)
            return target ? resolveName(target) : 'Expense'
          })(),
        }))}
        formatAmount={formatAmount}
        onApplyToChild={handleApplySplitRemainingToChild}
        totalRow={
          pendingSplitAmountEdit?.kind === 'splitChild'
            ? {
                currentAmount: pendingSplitAmountEdit.containerAmount,
                resultingAmount: pendingSplitAmountEdit.pendingChildrenTotal,
              }
            : undefined
        }
        onApplyToTotal={
          pendingSplitAmountEdit?.kind === 'splitChild' ? handleApplySplitBalanceTotal : undefined
        }
      />
    </div>
  )
})

export default ExpenseTable
