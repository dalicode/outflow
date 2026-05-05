import { useState, useMemo, useCallback, useEffect } from "react";
import { useSettings } from "../../context/settingsContext";
import { useContextMenu } from "../../hooks/useContextMenu";
import { cn } from "../../utils/cn";
import DataTable from "../../components/ui/DataTable";
import ContextMenu from "../../components/ui/ContextMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import ExpenseTableMobile from "./ExpenseTableMobile";
import BulkEditExpensesModal from "./BulkEditExpensesModal";
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
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditTargetIds, setBulkEditTargetIds] = useState<number[]>([]);

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

  const openExpenseEditor = useCallback(
    (expense: Expense | null) => {
      if (expense) {
        setMobileEditExpense(expense);
        setShowMobileEditModal(true);
      } else {
        cancelMobileEdit();
      }
    },
    [cancelMobileEdit],
  );

  const closeBulkEditModal = useCallback(() => {
    setShowBulkEditModal(false);
    setBulkEditTargetIds([]);
  }, []);

  const openBulkEditModal = useCallback((ids: number[]) => {
    setBulkEditTargetIds(ids);
    setShowBulkEditModal(true);
  }, []);

  const editing = useExpenseCellEditing({
    expenses,
    onUpdate,
    isMobile,
    selectedIds,
    onToggleSelect,
    setMobileEditExpense: openExpenseEditor,
    setShowMobileEditModal,
  });

  const handleEditRequest = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) return;
      if (ids.length === 1) {
        const expense = expenses.find((item) => item.id === ids[0]);
        if (expense) openExpenseEditor(expense);
        return;
      }
      openBulkEditModal(ids);
    },
    [expenses, openBulkEditModal, openExpenseEditor],
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
    const ids =
      selectedIds.size > 1 && selectedIds.has(menu.expenseId)
        ? Array.from(selectedIds)
        : [menu.expenseId];
    const isMulti = ids.length > 1;
    const items: {
      label: string;
      onClick: () => void;
      disabled?: boolean;
      danger?: boolean;
    }[] = [];

    items.push({
      label: isMulti ? `Edit ${ids.length} rows` : "Edit",
      onClick: () => handleEditRequest(ids),
    });

    items.push({
      label: isMulti ? `Delete ${ids.length} rows` : "Delete",
      onClick: () => handleDeleteRequest(ids),
      danger: true,
    });

    return items;
  }, [menu, selectedIds, handleDeleteRequest, handleEditRequest]);

  const bulkEditExpenses = useMemo(
    () =>
      expenses.filter((expense) =>
        bulkEditTargetIds.includes(expense.id as number),
      ),
    [expenses, bulkEditTargetIds],
  );

  const handleBulkEditApply = useCallback(
    async (changes: Partial<Expense>) => {
      await Promise.all(
        bulkEditTargetIds.map((id) => Promise.resolve(onUpdate(id, changes))),
      );
    },
    [bulkEditTargetIds, onUpdate],
  );

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
