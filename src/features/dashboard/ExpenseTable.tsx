import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSettings } from "../../context/settingsContext";
import { useContextMenu } from "../../hooks/useContextMenu";
import { cn } from "../../utils/cn";
import DataTable from "../../components/ui/DataTable";
import ContextMenu from "../../components/ui/ContextMenu";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import ExpenseTableMobile from "./ExpenseTableMobile";
import { getExpenseColumns } from "./expenseColumns";
import type { Expense, Category } from "../../types";

interface ExpenseTableProps {
  expenses: Expense[];
  onUpdate: (id: number, changes: Partial<Expense>) => void;
  onDelete: (id: number) => void;
  onBulkDelete?: (ids: number[]) => void;
  categories?: Category[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  isMobile?: boolean;
  mobileEditTrigger?: number | null;
}

export default function ExpenseTable({
  expenses,
  onUpdate,
  onDelete,
  onBulkDelete,
  categories = [],
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isMobile = false,
  mobileEditTrigger,
}: ExpenseTableProps) {
  const { formatAmount, formatDate } = useSettings();
  const {
    menu,
    open: openContextMenu,
    close: closeContextMenu,
    menuRef,
  } = useContextMenu();

  // Editing
  const [editingCell, setEditingCell] = useState<{
    id: number;
    field: keyof Expense;
  } | null>(null);
  const [draft, setDraft] = useState<Partial<Expense>>({});
  const [showMobileEditModal, setShowMobileEditModal] = useState(false);
  const [mobileEditExpense, setMobileEditExpense] = useState<Expense | null>(
    null,
  );

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<number[]>([]);

  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );
  const activeCategories = useMemo(
    () => categories.filter((c) => !c.isDeleted),
    [categories],
  );

  useEffect(() => {
    if (mobileEditTrigger == null) return;
    const expense = expenses.find((e) => e.id === mobileEditTrigger);
    if (expense) {
      setMobileEditExpense(expense);
      setDraft({ ...expense });
      setShowMobileEditModal(true);
    }
  }, [mobileEditTrigger, expenses]);

  const resolveName = useCallback(
    (exp: Expense) => {
      const cat = catMap[exp.categoryId as number];
      if (cat) return cat.isDeleted ? `${cat.name} (deleted)` : cat.name;
      return exp.category || "Uncategorized";
    },
    [catMap],
  );

  const allSelected =
    expenses.length > 0 &&
    expenses.every((e) => selectedIds.has(e.id as number));

  const setField = useCallback(
    (field: keyof Expense) => (val: string | number) =>
      setDraft((d) => ({ ...d, [field]: val })),
    [],
  );

  const saveEdit = useCallback(() => {
    if (!editingCell && !mobileEditExpense) return;
    const targetId = (editingCell?.id ?? mobileEditExpense?.id) as number;
    const cat = catMap[draft.categoryId as number];
    onUpdate(targetId, {
      ...draft,
      amount:
        draft.amount != null ? parseFloat(String(draft.amount)) : undefined,
      category: cat?.name ?? draft.category,
    });
    setEditingCell(null);
    setDraft({});
    setShowMobileEditModal(false);
    setMobileEditExpense(null);
  }, [editingCell, mobileEditExpense, draft, catMap, onUpdate]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setDraft({});
    setShowMobileEditModal(false);
    setMobileEditExpense(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") saveEdit();
      if (e.key === "Escape") cancelEdit();
    },
    [saveEdit, cancelEdit],
  );

  const startCellEdit = useCallback(
    (expense: Expense, field: keyof Expense) => {
      if (isMobile && selectedIds.size > 0) {
        onToggleSelect(expense.id as number);
        return;
      }
      if (isMobile) {
        setMobileEditExpense(expense);
        setDraft({ ...expense });
        setShowMobileEditModal(true);
        return;
      }
      setEditingCell({ id: expense.id as number, field });
      setDraft({ ...expense });
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [isMobile, selectedIds, onToggleSelect],
  );

  const startRowEdit = useCallback(
    (expense: Expense) => {
      if (isMobile) {
        setMobileEditExpense(expense);
        setDraft({ ...expense });
        setShowMobileEditModal(true);
        return;
      }
      setEditingCell({ id: expense.id as number, field: "date" });
      setDraft({ ...expense });
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [isMobile],
  );

  const handleDeleteRequest = useCallback((ids: number[]) => {
    setDeleteTargetIds(ids);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTargetIds.length === 1) {
      onDelete(deleteTargetIds[0]);
    } else if (onBulkDelete) {
      onBulkDelete(deleteTargetIds);
    }
    setShowDeleteConfirm(false);
    setDeleteTargetIds([]);
  }, [deleteTargetIds, onDelete, onBulkDelete]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, expense: Expense) => {
      if (isMobile) return;
      openContextMenu(e, expense.id as number);
    },
    [openContextMenu, isMobile],
  );

