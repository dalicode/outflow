import React, { useState, useMemo } from "react";
import { useSettings } from "../../context/settingsContext";

function EditableCell({ editing, value, onChange, type = "text", children }) {
  if (!editing) return <span>{children ?? value}</span>;
  if (type === "select") return children;
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
                      className="border border-theme-border rounded-theme-small px-2 py-1 text-sm w-full bg-theme-surface text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-primary/40"
    />
  );
}

export default function ExpenseTable({
  expenses,
  onUpdate,
  onDelete,
  categories = [],
  manageMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  onToggleSelectAll,
}) {
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({});
  const { formatAmount, getNumberColorClass, formatDate } = useSettings();

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );
  const activeCategories = useMemo(
    () => categories.filter((c) => !c.isDeleted),
    [categories],
  );

  const resolveName = (exp) => {
    const cat = catMap[exp.categoryId];
    if (cat) return cat.isDeleted ? `${cat.name} (deleted)` : cat.name;
    return exp.category || "Uncategorized";
  };

  const startEdit = (expense) => {
    setEditId(expense.id);
    setDraft({ ...expense });
  };
  const cancelEdit = () => {
    setEditId(null);
    setDraft({});
  };
  const saveEdit = () => {
    if (!draft.amount || isNaN(draft.amount) || Number(draft.amount) === 0)
      return;
    const cat = catMap[draft.categoryId];
    onUpdate(editId, {
      ...draft,
      amount: parseFloat(draft.amount),
      category: cat?.name ?? draft.category,
    });
    cancelEdit();
  };

  const setField = (field) => (val) =>
    setDraft((d) => ({ ...d, [field]: val }));

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-theme-muted">
          No expenses yet. Hit <strong className="text-theme-primary">+</strong> to add one.
        </p>
      </div>
    );
  }

  const allSelected =
    selectedIds.size === expenses.length && expenses.length > 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead className="sticky top-0 z-10">
          <tr>
            {manageMode && (
              <th className="px-3 py-2.5 text-center w-10 backdrop-blur-md bg-theme-surface/95 border-b border-theme-muted/20">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 rounded-theme-small cursor-pointer"
                  aria-label="Select all"
                />
              </th>
            )}
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider backdrop-blur-md bg-theme-surface/95 border-b border-theme-muted/20">
              Date
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider backdrop-blur-md bg-theme-surface/95 border-b border-theme-muted/20">
              Category
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider backdrop-blur-md bg-theme-surface/95 border-b border-theme-muted/20">
              Description
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider backdrop-blur-md bg-theme-surface/95 border-b border-theme-muted/20 tabular-nums">
              Amount
            </th>
            {manageMode && (
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-theme-muted uppercase tracking-wider backdrop-blur-md bg-theme-surface/95 border-b border-theme-muted/20">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {expenses.map((exp) => {
            const editing = editId === exp.id;
            const isSelected = selectedIds.has(exp.id);
            const amountColor = exp.amount < 0 ? "text-theme-success" : "text-theme-primary";

            return (
              <tr
                key={exp.id}
                className={`border-b border-theme-muted/10 transition-colors duration-150 hover:bg-theme-primary/[0.03] ${
                  isSelected ? "bg-theme-primary/[0.04]" : ""
                }`}
              >
                {manageMode && (
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(exp.id)}
                      className="w-4 h-4 rounded-theme-small cursor-pointer"
                      aria-label={`Select ${exp.description || "expense"}`}
                    />
                  </td>
                )}
                <td className="px-3 py-2.5 text-theme-text whitespace-nowrap">
                  <EditableCell
                    editing={editing}
                    type="date"
                    value={draft.date}
                    onChange={setField("date")}
                  >
                    {formatDate(exp.date)}
                  </EditableCell>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {editing ? (
                    <select
                      value={draft.categoryId ?? ""}
                      onChange={(e) =>
                        setField("categoryId")(Number(e.target.value))
                      }
      className="border border-theme-border rounded-theme-small px-2 py-1 text-sm w-full bg-theme-surface text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-primary/40"
                    >
                      {activeCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={
                        catMap[exp.categoryId]?.isDeleted
                          ? "text-theme-muted italic"
                          : "text-theme-text font-medium"
                      }
                    >
                      {resolveName(exp)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-theme-text max-w-[200px] truncate">
                  <EditableCell
                    editing={editing}
                    value={draft.description}
                    onChange={setField("description")}
                  >
                    {exp.description || (
                      <span className="text-theme-muted">—</span>
                    )}
                  </EditableCell>
                </td>
                <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${amountColor}`}>
                  <EditableCell
                    editing={editing}
                    type="number"
                    value={draft.amount}
                    onChange={setField("amount")}
                  >
                    {formatAmount(exp.amount)}
                  </EditableCell>
                </td>
                {manageMode && (
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    {editing ? (
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={saveEdit}
                          className="text-theme-success hover:opacity-80 font-medium text-sm transition-opacity"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-theme-muted hover:text-theme-text text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => startEdit(exp)}
                          className="text-theme-primary hover:opacity-80 text-sm font-medium transition-opacity"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(exp.id)}
                          className="text-theme-danger hover:opacity-80 text-sm transition-opacity"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
