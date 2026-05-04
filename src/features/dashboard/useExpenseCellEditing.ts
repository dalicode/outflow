import { useState, useCallback, useRef } from "react";
import type { Expense } from "../../types";

type EditableField =
  | "date"
  | "amount"
  | "categoryId"
  | "payeeId"
  | "description";

interface EditingCell {
  expenseId: number;
  field: EditableField;
}

const FIELD_ORDER: EditableField[] = [
  "date",
  "categoryId",
  "payeeId",
  "description",
  "amount",
];

function validateField(field: EditableField, value: unknown): string | null {
  if (field === "amount") {
    const str = String(value ?? "").trim();
    if (str === "") return null;
    if (isNaN(parseFloat(str))) return "Invalid amount";
    return null;
  }
  return null;
}

export interface CellEditingAPI {
  editingCell: EditingCell | null;
  validationError: string | null;
  switchCellEdit: (expense: Expense, field: EditableField) => void;
  startCellEdit: (expense: Expense, field: EditableField) => void;
  cancelCurrentCellEdit: () => void;
  isCellEditing: (expenseId: number, field: EditableField) => boolean;
  createOnCommit: (
    expenseId: number,
    field: EditableField,
    options?: { stayInEdit?: boolean },
  ) => (value: unknown) => void;
  createOnCancel: () => () => void;
  handleTabNavigation: (
    expense: Expense,
    field: EditableField,
    shiftKey: boolean,
  ) => void;
  validateField: (field: EditableField, value: unknown) => string | null;
  setPendingName: (
    expenseId: number,
    field: EditableField,
    name: string,
  ) => void;
  getPendingName: (expenseId: number, field: EditableField) => string | null;
}

interface UseExpenseCellEditingParams {
  expenses: Expense[];
  onUpdate: (id: number, changes: Partial<Expense>) => void;
  optimistic: Record<number, Partial<Expense>>;
  setOptimistic: React.Dispatch<
    React.SetStateAction<Record<number, Partial<Expense>>>
  >;
  isMobile: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  setMobileEditExpense: (expense: Expense | null) => void;
  setShowMobileEditModal: (show: boolean) => void;
}

