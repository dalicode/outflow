import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "../../utils/cn";
import { normalizeName } from "../../utils/normalizeName";
import CreatableCombobox from "../../components/inputs/CreatableCombobox";
import DatePicker from "../../components/inputs/DatePicker";
import InlineEditCell from "./InlineEditCell";
import { StorageService } from "../../services/storageService";
import type { Expense, Category, Payee } from "../../types";

interface GetExpenseColumnsParams {
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  editingCell: { id: number; field: keyof Expense } | null;
  cancelEdit: () => void;
  handleTabNavigation: (expense: Expense, field: keyof Expense, shiftKey: boolean) => void;
  onCellEdit: (expense: Expense, field: keyof Expense) => void;
  formatDate: (iso: string) => string;
  formatAmount: (n: number) => string;
  catMap: Record<number, Category>;
  activeCategories: Category[];
  activePayees: Payee[];
  payeeMap: Record<number, Payee>;
  onUpdate: (id: number, changes: Partial<Expense>) => void;
  setEditingCell: React.Dispatch<
    React.SetStateAction<{ id: number; field: keyof Expense } | null>
  >;
  refreshCategories?: () => Promise<void>;
  refreshPayees?: () => Promise<void>;
  optimistic: Record<number, Partial<Expense>>;
  setOptimistic: React.Dispatch<
    React.SetStateAction<Record<number, Partial<Expense>>>
  >;
}

