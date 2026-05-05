import { useState, useRef, type FormEvent } from "react";
import { cn } from "../../utils/cn";
import { useSettings } from "../../context/settingsContext";
import Modal from "../../components/ui/Modal";
import ModalFooter from "../../components/ui/ModalFooter";
import "../expenses/expenses.css";
import type { FixedExpense } from "../../types";

const EMPTY = { name: "", amount: "" };

interface FixedExpensesListProps {
  items: FixedExpense[];
  onAdd: (item: Omit<FixedExpense, "id">) => void;
  onUpdate: (id: number, changes: Partial<FixedExpense>) => void;
  onDelete: (id: number) => void;
}

export default function FixedExpensesList({
  items,
  onAdd,
  onUpdate,
  onDelete,
}: FixedExpensesListProps) {
  const { formatAmount } = useSettings();
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const validate = (name: string, amount: string) => {
    if (!name.trim()) return "Name is required.";
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
      return "Enter a positive amount.";
    return "";
  };

  const openAdd = () => {
    setModalMode("add");
    setEditId(null);
    setForm(EMPTY);
    setError("");
    setShowModal(true);
  };

  const openEdit = (item: FixedExpense) => {
    setModalMode("edit");
    setEditId(item.id as number);
    setForm({ name: item.name, amount: String(item.amount) });
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(EMPTY);
    setError("");
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validate(form.name, form.amount);
    if (err) { setError(err); return; }
    if (modalMode === "add") {
      onAdd({ name: form.name.trim(), amount: parseFloat(form.amount) });
    } else if (editId != null) {
      onUpdate(editId, { name: form.name.trim(), amount: parseFloat(form.amount) });
    }
    closeModal();
  };

  const inputCls = "input-theme px-3 py-2";
  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-theme-muted uppercase tracking-wider">Fixed Expenses</p>
          {items.length > 0 && (
            <p className="text-xl font-bold text-theme-text tabular-nums mt-0.5">
              {formatAmount(total)}
              <span className="text-sm font-normal text-theme-muted ml-1">/mo</span>
            </p>
          )}
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 text-xs font-medium text-theme-primary hover:opacity-80 transition-opacity"
        >
          <span className="text-base leading-none">+</span>
          Add
        </button>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <button
          type="button"
          onClick={openAdd}
          className="w-full rounded-theme-medium border border-dashed border-theme-border py-4 text-sm text-theme-muted hover:border-theme-primary hover:text-theme-primary transition-colors"
        >
          Add rent, utilities, subscriptions…
        </button>
      )}

      {/* List */}
      {items.length > 0 && (
        <ul className="divide-y divide-theme-border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 py-2.5 group"
            >
              <span className="flex-1 text-sm text-theme-text truncate">{item.name}</span>
              <span className="text-sm font-medium text-theme-text tabular-nums shrink-0">
                {formatAmount(item.amount)}
              </span>
              {/* Edit / delete — visible on hover (desktop) or always on mobile */}
              <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(item)}
                  className="text-xs text-theme-primary hover:opacity-80"
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDeleteId(item.id as number)}
                  className="text-xs text-theme-danger hover:opacity-80"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add / Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={modalMode === "add" ? "Add Fixed Expense" : "Edit Fixed Expense"}
        size="sm"
        footer={
          <ModalFooter>
            <button type="button" onClick={closeModal} className="btn-cancel-sm flex-1">
              Cancel
            </button>
            <button type="submit" form="fixed-expense-form" className="btn-submit-fixed flex-1">
              {modalMode === "add" ? "Add" : "Save"}
            </button>
          </ModalFooter>
        }
      >
        <form id="fixed-expense-form" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-theme-muted">
            Recurring monthly expense like rent or utilities. Applied to all active months automatically.
          </p>
          {error && <p className="text-theme-danger text-sm">{error}</p>}
          <label className="flex flex-col gap-1 text-sm text-theme-muted">
            Name
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Rent"
              autoFocus
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-theme-muted">
            Monthly Amount
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              className={inputCls}
            />
          </label>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete Fixed Expense"
        size="sm"
        footer={
          <ModalFooter>
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="btn-cancel-sm flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmDeleteId != null) onDelete(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
              className="btn-modal-destructive flex-1"
            >
              Delete
            </button>
          </ModalFooter>
        }
      >
        <p className="text-sm text-theme-muted">
          This will remove the fixed expense from your budget. Existing snapshots for past months are kept.
        </p>
      </Modal>
    </div>
  );
}