export function useExpenseCellEditing({
  expenses,
  onUpdate,
  optimistic: _optimistic,
  setOptimistic,
  isMobile,
  selectedIds,
  onToggleSelect,
  setMobileEditExpense,
  setShowMobileEditModal,
}: UseExpenseCellEditingParams): CellEditingAPI {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pendingNames, setPendingNames] = useState<Record<string, string>>({});

  const editingCellRef = useRef<EditingCell | null>(null);
  const pendingSwitchRef = useRef<EditingCell | null>(null);
  const expensesRef = useRef<Expense[]>(expenses);

  editingCellRef.current = editingCell;
  expensesRef.current = expenses;

  const pendingNameKey = (expenseId: number, field: EditableField) =>
    `${expenseId}:${field}`;

  const setPendingName = useCallback(
    (expenseId: number, field: EditableField, name: string) => {
      setPendingNames((prev) => ({
        ...prev,
        [pendingNameKey(expenseId, field)]: name,
      }));
    },
    [],
  );

  const getPendingName = useCallback(
    (expenseId: number, field: EditableField): string | null => {
      return pendingNames[pendingNameKey(expenseId, field)] ?? null;
    },
    [pendingNames],
  );

  const startCellEdit = useCallback(
    (expense: Expense, field: EditableField) => {
      if (isMobile && selectedIds.size > 0) {
        onToggleSelect(expense.id as number);
        return;
      }
      if (isMobile) {
        setMobileEditExpense(expense);
        setShowMobileEditModal(true);
        return;
      }
      const cell: EditingCell = {
        expenseId: expense.id as number,
        field,
      };
      setEditingCell(cell);
      editingCellRef.current = cell;
      setValidationError(null);
      setPendingNames({});
    },
    [
      isMobile,
      selectedIds,
      onToggleSelect,
      setMobileEditExpense,
      setShowMobileEditModal,
    ],
  );

  const cancelCurrentCellEdit = useCallback(() => {
    setEditingCell(null);
    editingCellRef.current = null;
    setValidationError(null);
    pendingSwitchRef.current = null;
    setPendingNames({});
  }, []);

  const switchCellEdit = useCallback(
    (nextExpense: Expense, nextField: EditableField) => {
      const nextCell: EditingCell = {
        expenseId: nextExpense.id as number,
        field: nextField,
      };
      const current = editingCellRef.current;

      if (!current) {
        startCellEdit(nextExpense, nextField);
        return;
      }

      if (
        current.expenseId === nextCell.expenseId &&
        current.field === nextCell.field
      ) {
        return;
      }

      if (current.field === "amount") {
        const active = document.activeElement;
        const draftValue =
          active instanceof HTMLInputElement ? active.value : null;
        if (draftValue !== null) {
          const error = validateField("amount", draftValue);
          if (error) {
            setValidationError(error);
            if (active instanceof HTMLElement) {
              active.focus();
            }
            return;
          }
        }
      }

      pendingSwitchRef.current = nextCell;

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      setValidationError(null);
      setEditingCell(nextCell);
      editingCellRef.current = nextCell;

      setTimeout(() => {
        pendingSwitchRef.current = null;
      }, 150);
    },
    [startCellEdit],
  );

  const isCellEditing = useCallback(
    (expenseId: number, field: EditableField) => {
      return (
        editingCell?.expenseId === expenseId && editingCell?.field === field
      );
    },
    [editingCell],
  );

  const createOnCommit = useCallback(
    (
      expenseId: number,
      field: EditableField,
      options?: { stayInEdit?: boolean },
    ) => {
      return (value: unknown) => {
        console.log("Committing edit:", { expenseId, field, value });
        onUpdate(expenseId, { [field]: value } as Partial<Expense>);
        setOptimistic((prev) => ({
          ...prev,
          [expenseId]: { ...prev[expenseId], [field]: value },
        }));

        if (options?.stayInEdit) return;

        const isCurrentEdit =
          editingCellRef.current?.expenseId === expenseId &&
          editingCellRef.current?.field === field;

        if (isCurrentEdit && !pendingSwitchRef.current) {
          setEditingCell(null);
          editingCellRef.current = null;
          setValidationError(null);
        }
      };
    },
    [onUpdate, setOptimistic],
  );

  const createOnCancel = useCallback(() => {
    return () => {
      if (pendingSwitchRef.current) return;
      setEditingCell(null);
      editingCellRef.current = null;
      setValidationError(null);
    };
  }, []);

  const handleTabNavigation = useCallback(
    (expense: Expense, field: EditableField, shiftKey: boolean) => {
      const idx = FIELD_ORDER.indexOf(field);
      const rowIdx = expensesRef.current.findIndex(
        (ex) => ex.id === expense.id,
      );

      if (shiftKey) {
        if (idx > 0) {
          switchCellEdit(expense, FIELD_ORDER[idx - 1]);
        } else if (rowIdx > 0) {
          const prevExpense = expensesRef.current[rowIdx - 1];
          switchCellEdit(prevExpense, "amount");
        } else {
          cancelCurrentCellEdit();
        }
      } else {
        if (idx < FIELD_ORDER.length - 1) {
          switchCellEdit(expense, FIELD_ORDER[idx + 1]);
        } else if (rowIdx < expensesRef.current.length - 1) {
          const nextExpense = expensesRef.current[rowIdx + 1];
          switchCellEdit(nextExpense, "date");
        } else {
          cancelCurrentCellEdit();
        }
      }
    },
    [switchCellEdit, cancelCurrentCellEdit],
  );

  return {
    editingCell,
    validationError,
    switchCellEdit,
    startCellEdit,
    cancelCurrentCellEdit,
    isCellEditing,
    createOnCommit,
    createOnCancel,
    handleTabNavigation,
    validateField,
    setPendingName,
    getPendingName,
  };
}
