import { useCallback, useRef, useState } from 'react'
import type { Expense } from '../../types'

type EditableField = 'date' | 'amount' | 'categoryId' | 'payeeId' | 'notes' | 'tags'

interface EditingCell {
  expenseId: number
  field: EditableField
}

function validateField(field: EditableField, value: unknown): string | null {
  if (field === 'amount') {
    const str = String(value ?? '').trim()
    if (str === '') return null
    const normalized = str.replace(/[^0-9.-]/g, '')
    if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') {
      return 'Invalid amount'
    }
    if (Number.isNaN(Number(normalized))) return 'Invalid amount'
    return null
  }
  return null
}

export interface CellEditingAPI {
  editingCell: EditingCell | null
  validationError: string | null
  switchCellEdit: (expense: Expense, field: EditableField) => void
  startCellEdit: (expense: Expense, field: EditableField) => void
  cancelCurrentCellEdit: () => void
  isCellEditing: (expenseId: number, field: EditableField) => boolean
  createOnCommit: (
    expenseId: number,
    field: EditableField,
    options?: { stayInEdit?: boolean },
  ) => (value: unknown) => void
  createOnCancel: () => () => void
  handleEnterNavigation: (expense: Expense, field: EditableField, shiftKey: boolean) => void
  handleTabNavigation: (expense: Expense, field: EditableField, shiftKey: boolean) => void
  validateField: (field: EditableField, value: unknown) => string | null
  setPendingName: (expenseId: number, field: EditableField, name: string) => void
  getPendingName: (expenseId: number, field: EditableField) => string | null
  shouldAutoOpenEditor: (expenseId: number, field: EditableField) => boolean
  isFieldEditable: (expense: Expense, field: EditableField) => boolean
}

interface UseExpenseCellEditingParams {
  expenses: Expense[]
  onUpdate: (id: number, changes: Partial<Expense>) => void
  isMobile: boolean
  showNotesColumn?: boolean
  showTagsColumn?: boolean
  selectedIds: Set<number>
  onToggleSelect: (id: number) => void
  setMobileEditExpense: (expense: Expense | null) => void
  setShowMobileEditModal: (show: boolean) => void
}

