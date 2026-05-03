import { useState, useEffect, type FormEvent } from "react";
import Modal from "../ui/Modal";

interface SavingsModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md";

  initialRate?: string;
  monthlyIncome?: number;

  onSave: (rate: number) => void;

  description?: string;
  error?: string;
}

export default function SavingsModalForm({
  isOpen,
  onClose,
  title,
  size = "md",
  initialRate = "",
  monthlyIncome,
  onSave,
  description,
  error: externalError,
}: SavingsModalFormProps) {
  const [amountDraft, setAmountDraft] = useState<string>("");
  const [percentDraft, setPercentDraft] = useState<string>("");
  const [error, setError] = useState("");

  const hasIncome = (monthlyIncome ?? 0) > 0;

  // Reset form when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      const rate = Number(initialRate || 0);
      const amount = hasIncome ? (rate / 100) * (monthlyIncome ?? 0) : 0;
      setPercentDraft(rate.toFixed(2));
      setAmountDraft(amount.toFixed(2));
      setError("");
    }
  }, [isOpen, initialRate, monthlyIncome, hasIncome]);

  const handleAmountChange = (value: string) => {
    setAmountDraft(value);
    const amt = parseFloat(value || "0");
    if (!isNaN(amt) && hasIncome) {
      setPercentDraft(((amt / (monthlyIncome ?? 1)) * 100).toFixed(2));
    }
  };

  const handlePercentChange = (value: string) => {
    setPercentDraft(value);
    const pct = parseFloat(value || "0");
    if (!isNaN(pct) && hasIncome) {
      setAmountDraft(((pct / 100) * (monthlyIncome ?? 0)).toFixed(2));
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
  };

  const inputCls = "input-theme px-3 py-2 text-sm w-full min-w-0";
  const displayError = externalError || error;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
      <form onSubmit={submit} className="space-y-4">
        {description && (
          <p className="text-xs text-theme-muted">{description}</p>
        )}
        {displayError && (
          <p className="text-theme-danger text-xs">{displayError}</p>
        )}
        <div className="space-y-3">
          {hasIncome && (
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
                className={inputCls}
              />
            </div>
          )}
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
                className={inputCls}
              />
              <span className="text-sm text-theme-muted shrink-0">%</span>
            </div>
          </div>
        </div>
        {!hasIncome && (
          <p className="text-xs text-theme-muted">
            Set your income first to enable amount-based editing.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="submit" className="summary-save-btn">
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="summary-cancel-btn rounded-theme-small"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
