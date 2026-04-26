import React, { useState } from "react";
import { useSettings } from "./SettingsContext";

const EMPTY = { name: "", amount: "" };

export default function FixedExpensesList({
  items,
  onAdd,
  onUpdate,
  onDelete,
}) {
  const { formatAmount, getNumberColorClass } = useSettings();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState("");

  const validate = (name, amount) => {
    if (!name.trim()) return "Name is required.";
    if (!amount || isNaN(amount) || Number(amount) <= 0)
      return "Enter a positive amount.";
    return "";
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const err = validate(form.name, form.amount);
    if (err) {
      setError(err);
      return;
    }
    onAdd({ name: form.name.trim(), amount: parseFloat(form.amount) });
    setForm(EMPTY);
    setError("");
    setShowModal(false);
  };

  const startEdit = (item) => {
    setEditId(item.id);
    setDraft({ name: item.name, amount: item.amount });
  };
  const cancelEdit = () => {
    setEditId(null);
    setDraft(EMPTY);
  };
  const saveEdit = () => {
    const err = validate(draft.name, draft.amount);
    if (err) return;
    onUpdate(editId, {
      name: draft.name.trim(),
      amount: parseFloat(draft.amount),
    });
    cancelEdit();
  };

  const inputCls = "input-theme px-3 py-2";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
          Fixed Expenses
        </h3>
        <button
          onClick={() => {
            setForm(EMPTY);
            setError("");
            setShowModal(true);
          }}
          className="bg-theme-primary hover:opacity-90 text-white font-semibold w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none transition-opacity"
          aria-label="Add fixed expense"
        >
          +
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-theme-muted">No fixed expenses added yet.</p>
      )}

      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            {editId === item.id ? (
              <>
                <input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  className="input-theme px-2 py-1 flex-1 text-sm"
                />
                <input
                  type="number"
                  value={draft.amount}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, amount: e.target.value }))
                  }
                  className="input-theme px-2 py-1 w-24 text-sm"
                />
                <button
                  onClick={saveEdit}
                  className="text-theme-success hover:opacity-80 font-medium"
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-theme-muted hover:text-theme-text"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-theme-text">{item.name}</span>
                <span
                  className={`text-theme-muted font-medium ${getNumberColorClass(item.amount)}`}
                >
                  {formatAmount(item.amount)}
                </span>
                <button
                  onClick={() => startEdit(item)}
                  className="text-theme-primary hover:opacity-80"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-theme-danger hover:opacity-80"
                >
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-10">
          <form
            onSubmit={handleAdd}
            className="modal-theme p-6 w-full max-w-sm space-y-4"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-theme-text">
                Add Fixed Expense
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-theme-muted hover:text-theme-text text-xl leading-none"
              >
                &times;
              </button>
            </div>
            {error && <p className="text-theme-danger text-sm">{error}</p>}
            <label className="flex flex-col gap-1 text-sm text-theme-muted">
              Name
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Rent"
                autoFocus
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-theme-muted">
              Amount ($)
              <input
                type="number"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder="0.00"
                min="0.01"
                step="0.01"
                className={inputCls}
              />
            </label>
            <button
              type="submit"
              className="w-full bg-theme-primary hover:opacity-90 text-white font-medium py-2 rounded-theme-medium transition-opacity"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
