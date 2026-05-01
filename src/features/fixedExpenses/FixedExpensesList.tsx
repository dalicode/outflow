import { useState, useEffect, useRef, type FormEvent } from "react";
import { cn } from "../../utils/cn";
import { useSettings } from "../../context/settingsContext";
import Modal from "../../components/ui/Modal";
import "../expenses/expenses.css";
import type { FixedExpense } from "../../types";

const EMPTY = { name: "", amount: "" };

function PencilIcon({ className = "w-4 h-4" }: { className?: string }) {
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

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [manageMode, setManageMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  const validate = (name: string, amount: string) => {
    if (!name.trim()) return "Name is required.";
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
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
    if (err) {
      setError(err);
      return;
    }
    if (modalMode === "add") {
      onAdd({ name: form.name.trim(), amount: parseFloat(form.amount) });
    } else if (editId != null) {
      onUpdate(editId, {
        name: form.name.trim(),
        amount: parseFloat(form.amount),
      });
    }
    closeModal();
  };

  useEffect(() => {
    if (!manageMode) return;
    function handleDocDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        // Don't exit manage mode if clicking inside a modal (portal-rendered)
        const el = e.target as HTMLElement | null;
        if (el?.closest('[role="dialog"]')) return;
        setManageMode(false);
      }
    }
    document.addEventListener("mousedown", handleDocDown);
    return () => document.removeEventListener("mousedown", handleDocDown);
  }, [manageMode]);

  const inputCls = "input-theme px-3 py-2";

  return (
    <div ref={containerRef} className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-theme-text tracking-tight">
          Fixed Expenses
        </span>
        <div className="flex items-center gap-2">
          {manageMode && (
            <button
              onClick={openAdd}
              className="btn-add-circle"
              aria-label="Add fixed expense"
            >
              +
            </button>
          )}
          <button
            onClick={toggleManageMode}
            aria-label={manageMode ? "Done" : "Manage fixed expenses"}
            aria-pressed={manageMode}
            className={cn(
              "manage-toggle-btn",
              manageMode ? "text-white" : "text-theme-muted",
            )}
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
          <li key={item.id} className="flex items-center gap-2 text-xs row-hover">
            <span className="flex-1 text-theme-muted">{item.name}</span>
            <span className="text-theme-muted font-medium">
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
                  onClick={() => onDelete(item.id as number)}
                  className="text-theme-danger hover:opacity-80"
                >
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={modalMode === "add" ? "Add Fixed Expense" : "Edit Fixed Expense"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <button type="submit" className="btn-submit-fixed">
            {modalMode === "add" ? "Add" : "Save"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
