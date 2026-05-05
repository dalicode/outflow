import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "../../utils/cn";
import { normalizeName } from "../../utils/normalizeName";
import CreatableCombobox from "../../components/inputs/CreatableCombobox";
import DatePicker from "../../components/inputs/DatePicker";
import InlineEditCell from "./InlineEditCell";
import { StorageService } from "../../services/storageService";
import type { Expense, Category, Payee } from "../../types";
import type { CellEditingAPI } from "./useExpenseCellEditing";

interface GetExpenseColumnsParams {
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  editing: CellEditingAPI;
  formatDate: (iso: string) => string;
  formatAmount: (n: number) => string;
  catMap: Record<number, Category>;
  activeCategories: Category[];
  activePayees: Payee[];
  payeeMap: Record<number, Payee>;
  refreshCategories?: () => Promise<void>;
  refreshPayees?: () => Promise<void>;
  decimalPlaces: number;
}

function editableCellActivate(
  editing: CellEditingAPI,
  expense: Expense,
  field: Parameters<CellEditingAPI["switchCellEdit"]>[1],
) {
  const activate = () => {
    editing.switchCellEdit(expense, field);
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (
        e.target instanceof Element &&
        e.target.closest("[data-no-cell-switch]")
      )
        return;
      activate();
    },
    onClick: (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      activate();
    },
  };
}

