import {
  Suspense,
  forwardRef,
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LazyModalFallback from '../../components/ui/LazyModalFallback'
import ContextMenu from './components/ContextMenu'
import DataTable from './components/DataTable'
import { useSettings } from '../../context/settingsContext'
import { useToasts } from '../../context/toastContext'
import { useContextMenu } from './hooks/useContextMenu'
import ExpenseForm from '../expenses/ExpenseForm'
import type { Category, Expense, Payee } from '../../types'
import { cn } from '../../utils/cn'
import { copyExpensesToClipboard } from '../../utils/copyExpenses'
import ExpenseTableMobile from './ExpenseTableMobile'
import { getExpenseColumns } from './expenseColumns'
import {
  buildExpenseDisplayRows,
  getEffectiveSplitParentExpanded,
  type ExpenseDisplayRow,
} from './splitDisplayRows'
import { useExpenseCellEditing } from './useExpenseCellEditing'
import { StorageService } from '../../services/storageService'

const BulkEditExpensesModal = lazy(() => import('./BulkEditExpensesModal'))

type EditableSplitField = 'date' | 'payeeId' | 'description'

interface EditingSplitField {
  splitId: number
  field: EditableSplitField
}

interface ExpenseTableProps {
  expenses: Expense[]
  onUpdate: (id: number, changes: Partial<Expense>) => void
  onDelete: (id: number) => void
  onBulkDelete?: (ids: number[]) => void
  categories?: Category[]
  payees?: Payee[]
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  onToggleSelectAll: () => void
  isMobile?: boolean
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
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    isMobile = false,
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
  const [splits, setSplits] = useState<Awaited<ReturnType<typeof StorageService.getExpenseSplits>>>([])
  const editingSplitFieldRef = useRef<EditingSplitField | null>(null)
  const pendingSplitFieldSwitchRef = useRef<EditingSplitField | null>(null)
  const pendingSplitFieldTimeoutRef = useRef<number | null>(null)
  const splitFieldCommitInFlightRef = useRef<Set<string>>(new Set())

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const payeeMap = useMemo(() => Object.fromEntries(payees.map((p) => [p.id, p])), [payees])
  const activeCategories = useMemo(() => categories.filter((c) => !c.isArchived), [categories])
  const activePayees = useMemo(() => payees.filter((p) => !p.isArchived), [payees])
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
      childIds.forEach((id) => ids.add(id))
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
    selectedIds,
    onToggleSelect,
    setMobileEditExpense: openExpenseEditor,
    setShowMobileEditModal,
  })

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

  const handleUnsplit = useCallback(async (splitId: number) => {
    try {
      await StorageService.unsplitExpenseSplit(splitId)
      await refreshExpenses?.()
      triggerSync?.()
      showToast({ message: 'Transaction unsplit', tone: 'success' })
    } catch (error) {
      console.error('Failed to unsplit transaction:', error)
      showToast({ message: 'Could not unsplit transaction.', tone: 'danger' })
    }
  }, [refreshExpenses, showToast, triggerSync])

  const handleUnsplitChild = useCallback(async (expenseId: number) => {
    try {
      await StorageService.unsplitSplitChildExpense(expenseId)
      await refreshExpenses?.()
      triggerSync?.()
      showToast({ message: 'Split allocation unsplit', tone: 'success' })
    } catch (error) {
      console.error('Failed to unsplit split allocation:', error)
      showToast({ message: 'Could not unsplit split allocation.', tone: 'danger' })
    }
  }, [refreshExpenses, showToast, triggerSync])

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
      const nextField: EditingSplitField = { splitId, field }
      const currentField = editingSplitFieldRef.current

      if (currentField?.splitId === splitId && currentField.field === field) return

      if (currentField == null) {
        clearPendingSplitFieldSwitch()
        activateSplitFieldEdit(nextField)
        return
      }

      clearPendingSplitFieldSwitch()
      pendingSplitFieldSwitchRef.current = nextField

      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement) {
        activeElement.blur()
      }

      pendingSplitFieldTimeoutRef.current = window.setTimeout(() => {
        const pendingField = pendingSplitFieldSwitchRef.current
        if (pendingField?.splitId !== splitId || pendingField.field !== field) {
          return
        }
        activateSplitFieldEdit(nextField)
        clearPendingSplitFieldSwitch()
      }, 0)
    },
    [activateSplitFieldEdit, clearPendingSplitFieldSwitch],
  )

  const handleCancelSplitFieldEdit = useCallback(() => {
    clearPendingSplitFieldSwitch()
    setEditingSplitField(null)
    editingSplitFieldRef.current = null
  }, [clearPendingSplitFieldSwitch])

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
      clearPendingSplitFieldSwitch()
      finishSplitFieldCommit(splitId, field)
      return true
    },
    [clearPendingSplitFieldSwitch, finishSplitFieldCommit],
  )

  const endSplitFieldCommit = useCallback((splitId: number, field: EditableSplitField) => {
    splitFieldCommitInFlightRef.current.delete(`${splitId}:${field}`)
  }, [])

  const handleCommitSplitDescriptionEdit = useCallback(
    async (splitId: number, value: string) => {
      if (!beginSplitFieldCommit(splitId, 'description')) return
      const description = value.trim()
      try {
        await StorageService.updateExpenseSplit(splitId, { description })
        updateLocalSplit(splitId, { description })
      } catch (error) {
        console.error('Failed to update split description:', error)
        showToast({ message: 'Could not update split description.', tone: 'danger' })
      } finally {
        endSplitFieldCommit(splitId, 'description')
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
      const nextPayee = typeof payeeId === 'number' ? payees.find((payee) => payee.id === payeeId) : null
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
    [beginSplitFieldCommit, endSplitFieldCommit, payees, refreshExpenses, showToast, updateLocalSplit],
  )

  useEffect(() => {
    return () => {
      clearPendingSplitFieldSwitch()
    }
  }, [clearPendingSplitFieldSwitch])

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
        allSelected,
        editing,
        formatDate,
        formatAmount,
        catMap,
        activeCategories,
        activePayees,
        payeeMap,
        onToggleSplitExpanded: resolvedOnToggleSplitParentExpanded,
        isSplitExpanded: resolvedIsSplitParentExpanded,
        editingSplitField,
        onStartSplitFieldEdit: handleStartSplitFieldEdit,
        onCommitSplitDateEdit: handleCommitSplitDateEdit,
        onCommitSplitPayeeEdit: handleCommitSplitPayeeEdit,
        onCommitSplitDescriptionEdit: handleCommitSplitDescriptionEdit,
        onCancelSplitFieldEdit: handleCancelSplitFieldEdit,
        refreshCategories,
        refreshPayees,
      }),
    [
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
      resolvedOnToggleSplitParentExpanded,
      resolvedIsSplitParentExpanded,
      editingSplitField,
      handleStartSplitFieldEdit,
      handleCommitSplitDateEdit,
      handleCommitSplitPayeeEdit,
      handleCommitSplitDescriptionEdit,
      handleCancelSplitFieldEdit,
      refreshCategories,
      refreshPayees,
    ],
  )

  const getRowClassName = useCallback(
    (row: ExpenseDisplayRow) => {
      if (row.rowType === 'splitContainer') return 'row-hover'
      const isSelected = selectedIds.has(row.expense.id as number)
      return cn(isSelected && 'selected-row', 'row-hover', row.rowType === 'splitChild' && 'opacity-90')
    },
    [selectedIds],
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
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onCellEdit={(exp) => editing.startCellEdit(exp, 'description')}
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
        <DataTable
          data={displayRows}
          columns={columns}
          fixedLayout
          getRowClassName={getRowClassName}
          getRowId={(row) => row.rowId}
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
    </div>
  )
})

export default ExpenseTable