export function getExpenseColumns({
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  editingCell,
  cancelEdit,
  handleTabNavigation,
  onCellEdit,
  formatDate,
  formatAmount,
  catMap,
  activeCategories,
  activePayees,
  payeeMap,
  onUpdate,
  setEditingCell,
  refreshCategories,
  refreshPayees,
  optimistic,
  setOptimistic,
}: GetExpenseColumnsParams): ColumnDef<Expense>[] {
  const isEditing = (exp: Expense, field: keyof Expense) =>
    editingCell?.id === exp.id && editingCell?.field === field;

  return [
    {
      id: "select",
      header: () => (
        <label
          className={cn(
            "expense-checkbox-wrapper cursor-pointer",
            allSelected && "checked",
          )}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            className="sr-only"
            aria-label="Select all"
          />
          <div
            className={cn(
              "w-3.5 h-3.5 rounded-theme-small border transition-colors flex items-center justify-center",
              allSelected
                ? "border-theme-text bg-transparent"
                : "border-theme-text bg-transparent",
            )}
          >
            {allSelected && (
              <svg
                className="w-2.5 h-2.5 text-theme-text"
                viewBox="0 0 12 12"
                fill="none"
              >
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
        const exp = row.original;
        const isSelected = selectedIds.has(exp.id as number);
        return (
          <label
            className={cn(
              "expense-checkbox-wrapper cursor-pointer",
              isSelected && "checked",
            )}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(exp.id as number);
              }}
              className="sr-only"
              aria-label={`Select ${exp.description || "expense"}`}
            />
            <div
              className={cn(
                "w-3.5 h-3.5 rounded-theme-small border transition-colors flex items-center justify-center",
                isSelected
                  ? "border-theme-text bg-transparent"
                  : "border-theme-text bg-transparent",
              )}
            >
              {isSelected && (
                <svg
                  className="w-2.5 h-2.5 text-theme-text"
                  viewBox="0 0 12 12"
                  fill="none"
                >
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
        );
      },
      meta: { className: "text-center w-10", cellClassName: "text-center" },
    },
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => {
        const exp = row.original;
        const optDate = optimistic[exp.id as number]?.date ?? exp.date;
        if (isEditing(exp, "date")) {
          return (
            <DatePicker
              value={exp.date ?? ""}
              variant="inline"
              autoOpen
              onChange={(iso) => {
                setOptimistic((prev) => ({
                  ...prev,
                  [exp.id as number]: { ...prev[exp.id as number], date: iso },
                }));
                onUpdate(exp.id as number, { date: iso });
                setEditingCell(null);
              }}
              onCancel={cancelEdit}
              onTab={(shiftKey) => handleTabNavigation(exp, "date", shiftKey)}
            />
          );
        }
        return (
          <span
            onClick={() => onCellEdit(exp, "date")}
            className="cursor-pointer"
          >
            {formatDate(optDate)}
          </span>
        );
      },
      meta: {
        className: "text-left",
        cellClassName: "text-theme-text whitespace-nowrap",
        getCellClassName: (exp) =>
          isEditing(exp, "date") ? "cell-editing" : "",
      },
    },
    {
      id: "category",
      header: "Category",
      cell: ({ row }) => {
        const exp = row.original;
        const optCatId =
          optimistic[exp.id as number]?.categoryId ?? exp.categoryId;
        if (isEditing(exp, "categoryId")) {
          return (
            <CreatableCombobox
              value={exp.categoryId}
              variant="inline"
              options={activeCategories.map((c) => ({
                id: c.id as number,
                label: normalizeName(c.name),
              }))}
              placeholder="Select category…"
              allowCreate
              autoOpen
              onChange={(id) => {
                const numId = id != null ? Number(id) : undefined;
                setOptimistic((prev) => ({
                  ...prev,
                  [exp.id as number]: {
                    ...prev[exp.id as number],
                    categoryId: numId,
                  },
                }));
                onUpdate(exp.id as number, { categoryId: numId });
                setEditingCell(null);
              }}
              onCreate={async (name) => {
                const newId = await StorageService.addCategory(name);
                if (newId == null) throw new Error("Failed to create category");
                await refreshCategories?.();
                setOptimistic((prev) => ({
                  ...prev,
                  [exp.id as number]: {
                    ...prev[exp.id as number],
                    categoryId: newId,
                  },
                }));
                onUpdate(exp.id as number, { categoryId: newId });
                setEditingCell(null);
                return newId as number;
              }}
              onCancel={cancelEdit}
              onTab={(shiftKey) => handleTabNavigation(exp, "categoryId", shiftKey)}
            />
          );
        }
        return (
          <span
            onClick={() => onCellEdit(exp, "categoryId")}
            className={cn(
              "cursor-pointer",
              catMap[optCatId as number]?.isArchived
                ? "text-theme-muted italic"
                : "text-theme-text font-medium",
            )}
          >
            {catMap[optCatId as number]
              ? catMap[optCatId as number].isArchived
                ? `${normalizeName(catMap[optCatId as number].name)} (deleted)`
                : normalizeName(catMap[optCatId as number].name)
              : "Uncategorized"}
          </span>
        );
      },
      meta: {
        className: "text-left",
        cellClassName: "whitespace-nowrap",
        getCellClassName: (exp) =>
          isEditing(exp, "categoryId") ? "cell-editing" : "",
      },
    },
    {
      id: "payee",
      header: "Payee",
      cell: ({ row }) => {
        const exp = row.original;
        const optPayeeId = optimistic[exp.id as number]?.payeeId ?? exp.payeeId;
        if (isEditing(exp, "payeeId")) {
          return (
            <CreatableCombobox
              value={exp.payeeId}
              variant="inline"
              options={activePayees.map((p) => ({
                id: p.id as number,
                label: normalizeName(p.name),
              }))}
              placeholder="Select payee…"
              allowCreate
              autoOpen
              onChange={(id) => {
                const numId = id != null ? Number(id) : undefined;
                setOptimistic((prev) => ({
                  ...prev,
                  [exp.id as number]: {
                    ...prev[exp.id as number],
                    payeeId: numId,
                  },
                }));
                onUpdate(exp.id as number, { payeeId: numId });
                setEditingCell(null);
              }}
              onCreate={async (name) => {
                const newId = await StorageService.addPayee(name);
                if (newId == null) throw new Error("Failed to create payee");
                await refreshPayees?.();
                setOptimistic((prev) => ({
                  ...prev,
                  [exp.id as number]: {
                    ...prev[exp.id as number],
                    payeeId: newId,
                  },
                }));
                onUpdate(exp.id as number, { payeeId: newId });
                setEditingCell(null);
                return newId as number;
              }}
              onCancel={cancelEdit}
              onTab={(shiftKey) => handleTabNavigation(exp, "payeeId", shiftKey)}
            />
          );
        }
        return (
          <span
            onClick={() => onCellEdit(exp, "payeeId")}
            className="cursor-pointer text-theme-muted text-xs"
          >
            {optPayeeId && payeeMap[optPayeeId as number]
              ? normalizeName(payeeMap[optPayeeId as number].name)
              : "—"}
          </span>
        );
      },
      meta: {
        className: "text-left hidden sm:table-cell",
        cellClassName: "whitespace-nowrap",
        getCellClassName: (exp) =>
          isEditing(exp, "payeeId") ? "cell-editing" : "",
      },
    },
    {
      id: "description",
      header: "Description",
      cell: ({ row }) => {
        const exp = row.original;
        const optDesc =
          optimistic[exp.id as number]?.description ?? exp.description;
        if (isEditing(exp, "description")) {
          return (
            <InlineEditCell
              initialValue={exp.description ?? ""}
              onCommit={(val) => {
                const trimmed = val.trim() || undefined;
                setOptimistic((prev) => ({
                  ...prev,
                  [exp.id as number]: { ...prev[exp.id as number], description: trimmed },
                }));
                onUpdate(exp.id as number, { description: trimmed });
                setEditingCell(null);
              }}
              onCancel={() => setEditingCell(null)}
              onTab={(shiftKey) => handleTabNavigation(exp, "description", shiftKey)}
            />
          );
        }
        return (
          <span
            onClick={() => onCellEdit(exp, "description")}
            className="cursor-pointer"
          >
            {optDesc || <span className="text-theme-muted">—</span>}
          </span>
        );
      },
      meta: {
        className: "text-left",
        cellClassName: "text-theme-text max-w-[200px] truncate",
        getCellClassName: (exp) =>
          isEditing(exp, "description") ? "cell-editing" : "",
      },
    },
    {
      id: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const exp = row.original;
        const optAmount = optimistic[exp.id as number]?.amount ?? exp.amount;
        const amountColor =
          (optAmount ?? 0) < 0 ? "text-theme-success" : "text-theme-primary";
        if (isEditing(exp, "amount")) {
          return (
            <InlineEditCell
              initialValue={String(exp.amount ?? "")}
              onCommit={(val) => {
                const parsed = val ? parseFloat(val) : undefined;
                setOptimistic((prev) => ({
                  ...prev,
                  [exp.id as number]: { ...prev[exp.id as number], amount: parsed },
                }));
                onUpdate(exp.id as number, { amount: parsed });
                setEditingCell(null);
              }}
              onCancel={() => setEditingCell(null)}
              onTab={(shiftKey) => handleTabNavigation(exp, "amount", shiftKey)}
              type="number"
              className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          );
        }
        return (
          <span
            onClick={() => onCellEdit(exp, "amount")}
            className={cn("cursor-pointer", amountColor)}
          >
            {formatAmount(optAmount ?? 0)}
          </span>
        );
      },
      meta: {
        className: "text-right tabular-nums",
        cellClassName: "text-right tabular-nums font-semibold",
        getCellClassName: (exp) =>
          isEditing(exp, "amount") ? "cell-editing" : "",
      },
    },
  ];
}
