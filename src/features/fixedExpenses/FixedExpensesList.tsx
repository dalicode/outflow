// @ts-nocheck
import React, { useState } from "react";
import { useSettings } from "../../context/settingsContext";

const EMPTY = { name: "", amount: "" };

function PencilIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function FixedExpensesList({
  items,
  onAdd,
  onUpdate,
  onDelete,
}) {
  const { formatAmount, getNumberColorClass } = useSettings();
  const [manageMode, setManageMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' | 'edit'
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  const validate = (name, amount) => {
    if (!name.trim()) return "Name is required.";
    if (!amount || isNaN(amount) || Number(amount) <= 0)
      return "Enter a positive amount.";
    return "";
  };

  const toggleManageMode = () => {
    setManageMode((prev) => {
      if (prev) {
        setShowModal(false);
        setForm(EMPTY);
        setError("");
      }
      return !prev;
    });
  };

  const openAdd = () => {
    setModalMode("add");
    setEditId(null);
    setForm(EMPTY);
    setError("");
    setShowModal(true);
  };

  const openEdit = (item) => {
    setModalMode("edit");
    setEditId(item.id);
    setForm({ name: item.name, amount: String(item.amount) });
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(EMPTY);
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate(form.name, form.amount);
    if (err) {
      setError(err);
      return;
    }
    if (modalMode === "add") {
      onAdd({ name: form.name.trim(), amount: parseFloat(form.amount) });
    } else {
      onUpdate(editId, {
        name: form.name.trim(),
        amount: parseFloat(form.amount),
      });
    }
    closeModal();
  };

  const inputCls = "input-theme px-3 py-2";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
          Fixed Expenses
        </h3>
        <div className="flex items-center gap-2">
          {manageMode && (
            <button
              onClick={openAdd}
              className="bg-theme-primary hover:opacity-90 text-white font-semibold w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none transition-opacity"
              aria-label="Add fixed expense"
            >
              +
            </button>
          )}
          <button
            onClick={toggleManageMode}
            aria-label={manageMode ? "Done" : "Manage fixed expenses"}
            aria-pressed={manageMode}
            className={`w-8 h-8 flex items-center justify-center rounded-theme-small transition-colors focus:outline-none focus:ring-2 focus:ring-theme-primary/40 ${
              manageMode ? "text-white" : "text-theme-muted"
            }`}
          >
            {manageMode ? <CheckIcon /> : <PencilIcon />}
          </button>
        </div>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-theme-muted">No fixed expenses added yet.</p>
      )}

      <ul className="space-y-1 divide-y divide-theme-border">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-theme-text">{item.name}</span>
            <span className={`text-theme-muted font-medium text-theme-primary`}>
              {formatAmount(item.amount)}
            </span>
            {manageMode && (
              <>
                <button
                  onClick={() => openEdit(item)}
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
            onSubmit={handleSubmit}
            className="modal-theme p-6 w-full max-w-sm space-y-4"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-theme-text">
                {modalMode === "add"
                  ? "Add Fixed Expense"
                  : "Edit Fixed Expense"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
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
              {modalMode === "add" ? "Add" : "Save"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
