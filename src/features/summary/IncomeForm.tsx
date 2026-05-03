import { useState } from "react";
import { useSettings } from "../../context/settingsContext";
import IncomeModalForm from "../../components/forms/IncomeModalForm";

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

  const cardIncome = parseFloat(String(income || 0));
  const cardFreq = frequency || "monthly";

  // Use Summary page's MULTIPLIERS for display
  const MULTIPLIERS: Record<string, number> = {
    monthly: 1,
    biweekly: 2.17,
    weekly: 4.33,
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-theme-text tracking-tight">
          Income
        </span>
        <button
          onClick={() => setShowModal(true)}
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

      <IncomeModalForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Edit Income"
        size="md"
        initialAmount={income ? String(income) : ""}
        initialFrequency={frequency || "monthly"}
        onSave={(data) => {
          onSave(data);
          setShowModal(false);
        }}
        description="Sets your monthly income. This affects budget calculations, savings targets, and remaining balance."
      />
    </div>
  );
}
