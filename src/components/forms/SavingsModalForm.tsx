import { useState, useEffect, type FormEvent } from "react";
import { useSettings } from "../../context/settingsContext";
import MoneyInput from "../inputs/MoneyInput";
import Modal from "../ui/Modal";
import ModalFooter from "../ui/ModalFooter";
import { cn } from "../../utils/cn";
import { resolveMoneyLocaleConfig } from "../../utils/moneyInput";

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
  const { settings } = useSettings();
  const [amountDraft, setAmountDraft] = useState<string>("");
  const [percentDraft, setPercentDraft] = useState<string>("");
  const [error, setError] = useState("");
  const moneyConfig = resolveMoneyLocaleConfig(settings.currencySymbol);

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

  const inputCls = "input-md w-full min-w-0";
  const displayError = externalError || error;
  const focusMoneyInput = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    if (event.target instanceof HTMLInputElement) return;
    const input = event.currentTarget.querySelector("input");
    input?.focus();
    input?.select();
  };

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
          <button type="submit" form="savings-modal-form" data-testid="btn-save-savings" className="btn-modal-primary flex-1">
            Save
          </button>
        </ModalFooter>
      }
    >
      <form id="savings-modal-form" onSubmit={submit} className="space-y-4" data-testid="savings-form">
        {description && (
          <p className="text-xs text-theme-muted">{description}</p>
        )}
        {displayError && (
          <p className="text-theme-danger text-xs">{displayError}</p>
        )}
        <div className="space-y-3">
          {hasIncome && (
            <div>
              <label className="block text-sm text-theme-muted mb-1">
                Amount
              </label>
              <div
                className={cn(
                  "input-md flex items-center px-3 py-0 focus-within:border-theme-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_15%,transparent)]",
                  displayError && "border-[color:color-mix(in_srgb,var(--theme-danger)_55%,var(--theme-border))] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-danger)_18%,transparent)]",
                )}
                onClick={focusMoneyInput}
              >
                <MoneyInput
                  value={Number.parseFloat(amountDraft || "0")}
                  onChange={(value) => handleAmountChange(value.toFixed(2))}
                  currency={moneyConfig.currency}
                  locale={moneyConfig.locale}
                  placeholder="e.g. 500"
                  variant="inline"
                  inputClassName="text-sm"
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm text-theme-muted mb-1">
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
      </form>
    </Modal>
  );
}
