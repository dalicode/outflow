import { useState, useMemo, useCallback, useRef } from "react";
import { useSettings } from "../../context/settingsContext";
import { cn } from "../../utils/cn";
import { useContextMenu } from "../../hooks/useContextMenu";
import { useLongPress } from "../../hooks/useLongPress";
import ContextMenu from "../../components/ui/ContextMenu";
import Modal from "../../components/ui/Modal";
import ExpenseTableFilters from "./ExpenseTableFilters";
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
}

function formatAmountPlain(n: number) {
  return Math.abs(n).toFixed(2);
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
}: ExpenseTableProps) {
  const { formatAmount, formatDate, getNumberColorClass } = useSettings();
  const { menu, open: openContextMenu, close: closeContextMenu, menuRef } = useContextMenu();

  // Filters
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState({
    dateFrom: "",
    dateTo: "",
    category: "",
    description: "",
    amount: "",
  });

  // Editing
  const [editingCell, setEditingCell] = useState<{ id: number; field: keyof Expense } | null>(null);
  const [draft, setDraft] = useState<Partial<Expense>>({});
  const [showMobileEditModal, setShowMobileEditModal] = useState(false);
  const [mobileEditExpense, setMobileEditExpense] = useState<Expense | null>(null);

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

  const resolveName = useCallback(
    (exp: Expense) => {
      const cat = catMap[exp.categoryId as number];
      if (cat) return cat.isDeleted ? `${cat.name} (deleted)` : cat.name;
      return exp.category || "Uncategorized";
    },
    [catMap],
  );

  const visibleExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // Global filter
      if (globalFilter) {
        const search = globalFilter.toLowerCase();
        const match =
          e.date.toLowerCase().includes(search) ||
          resolveName(e).toLowerCase().includes(search) ||
          (e.description || "").toLowerCase().includes(search) ||
          formatAmount(e.amount).toLowerCase().includes(search);
        if (!match) return false;
      }
      // Date range
      if (columnFilters.dateFrom && e.date < columnFilters.dateFrom) return false;
      if (columnFilters.dateTo && e.date > columnFilters.dateTo) return false;
      // Category
      if (columnFilters.category && resolveName(e) !== columnFilters.category) return false;
      // Description
      if (columnFilters.description && !(e.description || "").toLowerCase().includes(columnFilters.description.toLowerCase()))
        return false;
      // Amount (matches raw or formatted)
      if (columnFilters.amount) {
        const search = columnFilters.amount.toLowerCase();
        const rawMatch = String(e.amount).toLowerCase().includes(search);
        const fmtMatch = formatAmount(e.amount).toLowerCase().includes(search);
        if (!rawMatch && !fmtMatch) return false;
      }
      return true;
    });
  }, [expenses, globalFilter, columnFilters, resolveName, formatAmount]);

  const allSelected =
    visibleExpenses.length > 0 && visibleExpenses.every((e) => selectedIds.has(e.id as number));

  // Long press for mobile
  const { onTouchStart, onTouchMove, onTouchEnd } = useLongPress({
    onLongPress: (id: number) => {
      onToggleSelect(id);
    },
  });

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
      // Focus after render
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

  const saveEdit = useCallback(() => {
    if (!editingCell && !mobileEditExpense) return;
    const targetId = (editingCell?.id ?? mobileEditExpense?.id) as number;
    const cat = catMap[draft.categoryId as number];
    onUpdate(targetId, {
      ...draft,
      amount: draft.amount != null ? parseFloat(String(draft.amount)) : undefined,
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
    const items: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean }[] = [];

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

  const setField = (field: keyof Expense) => (val: string | number) =>
    setDraft((d) => ({ ...d, [field]: val }));

  const renderCellEditor = (expense: Expense, field: keyof Expense) => {
    const isEditing = editingCell?.id === expense.id && editingCell?.field === field;
    if (!isEditing) return null;

    const value = draft[field] ?? expense[field];

    switch (field) {
      case "date":
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={String(value ?? "")}
            onChange={(e) => setField("date")(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            className="input-sm w-full"
          />
        );
      case "amount":
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="number"
            min="0.01"
            step="0.01"
            value={String(value ?? "")}
            onChange={(e) => setField("amount")(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            className="input-sm w-full text-right"
          />
        );
      case "description":
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={String(value ?? "")}
            onChange={(e) => setField("description")(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            className="input-sm w-full"
          />
        );
      case "categoryId":
        return (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={(value as number) ?? ""}
            onChange={(e) => setField("categoryId")(Number(e.target.value))}
            onKeyDown={handleKeyDown}
            onBlur={saveEdit}
            className="input-sm w-full"
          >
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id as number}>
                {c.name}
              </option>
            ))}
          </select>
        );
      default:
        return null;
    }
  };

  const renderCell = (expense: Expense, field: keyof Expense, children: React.ReactNode) => {
    const isEditing = editingCell?.id === expense.id && editingCell?.field === field;
    if (isEditing) return renderCellEditor(expense, field);
    return (
      <span
        onClick={() => startCellEdit(expense, field)}
        className="cursor-pointer"
      >
        {children}
      </span>
    );
  };

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
      <ExpenseTableFilters
        categories={activeCategories}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        columnFilters={columnFilters}
        onColumnFilterChange={(field, val) =>
          setColumnFilters((prev) => ({ ...prev, [field]: val }))
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr>
              {!isMobile && (
                <th className="table-header-cell text-center w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                    className={cn(
                      "w-4 h-4 rounded-theme-small cursor-pointer",
                      "expense-checkbox",
                      allSelected && "opacity-100",
                    )}
                    aria-label="Select all"
                  />
                </th>
              )}
              <th className="table-header-cell text-left">Date</th>
              <th className="table-header-cell text-left">Category</th>
              <th className="table-header-cell text-left">Description</th>
              <th className="table-header-cell text-right tabular-nums">Amount</th>
            </tr>
          </thead>
          <tbody>
            {visibleExpenses.map((exp) => {
              const isSelected = selectedIds.has(exp.id as number);
              const amountColor =
                exp.amount < 0 ? "text-theme-success" : "text-theme-primary";

              return (
                <tr
                  key={exp.id}
                  className={cn(
                    "border-b border-theme-muted/10",
                    isSelected && "bg-theme-primary/[0.04]",
                    !isSelected && "row-hover",
                  )}
                  onContextMenu={(e) => handleContextMenu(e, exp)}
                  onTouchStart={(e) => onTouchStart(e, exp.id as number)}
                  onTouchMove={onTouchMove}
                  onTouchEnd={(e) => onTouchEnd(e, exp.id as number)}
                >
                  {!isMobile && (
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleSelect(exp.id as number);
                        }}
                        className={cn(
                          "w-4 h-4 rounded-theme-small cursor-pointer",
                          "expense-checkbox",
                          isSelected && "opacity-100",
                        )}
                        aria-label={`Select ${exp.description || "expense"}`}
                      />
                    </td>
                  )}
                  <td
                    className={cn(
                      "px-3 py-2.5 text-theme-text whitespace-nowrap",
                      isMobile && isSelected && "border-l-4 border-theme-primary",
                    )}
                  >
                    {renderCell(exp, "date", formatDate(exp.date))}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {renderCell(
                      exp,
                      "categoryId",
                      <span
                        className={cn(
                          catMap[exp.categoryId as number]?.isDeleted
                            ? "text-theme-muted italic"
                            : "text-theme-text font-medium",
                        )}
                      >
                        {resolveName(exp)}
                      </span>,
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-theme-text max-w-[200px] truncate">
                    {renderCell(
                      exp,
                      "description",
                      exp.description || <span className="text-theme-muted">—</span>,
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right tabular-nums font-semibold",
                      amountColor,
                    )}
                  >
                    {renderCell(exp, "amount", formatAmount(exp.amount))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visibleExpenses.length === 0 && (
        <p className="text-sm text-theme-muted text-center py-8">
          No expenses match the current filters.
        </p>
      )}

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
              <label className="text-xs text-theme-muted block mb-1">Date</label>
              <input
                type="date"
                value={String(draft.date ?? mobileEditExpense.date)}
                onChange={(e) => setField("date")(e.target.value)}
                className="input-theme w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">Category</label>
              <select
                value={(draft.categoryId as number) ?? mobileEditExpense.categoryId ?? ""}
                onChange={(e) => setField("categoryId")(Number(e.target.value))}
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
              <label className="text-xs text-theme-muted block mb-1">Description</label>
              <input
                type="text"
                value={String(draft.description ?? mobileEditExpense.description ?? "")}
                onChange={(e) => setField("description")(e.target.value)}
                className="input-theme w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-theme-muted block mb-1">Amount</label>
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
              <button onClick={saveEdit} className="summary-save-btn flex-1">
                Save
              </button>
              <button onClick={cancelEdit} className="summary-cancel-btn flex-1">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Confirm Delete"
        size="sm"
      >
        <p className="text-sm text-theme-muted">
          Are you sure you want to delete{" "}
          <strong className="text-theme-text">{deleteTargetIds.length}</strong>{" "}
          expense{deleteTargetIds.length !== 1 ? "s" : ""}?
        </p>
        <div className="flex gap-3 mt-4">
          <button onClick={confirmDelete} className="confirm-delete-btn">
            Delete
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="confirm-cancel-btn"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
