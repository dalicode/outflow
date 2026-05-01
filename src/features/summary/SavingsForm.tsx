import { useState, type FormEvent } from "react";
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
  monthlyIncome: number;
  onSave: (rate: number) => void;
}

export default function SavingsForm({ savingsRate, monthlyIncome, onSave }: SavingsFormProps) {
  const { formatAmount } = useSettings();
  const [showModal, setShowModal] = useState(false);
  const [amountDraft, setAmountDraft] = useState<string>("");
  const [percentDraft, setPercentDraft] = useState<string>("");
  const [error, setError] = useState("");

  const openModal = () => {
    const rate = Number(savingsRate || 0);
    const amount = (rate / 100) * monthlyIncome;
    setPercentDraft(rate.toFixed(2));
    setAmountDraft(amount.toFixed(2));
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setError("");
  };

  const handleAmountChange = (value: string) => {
    setAmountDraft(value);
    const amt = parseFloat(value || "0");
    if (!isNaN(amt) && monthlyIncome > 0) {
      setPercentDraft(((amt / monthlyIncome) * 100).toFixed(2));
    }
  };

  const handlePercentChange = (value: string) => {
    setPercentDraft(value);
    const pct = parseFloat(value || "0");
    if (!isNaN(pct)) {
      setAmountDraft(((pct / 100) * monthlyIncome).toFixed(2));
    }
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const pct = parseFloat(percentDraft);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setError("Enter a value between 0 and 100.");
      return;
    }
    setError("");
    onSave(pct);
    setShowModal(false);
  };

  // Card always reflects the actual global value
  const cardRate = Number(savingsRate || 0);

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
        {formatAmount((cardRate / 100) * monthlyIncome)}
      </p>
      <p className="text-sm text-theme-muted">
        {cardRate.toFixed(1)}% of monthly income
      </p>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="Edit Savings Goal"
        size="md"
      >
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-theme-danger text-xs">{error}</p>}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-theme-muted mb-1">
                Amount
              </label>
              <input
                type="number"
                value={amountDraft}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="e.g. 500"
                min="0"
                step="0.01"
                disabled={monthlyIncome <= 0}
                className="input-theme px-3 py-2 text-sm w-full min-w-0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-theme-muted mb-1">
                Percentage
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={percentDraft}
                  onChange={(e) => handlePercentChange(e.target.value)}
                  placeholder="e.g. 20"
                  min="0"
                  max="100"
                  step="0.01"
                  autoFocus
                  className="input-theme px-3 py-2 text-sm w-full min-w-0"
                />
                <span className="text-sm text-theme-muted shrink-0">%</span>
              </div>
            </div>
          </div>
          {monthlyIncome <= 0 && (
            <p className="text-xs text-theme-muted">
              Set your income first to enable amount-based editing.
            </p>
          )}
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