export function getExpenseColumns({
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
  decimalPlaces,
}: GetExpenseColumnsParams): ColumnDef<Expense>[] {
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
      meta: {
        className: "text-center w-10",
        cellClassName: "text-center",
        width: "2.5rem",
      },
    },
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => {
        const exp = row.original;
        if (editing.isCellEditing(exp.id as number, "date")) {
          return (
            <div data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
              <DatePicker
                value={exp.date ?? ""}
                variant="inline"
                autoOpen
                onChange={(iso) => {
                  editing.createOnCommit(exp.id as number, "date")(iso);
                }}
                onCancel={editing.createOnCancel()}
                onTab={(shiftKey) =>
                  editing.handleTabNavigation(exp, "date", shiftKey)
                }
              />
            </div>
          );
        }
        return (
          <span
            data-editable-cell
            data-expense-id={exp.id}
            data-field="date"
            {...editableCellActivate(editing, exp, "date")}
            className="cursor-pointer"
          >
            {formatDate(exp.date)}
          </span>
        );
      },
      meta: {
        className: "text-left",
        cellClassName: "text-theme-text whitespace-nowrap overflow-hidden",
        width: "6.5rem",
        getCellClassName: (exp: Expense) =>
          editing.isCellEditing(exp.id as number, "date") ? "cell-editing" : "",
      },
    },
    {
      id: "payee",
      header: "Payee",
      cell: ({ row }) => {
        const exp = row.original;
        if (editing.isCellEditing(exp.id as number, "payeeId")) {
          return (
            <div data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
              <CreatableCombobox
                value={exp.payeeId}
                variant="inline"
                options={activePayees.map((p) => ({
                  id: p.id as number,
                  label: normalizeName(p.name),
                }))}
                placeholder="Select payee…"
                createHint="Type a new payee name to add it."
                allowCreate
                autoOpen={editing.shouldAutoOpenEditor(
                  exp.id as number,
                  "payeeId",
                )}
                autoFocus
                onChange={(id) => {
                  const numId = id != null ? Number(id) : undefined;
                  editing.createOnCommit(exp.id as number, "payeeId", {
                    stayInEdit: true,
                  })(numId);
                }}
                onCreate={async (name) => {
                  const newId = await StorageService.addPayee(name);
                  if (newId == null) throw new Error("Failed to create payee");
                  editing.setPendingName(
                    exp.id as number,
                    "payeeId",
                    name.trim(),
                  );
                  await refreshPayees?.();
                  return newId as number;
                }}
                onCancel={editing.createOnCancel()}
                onTab={(shiftKey) =>
                  editing.handleTabNavigation(exp, "payeeId", shiftKey)
                }
              />
            </div>
          );
        }
        return (
          <span
            data-editable-cell
            data-expense-id={exp.id}
            data-field="payeeId"
            {...editableCellActivate(editing, exp, "payeeId")}
            className={cn(
              "cursor-pointer",
              payeeMap[exp.payeeId as number]?.isArchived
                ? "text-theme-muted italic"
                : "text-theme-text font-medium",
            )}
          >
            {exp.payeeId && payeeMap[exp.payeeId as number]
              ? normalizeName(payeeMap[exp.payeeId as number].name)
              : exp.payeeId
                ? (editing.getPendingName(exp.id as number, "payeeId") ?? "—")
                : "—"}
          </span>
        );
      },
      meta: {
        className: "text-left hidden sm:table-cell",
        cellClassName: "whitespace-nowrap overflow-hidden",
        width: "9rem",
        getCellClassName: (exp: Expense) =>
          editing.isCellEditing(exp.id as number, "payeeId")
            ? "cell-editing"
            : "",
      },
    },
    {
      id: "category",
      header: "Category",
      cell: ({ row }) => {
        const exp = row.original;
        if (editing.isCellEditing(exp.id as number, "categoryId")) {
          return (
            <div data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
              <CreatableCombobox
                value={exp.categoryId}
                variant="inline"
                options={activeCategories.map((c) => ({
                  id: c.id as number,
                  label: normalizeName(c.name),
                }))}
                placeholder="Select category…"
                createHint="Type a new category name to add it."
                allowCreate
                autoOpen={editing.shouldAutoOpenEditor(
                  exp.id as number,
                  "categoryId",
                )}
                autoFocus
                onChange={(id) => {
                  const numId = id != null ? Number(id) : undefined;
                  editing.createOnCommit(exp.id as number, "categoryId", {
                    stayInEdit: true,
                  })(numId);
                }}
                onCreate={async (name) => {
                  const newId = await StorageService.addCategory(name);
                  if (newId == null)
                    throw new Error("Failed to create category");
                  editing.setPendingName(
                    exp.id as number,
                    "categoryId",
                    name.trim(),
                  );
                  await refreshCategories?.();
                  return newId as number;
                }}
                onCancel={editing.createOnCancel()}
                onTab={(shiftKey) =>
                  editing.handleTabNavigation(exp, "categoryId", shiftKey)
                }
              />
            </div>
          );
        }
        return (
          <span
            data-editable-cell
            data-expense-id={exp.id}
            data-field="categoryId"
            {...editableCellActivate(editing, exp, "categoryId")}
            className={cn(
              "cursor-pointer",
              catMap[exp.categoryId as number]?.isArchived
                ? "text-theme-muted italic"
                : "text-theme-text font-medium",
            )}
          >
            {catMap[exp.categoryId as number]
              ? catMap[exp.categoryId as number].isArchived
                ? `${normalizeName(catMap[exp.categoryId as number].name)} (deleted)`
                : normalizeName(catMap[exp.categoryId as number].name)
              : (editing.getPendingName(exp.id as number, "categoryId") ??
                "Uncategorized")}
          </span>
        );
      },
      meta: {
        className: "text-left",
        cellClassName: "whitespace-nowrap overflow-hidden",
        width: "9rem",
        getCellClassName: (exp: Expense) =>
          editing.isCellEditing(exp.id as number, "categoryId")
            ? "cell-editing"
            : "",
      },
    },
    {
      id: "description",
      header: "Description",
      cell: ({ row }) => {
        const exp = row.original;
        if (editing.isCellEditing(exp.id as number, "description")) {
          return (
            <InlineEditCell
              initialValue={exp.description ?? ""}
              onCommit={editing.createOnCommit(exp.id as number, "description")}
              onCancel={editing.createOnCancel()}
              onTab={(shiftKey) =>
                editing.handleTabNavigation(exp, "description", shiftKey)
              }
            />
          );
        }
        return (
          <span
            data-editable-cell
            data-expense-id={exp.id}
            data-field="description"
            {...editableCellActivate(editing, exp, "description")}
            className="cursor-pointer"
          >
            {exp.description || <span className="text-theme-muted">—</span>}
          </span>
        );
      },
      meta: {
        className: "text-left",
        cellClassName: "text-theme-text overflow-hidden truncate",
        getCellClassName: (exp: Expense) =>
          editing.isCellEditing(exp.id as number, "description")
            ? "cell-editing"
            : "",
      },
    },
    {
      id: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const exp = row.original;
        const amountColor =
          (exp.amount ?? 0) < 0 ? "text-theme-success" : "text-theme-primary";
        if (editing.isCellEditing(exp.id as number, "amount")) {
          return (
            <InlineEditCell
              initialValue={
                exp.amount != null ? exp.amount.toFixed(decimalPlaces) : ""
              }
              onCommit={(val) => {
                const parsed = val ? parseFloat(val) : undefined;
                editing.createOnCommit(exp.id as number, "amount")(parsed);
              }}
              onCancel={editing.createOnCancel()}
              onTab={(shiftKey) =>
                editing.handleTabNavigation(exp, "amount", shiftKey)
              }
              validate={(val) => editing.validateField("amount", val)}
              error={editing.validationError}
              type="number"
              className="text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          );
        }
        return (
          <span
            data-editable-cell
            data-expense-id={exp.id}
            data-field="amount"
            {...editableCellActivate(editing, exp, "amount")}
            className={cn("cursor-pointer", amountColor)}
          >
            {formatAmount(exp.amount ?? 0)}
          </span>
        );
      },
      meta: {
        className: "text-right tabular-nums",
        cellClassName: "text-right tabular-nums font-semibold whitespace-nowrap",
        width: "6.5rem",
        getCellClassName: (exp: Expense) =>
          editing.isCellEditing(exp.id as number, "amount")
            ? "cell-editing"
            : "",
      },
    },
  ];
}
