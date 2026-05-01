import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useSettings } from "../../context/settingsContext";
import Modal from "../../components/ui/Modal";

const FREQUENCIES = ["monthly", "biweekly", "weekly"] as const;
const MULTIPLIERS: Record<string, number> = {
  monthly: 1,
  biweekly: 2.17,
  weekly: 4.33,
};

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

interface IncomeFormProps {
  income: number | string | null | undefined;
  frequency: string | null | undefined;
  onSave: (data: {
    income: number;
    frequency: string;
    monthlyIncome: number;
  }) => void;
}

export default function IncomeForm({
  income,
  frequency,
  onSave,
}: IncomeFormProps) {
  const { formatAmount } = useSettings();
  const [showModal, setShowModal] = useState(false);
  const [amt, setAmt] = useState<string>("");
  const [freq, setFreq] = useState("monthly");
  const [monthlyBase, setMonthlyBase] = useState<number>(0);
  const [error, setError] = useState("");

  // Derive monthly base from current income + frequency
  const getMonthlyBase = useCallback(
    (val: number | string | null | undefined, f: string | null | undefined) => {
      const parsed = parseFloat(String(val || 0));
      const mult = MULTIPLIERS[f || "monthly"] || 1;
      return parsed * mult;
    },
    [],
  );

  const openModal = () => {
    const currentFreq = frequency || "monthly";
    const base = getMonthlyBase(income, currentFreq);
    setMonthlyBase(base);
    setAmt(income ? String(income) : "");
    setFreq(currentFreq);
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setError("");
  };

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
    setShowModal(false);
  };

  const inputCls = "input-theme px-3 py-2 text-sm";

  // Card always reflects the actual global values
  const cardIncome = parseFloat(String(income || 0));
  const cardFreq = frequency || "monthly";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-theme-text tracking-tight">
          Income
        </span>
        <button
          onClick={openModal}
          aria-label="Edit income"
          className="icon-btn"
        >
          <PencilIcon />
        </button>
      </div>
      <p className="text-xl font-semibold text-theme-primary">
        {formatAmount(cardIncome)}
      </p>
      <p className="text-sm text-theme-muted capitalize">
        {cardFreq} · {formatAmount(cardIncome * MULTIPLIERS[cardFreq])}/mo
      </p>

      <Modal isOpen={showModal} onClose={closeModal} title="Edit Income" size="md">
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-theme-danger text-xs">{error}</p>}
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
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="submit" className="summary-save-btn">
              Save
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="summary-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
