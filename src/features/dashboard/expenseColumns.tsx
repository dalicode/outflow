import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "../../utils/cn";
import { normalizeName } from "../../utils/normalizeName";
import type { Expense, Category, Payee } from "../../types";

interface GetExpenseColumnsParams {
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  editingCell: { id: number; field: keyof Expense } | null;
  draft: Partial<Expense>;
  setField: (field: keyof Expense) => (val: string | number) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  onCellEdit: (expense: Expense, field: keyof Expense) => void;
  formatDate: (iso: string) => string;
  formatAmount: (n: number) => string;
  catMap: Record<number, Category>;
  activeCategories: Category[];
  resolveName: (exp: Expense) => string;
  payeeMap: Record<number, Payee>;
  inputRef: React.RefObject<HTMLInputElement | HTMLSelectElement | null>;
}

export function getExpenseColumns({
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
  onCellEdit,
  formatDate,
  formatAmount,
  catMap,
  activeCategories,
  resolveName,
  payeeMap,
  inputRef,
}: GetExpenseColumnsParams): ColumnDef<Expense>[] {
  const isEditing = (exp: Expense, field: keyof Expense) =>
    editingCell?.id === exp.id && editingCell?.field === field;

  const resolvePayeeName = (exp: Expense) => {
    if (exp.payeeId && payeeMap[exp.payeeId]) {
      return normalizeName(payeeMap[exp.payeeId].name);
    }
    return exp.payee ? normalizeName(exp.payee) : "—";
  };

  return [
    {
      id: "select",
      header: () => (
        <label className={cn("expense-checkbox-wrapper cursor-pointer", allSelected && "checked")}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            className="sr-only"
            aria-label="Select all"
          />
            <div className={cn(
              "w-3.5 h-3.5 rounded-theme-small border transition-colors flex items-center justify-center",
              allSelected
                ? "border-theme-text bg-transparent"
                : "border-theme-text bg-transparent",
            )}>
              {allSelected && (
                <svg className="w-2.5 h-2.5 text-theme-text" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.5L5 9l4.5-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
        </label>
      ),
      cell: ({ row }) => {
        const exp = row.original;
        const isSelected = selectedIds.has(exp.id as number);
        return (
          <label className={cn("expense-checkbox-wrapper cursor-pointer", isSelected && "checked")}>
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
            <div className={cn(
              "w-3.5 h-3.5 rounded-theme-small border transition-colors flex items-center justify-center",
              isSelected
                ? "border-theme-text bg-transparent"
                : "border-theme-text bg-transparent",
            )}>
              {isSelected && (
                <svg className="w-2.5 h-2.5 text-theme-text" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.5L5 9l4.5-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
        if (isEditing(exp, "date")) {
          return (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="date"
              value={String(draft.date ?? exp.date ?? "")}
              onChange={(e) => setField("date")(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={saveEdit}
              className="input-sm w-full"
              autoFocus
            />
          );
        }
        return (
          <span
            onClick={() => onCellEdit(exp, "date")}
            className="cursor-pointer"
          >
            {formatDate(exp.date)}
          </span>
        );
      },
      meta: { className: "text-left", cellClassName: "text-theme-text whitespace-nowrap" },
    },
    {
      id: "category",
      header: "Category",
      cell: ({ row }) => {
        const exp = row.original;
        if (isEditing(exp, "categoryId")) {
          return (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={(draft.categoryId as number) ?? exp.categoryId ?? ""}
              onChange={(e) => setField("categoryId")(Number(e.target.value))}
              onKeyDown={handleKeyDown}
              onBlur={saveEdit}
              className="input-sm w-full"
              autoFocus
            >
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id as number}>
                  {normalizeName(c.name)}
                </option>
              ))}
            </select>
          );
        }
        return (
          <span
            onClick={() => onCellEdit(exp, "categoryId")}
            className={cn(
              "cursor-pointer",
              catMap[exp.categoryId as number]?.isArchived
                ? "text-theme-muted italic"
                : "text-theme-text font-medium",
            )}
          >
            {resolveName(exp)}
          </span>
        );
      },
      meta: { className: "text-left", cellClassName: "whitespace-nowrap" },
    },
    {
      id: "payee",
      header: "Payee",
      cell: ({ row }) => {
        const exp = row.original;
        return (
          <span className="text-theme-muted text-xs">
            {resolvePayeeName(exp)}
          </span>
        );
      },
      meta: { className: "text-left hidden sm:table-cell", cellClassName: "whitespace-nowrap" },
    },
    {
      id: "description",
      header: "Description",
      cell: ({ row }) => {
        const exp = row.original;
        if (isEditing(exp, "description")) {
          return (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={String(draft.description ?? exp.description ?? "")}
              onChange={(e) => setField("description")(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={saveEdit}
              className="input-sm w-full"
              autoFocus
            />
          );
        }
        return (
          <span
            onClick={() => onCellEdit(exp, "description")}
            className="cursor-pointer"
          >
            {exp.description || (
              <span className="text-theme-muted">—</span>
            )}
          </span>
        );
      },
      meta: {
        className: "text-left",
        cellClassName: "text-theme-text max-w-[200px] truncate",
      },
    },
    {
      id: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const exp = row.original;
        const amountColor =
          exp.amount < 0 ? "text-theme-success" : "text-theme-primary";
        if (isEditing(exp, "amount")) {
          return (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="number"
              min="0.01"
              step="0.01"
              value={String(draft.amount ?? exp.amount ?? "")}
              onChange={(e) => setField("amount")(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={saveEdit}
              className="input-sm w-full text-right"
              autoFocus
            />
          );
        }
        return (
          <span
            onClick={() => onCellEdit(exp, "amount")}
            className={cn("cursor-pointer", amountColor)}
          >
            {formatAmount(exp.amount)}
          </span>
        );
      },
      meta: {
        className: "text-right tabular-nums",
        cellClassName: "text-right tabular-nums font-semibold",
      },
    },
  ];
}
