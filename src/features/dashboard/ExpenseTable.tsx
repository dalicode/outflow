import { useState, useMemo, useCallback, useEffect } from "react";
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
import { useExpenseCellEditing } from "./useExpenseCellEditing";
import type { Expense, Category, Payee } from "../../types";

interface ExpenseTableProps {
  expenses: Expense[];
  onUpdate: (id: number, changes: Partial<Expense>) => void;
  onDelete: (id: number) => void;
  onBulkDelete?: (ids: number[]) => void;
  categories?: Category[];
  payees?: Payee[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  isMobile?: boolean;
  mobileEditTrigger?: number | null;
  refreshCategories?: () => Promise<void>;
  refreshPayees?: () => Promise<void>;
}

export default function ExpenseTable({
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
}: ExpenseTableProps) {
  const { formatAmount, formatDate, settings } = useSettings();
  const {
    menu,
    open: openContextMenu,
    close: closeContextMenu,
    menuRef,
  } = useContextMenu();

  const [showMobileEditModal, setShowMobileEditModal] = useState(false);
  const [mobileEditExpense, setMobileEditExpense] = useState<Expense | null>(
    null,
  );

  const [optimistic, setOptimistic] = useState<
    Record<number, Partial<Expense>>
  >({});

  useEffect(() => {
    setOptimistic((prev) => {
      const next: Record<number, Partial<Expense>> = {};
      for (const [idStr, overrides] of Object.entries(prev)) {
        const id = Number(idStr);
        const exp = expenses.find((e) => e.id === id);
        if (!exp) continue;
        const stillHasOverride = Object.entries(overrides).some(
          ([key, val]) =>
            (exp as unknown as Record<string, unknown>)[key] !== val,
        );
        if (stillHasOverride) next[id] = overrides;
      }
      return next;
    });
  }, [expenses]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<number[]>([]);

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
  const activePayees = useMemo(
    () => payees.filter((p) => !p.isArchived),
    [payees],
  );

  useEffect(() => {
    if (mobileEditTrigger == null) return;
    const expense = expenses.find((e) => e.id === mobileEditTrigger);
    if (expense) {
      setMobileEditExpense(expense);
      setShowMobileEditModal(true);
    }
  }, [mobileEditTrigger, expenses]);

  const resolveName = useCallback(
    (exp: Expense) => {
      const cat = catMap[exp.categoryId as number];
      if (cat)
        return cat.isArchived
          ? `${normalizeName(cat.name)} (deleted)`
          : normalizeName(cat.name);
      return "Uncategorized";
    },
    [catMap],
  );

  const allSelected =
    expenses.length > 0 &&
    expenses.every((e) => selectedIds.has(e.id as number));

  const cancelMobileEdit = useCallback(() => {
    setShowMobileEditModal(false);
    setMobileEditExpense(null);
  }, []);

  const editing = useExpenseCellEditing({
    expenses,
    onUpdate,
    optimistic,
    setOptimistic,
    isMobile,
    selectedIds,
    onToggleSelect,
    setMobileEditExpense,
    setShowMobileEditModal,
  });

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
          if (exp) editing.startCellEdit(exp, "date");
        },
      });
    }

    items.push({
      label: isMulti ? `Delete ${selectedIds.size} rows` : "Delete",
      onClick: () => handleDeleteRequest(ids),
      danger: true,
    });

    return items;
  }, [menu, selectedIds, expenses, editing, handleDeleteRequest]);

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
        optimistic,
        refreshCategories,
        refreshPayees,
        decimalPlaces: parseInt(settings.decimalPlaces, 10) || 2,
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
      optimistic,
      refreshCategories,
      refreshPayees,
      settings.decimalPlaces,
    ],
  );

  const getRowClassName = useCallback(
    (exp: Expense) => {
      const isSelected = selectedIds.has(exp.id as number);
      return cn(isSelected && "selected-row", "row-hover");
    },
    [selectedIds],
  );

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-theme-muted">
          No expenses yet. Hit <strong className="text-theme-primary">+</strong>{" "}
          to add one.
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
          onCellEdit={(exp) => editing.startCellEdit(exp, "description")}
          formatDate={formatDate}
          formatAmount={formatAmount}
          resolveName={resolveName}
          resolvePayeeName={(exp) => {
            const p = payeeMap[exp.payeeId as number];
            return p ? normalizeName(p.name) : "";
          }}
        />
      ) : (
        <DataTable
          data={expenses}
          columns={columns}
          fixedLayout
          getRowClassName={getRowClassName}
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

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Confirm Delete"
        description={
          <span className="text-sm text-theme-muted">
            Are you sure you want to delete{" "}
            <strong className="text-theme-text">
              {deleteTargetIds.length}
            </strong>{" "}
            expense{deleteTargetIds.length !== 1 ? "s" : ""}?
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
  );
}
