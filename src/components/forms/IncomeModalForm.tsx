import { useState, useEffect, type FormEvent } from "react";
import Modal from "../ui/Modal";
import ModalFooter from "../ui/ModalFooter";

const FREQUENCIES = ["monthly", "biweekly", "weekly"] as const;
const MULTIPLIERS: Record<string, number> = {
  monthly: 1,
  biweekly: 2.17,
  weekly: 4.33,
};

interface IncomeModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md";

  initialAmount?: string;
  initialFrequency?: string;

  onSave: (data: {
    income: number;
    frequency: string;
    monthlyIncome: number;
  }) => void;

  description?: string;
  error?: string;
}

export default function IncomeModalForm({
  isOpen,
  onClose,
  title,
  size = "md",
  initialAmount = "",
  initialFrequency = "monthly",
  onSave,
  description,
  error: externalError,
}: IncomeModalFormProps) {
  const [amt, setAmt] = useState<string>("");
  const [freq, setFreq] = useState("monthly");
  const [monthlyBase, setMonthlyBase] = useState<number>(0);
  const [error, setError] = useState("");

  // Reset form when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      const parsed = parseFloat(initialAmount || "0");
      const mult = MULTIPLIERS[initialFrequency] || 1;
      setMonthlyBase(parsed * mult);
      setAmt(initialAmount);
      setFreq(initialFrequency);
      setError("");
    }
  }, [isOpen, initialAmount, initialFrequency]);

  const handleFreqChange = (newFreq: string) => {
    setFreq(newFreq);
    if (monthlyBase > 0) {
      const newAmt = monthlyBase / MULTIPLIERS[newFreq];
      setAmt(newAmt.toFixed(2));
    }
  };

  const handleAmtChange = (value: string) => {
    setAmt(value);
    const parsed = parseFloat(value || "0");
    if (!isNaN(parsed)) {
      setMonthlyBase(parsed * MULTIPLIERS[freq]);
    }
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseFloat(amt);
    if (!amt || isNaN(parsed) || parsed <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    setError("");
    onSave({
      income: parsed,
      frequency: freq,
      monthlyIncome: parsed * MULTIPLIERS[freq],
    });
  };

  const inputCls = "input-md";
  const displayError = externalError || error;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <ModalFooter>
          <button type="button" onClick={onClose} className="btn-cancel-sm flex-1">
            Cancel
          </button>
          <button type="submit" form="income-modal-form" data-testid="btn-save-income" className="btn-modal-primary flex-1">
            Save
          </button>
        </ModalFooter>
      }
    >
      <form id="income-modal-form" onSubmit={submit} className="space-y-4" data-testid="income-form">
        {description && (
          <p className="text-xs text-theme-muted">{description}</p>
        )}
        {displayError && (
          <p className="text-theme-danger text-xs">{displayError}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="number"
            value={amt}
            onChange={(e) => handleAmtChange(e.target.value)}
            placeholder="Amount"
            min="0.01"
            step="0.01"
            autoFocus
            className={`${inputCls} w-full sm:flex-1 min-w-0`}
          />
          <select
            value={freq}
            onChange={(e) => handleFreqChange(e.target.value)}
            className={`${inputCls} w-full sm:w-auto min-w-0`}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}

export { FREQUENCIES, MULTIPLIERS };
