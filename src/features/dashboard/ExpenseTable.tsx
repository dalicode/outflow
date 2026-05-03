import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSettings } from "../../context/settingsContext";
import { useContextMenu } from "../../hooks/useContextMenu";
import { usePayees } from "../../hooks/useLocalData";
import { cn } from "../../utils/cn";
import DataTable from "../../components/ui/DataTable";
import ContextMenu from "../../components/ui/ContextMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import ExpenseTableMobile from "./ExpenseTableMobile";
import ExpenseForm from "../expenses/ExpenseForm";
import { normalizeName } from "../../utils/normalizeName";
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

  const { payees } = usePayees();

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );
  const payeeMap = useMemo(
    () => Object.fromEntries(payees.map((p) => [p.id, p])),
    [payees],
  );
  const activeCategories = useMemo(
    () => categories.filter((c) => !c.isArchived),
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
      if (cat) return cat.isArchived ? `${normalizeName(cat.name)} (deleted)` : normalizeName(cat.name);
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
    const payee = payeeMap[draft.payeeId as number];
    onUpdate(targetId, {
      ...draft,
      amount:
        draft.amount != null ? parseFloat(String(draft.amount)) : undefined,
      category: cat?.name ?? draft.category,
      payee: payee?.name ?? draft.payee,
    });
    setEditingCell(null);
    setDraft({});
    setShowMobileEditModal(false);
    setMobileEditExpense(null);
  }, [editingCell, mobileEditExpense, draft, catMap, payeeMap, onUpdate]);

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
        payeeMap,
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
      payeeMap,
    ],
  );

  const getRowClassName = useCallback(
    (exp: Expense) => {
      const isSelected = selectedIds.has(exp.id as number);
      return cn(
        isSelected && "selected-row",
        "row-hover",
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
        <ExpenseForm
          initialExpense={mobileEditExpense}
          onUpdate={onUpdate}
          onClose={cancelEdit}
          categories={categories}
        />
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
