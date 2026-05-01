import { useState, useEffect, type FormEvent } from "react";
import { useSettings } from "../../context/settingsContext";
import Modal from "../../components/ui/Modal";

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

interface SavingsFormProps {
  savingsRate: number | string | null | undefined;
  onSave: (rate: number) => void;
}

export default function SavingsForm({ savingsRate, onSave }: SavingsFormProps) {
  const [showModal, setShowModal] = useState(false);
  const [rate, setRate] = useState<string>(savingsRate ? String(savingsRate) : "");
  const [error, setError] = useState("");

  useEffect(() => {
    setRate(savingsRate ? String(savingsRate) : "");
  }, [savingsRate]);

  const openModal = () => {
    setRate(savingsRate ? String(savingsRate) : "");
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setError("");
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const n = Number(rate);
    if (isNaN(n) || n < 0 || n > 100) {
      setError("Enter a value between 0 and 100.");
      return;
    }
    setError("");
    onSave(n);
    setShowModal(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-theme-text tracking-tight">Savings Goal</span>
        <button
          onClick={openModal}
          aria-label="Edit savings goal"
          className="icon-btn"
        >
          <PencilIcon />
        </button>
      </div>
      <p className="text-xl font-semibold text-theme-primary">
        {Number(rate).toFixed(1)}%
      </p>
      <p className="text-sm text-theme-muted">of monthly income</p>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="Edit Savings Goal"
        size="md"
      >
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-theme-danger text-xs">{error}</p>}
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 20"
              min="0"
              max="100"
              step="0.1"
              autoFocus
              className="input-theme px-3 py-2 text-sm w-full sm:w-28 min-w-0"
            />
            <span className="text-sm text-theme-muted shrink-0">%</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              className="summary-save-btn"
            >
              Save
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="summary-cancel-btn rounded-theme-small"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
