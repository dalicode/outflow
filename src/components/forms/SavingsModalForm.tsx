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
  const [percentCents, setPercentCents] = useState<number>(0);
  const [error, setError] = useState("");
  const moneyConfig = resolveMoneyLocaleConfig(settings.currencySymbol);

  const hasIncome = (monthlyIncome ?? 0) > 0;

  // Reset form when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      const rate = Number(initialRate || 0);
      const cents = Math.round(rate * 100);
      const amount = hasIncome ? (rate / 100) * (monthlyIncome ?? 0) : 0;
      setPercentCents(cents);
      setPercentDraft((cents / 100).toFixed(2));
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
    const pct = parseFloat(value || "0");
    if (!isNaN(pct)) {
      const cents = Math.round(Math.min(pct, 100) * 100);
      setPercentCents(cents);
      setPercentDraft((cents / 100).toFixed(2));
      if (hasIncome) {
        setAmountDraft(((cents / 100 / 100) * (monthlyIncome ?? 0)).toFixed(2));
      }
    }
  };

  const handlePercentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isDigit = /^[0-9]$/.test(e.key);

    if (isDigit) {
      e.preventDefault();
      const isSelected =
        e.currentTarget.selectionStart === 0 &&
        e.currentTarget.selectionEnd === e.currentTarget.value.length;
      const base = isSelected ? 0 : percentCents;
      const next = Math.min(base * 10 + Number(e.key), 10000);
      setPercentCents(next);
      const pct = next / 100;
      setPercentDraft(pct.toFixed(2));
      if (hasIncome) {
        setAmountDraft(((pct / 100) * (monthlyIncome ?? 0)).toFixed(2));
      }
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      const isSelected =
        e.currentTarget.selectionStart === 0 &&
        e.currentTarget.selectionEnd === e.currentTarget.value.length;
      const next = isSelected ? 0 : Math.floor(percentCents / 10);
      setPercentCents(next);
      const pct = next / 100;
      setPercentDraft(pct.toFixed(2));
      if (hasIncome) {
        setAmountDraft(((pct / 100) * (monthlyIncome ?? 0)).toFixed(2));
      }
      return;
    }

    if (e.key === "Delete") {
      e.preventDefault();
      setPercentCents(0);
      setPercentDraft("0.00");
      if (hasIncome) setAmountDraft("0.00");
      return;
    }

    if (
      e.key === "Tab" ||
      e.key === "Enter" ||
      e.key === "Escape" ||
      e.key.startsWith("Arrow") ||
      e.metaKey ||
      e.ctrlKey
    ) {
      return;
    }

    e.preventDefault();
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
        <div className="flex flex-col sm:flex-row gap-2">
          {hasIncome && (
            <div
              className={cn(
                "input-md flex items-center px-3 py-0 w-full sm:flex-1 min-w-0 focus-within:border-theme-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_15%,transparent)]",
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
                className="w-full"
                inputClassName="text-sm"
              />
            </div>
          )}
          <div
            className={cn(
              "input-md flex items-center px-3 py-0 gap-2 w-full sm:w-36 focus-within:border-theme-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_15%,transparent)]",
              displayError && "border-[color:color-mix(in_srgb,var(--theme-danger)_55%,var(--theme-border))] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-danger)_18%,transparent)]",
            )}
          >
            <input
              type="text"
              inputMode="numeric"
              value={percentDraft}
              onKeyDown={handlePercentKeyDown}
              onChange={() => {}}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="0.00"
              autoFocus
              className="flex-1 min-w-0 text-right font-semibold tabular-nums text-theme-text outline-none bg-transparent text-sm"
            />
            <span className="text-sm text-theme-muted shrink-0 pointer-events-none">%</span>
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
