import { useState } from "react";
import { useSettings } from "../../context/settingsContext";
import SavingsModalForm from "../../components/forms/SavingsModalForm";

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

export default function SavingsForm({
  savingsRate,
  monthlyIncome,
  onSave,
}: SavingsFormProps) {
  const { formatAmount } = useSettings();
  const [showModal, setShowModal] = useState(false);

  const cardRate = Number(savingsRate || 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-theme-text tracking-tight">
          Savings Goal
        </span>
        <button
          onClick={() => setShowModal(true)}
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

      <SavingsModalForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Edit Savings Goal"
        size="md"
        initialRate={savingsRate ? String(savingsRate) : ""}
        monthlyIncome={monthlyIncome}
        onSave={(rate) => {
          onSave(rate);
          setShowModal(false);
        }}
        description="Percentage of income automatically set aside. The remaining budget = income − fixed expenses − auto savings."
      />
    </div>
  );
}