  const contextMenuItems = useMemo(() => {
    if (!menu) return [];
    const isMulti = selectedIds.size > 1;
    const ids = isMulti ? Array.from(selectedIds) : [menu.expenseId];
    const items: {
      label: string;
      onClick: () => void;
      disabled?: boolean;
      danger?: boolean;
    }[] = [];

    if (!isMulti) {
      items.push({
        label: "Edit",
        onClick: () => {
          const exp = expenses.find((e) => e.id === menu.expenseId);
          if (exp) startRowEdit(exp);
        },
      });
    }

    items.push({
      label: isMulti ? `Delete ${selectedIds.size} rows` : "Delete",
      onClick: () => handleDeleteRequest(ids),
      danger: true,
    });

    return items;
  }, [menu, selectedIds, expenses, startRowEdit, handleDeleteRequest]);

  const columns = useMemo(
    () =>
      getExpenseColumns({
        selectedIds,
        onToggleSelect,
        onToggleSelectAll,
        allSelected,
        editingCell,
        draft,
        setField,
        saveEdit,
        cancelEdit,
        handleKeyDown,
        onCellEdit: startCellEdit,
        formatDate,
        formatAmount,
        catMap,
        activeCategories,
        resolveName,
        inputRef,
      }),
    [
      selectedIds,
      onToggleSelect,
      onToggleSelectAll,
      allSelected,
      editingCell,
      draft,
      setField,
      saveEdit,
      cancelEdit,
      handleKeyDown,
      startCellEdit,
      formatDate,
      formatAmount,
      catMap,
      activeCategories,
      resolveName,
    ],
  );

  const getRowClassName = useCallback(
    (exp: Expense) => {
      const isSelected = selectedIds.has(exp.id as number);
      return cn(
        isSelected && "bg-theme-primary/[0.04]",
        !isSelected && "row-hover",
      );
    },
    [selectedIds],
  );

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-theme-muted">
          No expenses yet. Hit{" "}
          <strong className="text-theme-primary">+</strong> to add one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isMobile ? (
        <ExpenseTableMobile
          expenses={expenses}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onCellEdit={(exp) => startCellEdit(exp, "description")}
          formatDate={formatDate}
          formatAmount={formatAmount}
          resolveName={resolveName}
        />
      ) : (
        <DataTable
          data={expenses}
          columns={columns}
          getRowClassName={getRowClassName}
          onRowContextMenu={handleContextMenu}
        />
      )}

      {/* Mobile edit modal */}
      {showMobileEditModal && mobileEditExpense && (
        <Modal
          isOpen={showMobileEditModal}
          onClose={cancelEdit}
          title="Edit Expense"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs text-theme-muted block mb-1">
                Date
              </label>
              <input
                type="date"
                value={String(draft.date ?? mobileEditExpense.date)}
                onChange={(e) => setField("date")(e.target.value)}
                className="input-theme w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">
                Category
              </label>
              <select
                value={
                  (draft.categoryId as number) ??
                  mobileEditExpense.categoryId ??
                  ""
                }
                onChange={(e) =>
                  setField("categoryId")(Number(e.target.value))
                }
                className="input-theme w-full px-3 py-2 text-sm"
              >
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id as number}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">
                Description
              </label>
              <input
                type="text"
                value={String(
                  draft.description ?? mobileEditExpense.description ?? "",
                )}
                onChange={(e) =>
                  setField("description")(e.target.value)
                }
                className="input-theme w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">
                Amount
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={String(draft.amount ?? mobileEditExpense.amount)}
                onChange={(e) => setField("amount")(e.target.value)}
                className="input-theme w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={cancelEdit}
                className="summary-cancel-btn flex-1"
              >
                Cancel
              </button>
              <button onClick={saveEdit} className="summary-save-btn flex-1">
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirmation modal */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Confirm Delete"
        description={
          <span className="text-sm text-theme-muted">
            Are you sure you want to delete{" "}
            <strong className="text-theme-text">{deleteTargetIds.length}</strong>{" "}
            expense{deleteTargetIds.length !== 1 ? "s" : ""}?
          </span>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={confirmDelete}
      />

      {/* Context menu */}
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
  );
}