export function useExpenseCellEditing({
  expenses,
  onUpdate,
  isMobile,
  showNotesColumn = true,
  showTagsColumn = true,
  selectedIds,
  onToggleSelect,
  setMobileEditExpense,
  setShowMobileEditModal,
}: UseExpenseCellEditingParams): CellEditingAPI {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [autoOpenCell, setAutoOpenCell] = useState<EditingCell | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pendingNames, setPendingNames] = useState<Record<string, string>>({})

  const editingCellRef = useRef<EditingCell | null>(null)
  const pendingSwitchRef = useRef<EditingCell | null>(null)
  const pendingSwitchTimeoutRef = useRef<number | null>(null)
  const expensesRef = useRef<Expense[]>(expenses)

  editingCellRef.current = editingCell
  expensesRef.current = expenses

  const pendingNameKey = useCallback(
    (expenseId: number, field: EditableField) => `${expenseId}:${field}`,
    [],
  )

  const clearPendingSwitch = useCallback(() => {
    pendingSwitchRef.current = null
    if (pendingSwitchTimeoutRef.current != null) {
      window.clearTimeout(pendingSwitchTimeoutRef.current)
      pendingSwitchTimeoutRef.current = null
    }
  }, [])

  const activateCell = useCallback((cell: EditingCell) => {
    setValidationError(null)
    setEditingCell(cell)
    setAutoOpenCell(cell)
    editingCellRef.current = cell
  }, [])

  const resetEditingState = useCallback(() => {
    setEditingCell(null)
    setAutoOpenCell(null)
    editingCellRef.current = null
    setValidationError(null)
    clearPendingSwitch()
    setPendingNames({})
  }, [clearPendingSwitch])

  const closeInlineEditingForModal = useCallback(() => {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) {
      activeElement.blur()
    }
    resetEditingState()
  }, [resetEditingState])

  const isFieldEditable = useCallback((expense: Expense, field: EditableField): boolean => {
    if (field === 'date' && typeof expense.splitId === 'number') {
      return false
    }
    if (field === 'amount' && typeof expense.splitId === 'number') {
      return false
    }
    return true
  }, [])

  const setPendingName = useCallback(
    (expenseId: number, field: EditableField, name: string) => {
      setPendingNames((prev) => ({
        ...prev,
        [pendingNameKey(expenseId, field)]: name,
      }))
    },
    [pendingNameKey],
  )

  const getPendingName = useCallback(
    (expenseId: number, field: EditableField): string | null => {
      return pendingNames[pendingNameKey(expenseId, field)] ?? null
    },
    [pendingNames, pendingNameKey],
  )

  const startCellEdit = useCallback(
    (expense: Expense, field: EditableField) => {
      if (field === 'amount' && typeof expense.splitId === 'number') {
        closeInlineEditingForModal()
        setMobileEditExpense(expense)
        setShowMobileEditModal(true)
        return
      }
      if (!isFieldEditable(expense, field)) {
        return
      }
      if (isMobile && selectedIds.size > 0) {
        onToggleSelect(expense.id as number)
        return
      }
      if (isMobile) {
        closeInlineEditingForModal()
        setMobileEditExpense(expense)
        setShowMobileEditModal(true)
        return
      }
      const cell: EditingCell = {
        expenseId: expense.id as number,
        field,
      }
      clearPendingSwitch()
      activateCell(cell)
      setPendingNames({})
    },
    [
      activateCell,
      clearPendingSwitch,
      isFieldEditable,
      isMobile,
      selectedIds,
      onToggleSelect,
      setMobileEditExpense,
      setShowMobileEditModal,
      closeInlineEditingForModal,
    ],
  )

  const cancelCurrentCellEdit = useCallback(() => {
    resetEditingState()
  }, [resetEditingState])

  const switchCellEdit = useCallback(
    (nextExpense: Expense, nextField: EditableField) => {
      if (!isFieldEditable(nextExpense, nextField)) {
        return
      }
      const nextCell: EditingCell = {
        expenseId: nextExpense.id as number,
        field: nextField,
      }
      const current = editingCellRef.current

      if (!current) {
        startCellEdit(nextExpense, nextField)
        return
      }

      if (current.expenseId === nextCell.expenseId && current.field === nextCell.field) {
        return
      }

      if (current.field === 'amount') {
        const active = document.activeElement
        const draftValue = active instanceof HTMLInputElement ? active.value : null
        if (draftValue !== null) {
          const error = validateField('amount', draftValue)
          if (error) {
            setValidationError(error)
            if (active instanceof HTMLElement) {
              active.focus()
            }
            return
          }
        }
      }

      clearPendingSwitch()
      pendingSwitchRef.current = nextCell

      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement) {
        activeElement.blur()
      }

      pendingSwitchTimeoutRef.current = window.setTimeout(() => {
        if (
          pendingSwitchRef.current?.expenseId !== nextCell.expenseId ||
          pendingSwitchRef.current?.field !== nextField
        ) {
          return
        }
        activateCell(nextCell)
        clearPendingSwitch()
      }, 0)
    },
    [activateCell, clearPendingSwitch, isFieldEditable, startCellEdit],
  )

  const isCellEditing = useCallback(
    (expenseId: number, field: EditableField) => {
      return editingCell?.expenseId === expenseId && editingCell?.field === field
    },
    [editingCell],
  )

  const shouldAutoOpenEditor = useCallback(
    (expenseId: number, field: EditableField) => {
      return autoOpenCell?.expenseId === expenseId && autoOpenCell.field === field
    },
    [autoOpenCell],
  )

  const createOnCommit = useCallback(
    (expenseId: number, field: EditableField, options?: { stayInEdit?: boolean }) => {
      return (value: unknown) => {
        if (options?.stayInEdit) {
          setAutoOpenCell(null)
        }

        onUpdate(expenseId, { [field]: value } as Partial<Expense>)

        if (options?.stayInEdit) return

        const isCurrentEdit =
          editingCellRef.current?.expenseId === expenseId && editingCellRef.current?.field === field

        if (isCurrentEdit && !pendingSwitchRef.current) {
          setEditingCell(null)
          setAutoOpenCell(null)
          editingCellRef.current = null
          setValidationError(null)
        }
      }
    },
    [onUpdate],
  )

  const createOnCancel = useCallback(() => {
    return () => {
      if (pendingSwitchRef.current) return
      resetEditingState()
    }
  }, [resetEditingState])

  const handleEnterNavigation = useCallback(
    (expense: Expense, field: EditableField, shiftKey: boolean) => {
      const rowIdx = expensesRef.current.findIndex((ex) => ex.id === expense.id)
      if (rowIdx === -1) {
        cancelCurrentCellEdit()
        return
      }

      const targetRowIdx = shiftKey ? rowIdx - 1 : rowIdx + 1
      if (targetRowIdx < 0 || targetRowIdx >= expensesRef.current.length) {
        cancelCurrentCellEdit()
        return
      }

      const targetExpense = expensesRef.current[targetRowIdx]
      startCellEdit(targetExpense, field)
    },
    [cancelCurrentCellEdit, startCellEdit],
  )

  const getFieldOrder = useCallback((): EditableField[] => {
    const order: EditableField[] = ['date', 'payeeId', 'categoryId']
    if (showNotesColumn) order.push('notes')
    if (showTagsColumn) order.push('tags')
    order.push('amount')
    return order
  }, [showNotesColumn, showTagsColumn])

  const handleTabNavigation = useCallback(
    (expense: Expense, field: EditableField, shiftKey: boolean) => {
      const fieldOrder = getFieldOrder()
      const idx = fieldOrder.indexOf(field)
      const rowIdx = expensesRef.current.findIndex((ex) => ex.id === expense.id)

      if (shiftKey) {
        if (idx > 0) {
          switchCellEdit(expense, fieldOrder[idx - 1])
        } else if (rowIdx > 0) {
          const prevExpense = expensesRef.current[rowIdx - 1]
          switchCellEdit(prevExpense, 'amount')
        } else {
          cancelCurrentCellEdit()
        }
      } else {
        if (idx < fieldOrder.length - 1) {
          switchCellEdit(expense, fieldOrder[idx + 1])
        } else if (rowIdx < expensesRef.current.length - 1) {
          const nextExpense = expensesRef.current[rowIdx + 1]
          switchCellEdit(nextExpense, 'date')
        } else {
          cancelCurrentCellEdit()
        }
      }
    },
    [cancelCurrentCellEdit, getFieldOrder, switchCellEdit],
  )

  return {
    editingCell,
    validationError,
    switchCellEdit,
    startCellEdit,
    cancelCurrentCellEdit,
    isCellEditing,
    createOnCommit,
    createOnCancel,
    handleEnterNavigation,
    handleTabNavigation,
    validateField,
    setPendingName,
    getPendingName,
    shouldAutoOpenEditor,
    isFieldEditable,
  }
}
