import { useState, useEffect } from "react";
import Modal from "../../components/ui/Modal";
import { StorageService } from "../../services/storageService";
import { cn } from "../../utils/cn";
import type { Schedule, FixedExpense } from "../../types";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const SCHEDULE_TYPES = [
  { value: "income", label: "Monthly Income" },
  { value: "savingsRate", label: "Auto Savings %" },
  { value: "fixedExpense", label: "Fixed Expense" },
];

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  editSchedule?: Schedule | null;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  onComplete,
  editSchedule = null,
}: ScheduleModalProps) {
  const [type, setType] = useState<"income" | "savingsRate" | "fixedExpense">("income");
  const [targetId, setTargetId] = useState("");
  const [effectiveYear, setEffectiveYear] = useState(new Date().getFullYear());
  const [effectiveMonth, setEffectiveMonth] = useState(new Date().getMonth() + 1);
  const [newValue, setNewValue] = useState("");
  const [note, setNote] = useState("");
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const isReadOnly = editSchedule
    ? editSchedule.effectiveYear < currentYear ||
      (editSchedule.effectiveYear === currentYear && editSchedule.effectiveMonth <= currentMonth)
    : false;

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      const defs = await StorageService.getActiveFixedExpenses();
      setFixedExpenses(defs);
    };
    load();
  }, [isOpen]);

  useEffect(() => {
    if (editSchedule) {
      setType(editSchedule.type);
      setTargetId(editSchedule.targetId ? String(editSchedule.targetId) : "");
      setEffectiveYear(editSchedule.effectiveYear);
      setEffectiveMonth(editSchedule.effectiveMonth);
      setNewValue(String(editSchedule.newValue));
      setNote(editSchedule.note || "");
    } else {
      reset();
    }
  }, [editSchedule, isOpen]);

  const reset = () => {
    setType("income");
    setTargetId("");
    setEffectiveYear(currentYear);
    setEffectiveMonth(currentMonth);
    setNewValue("");
    setNote("");
    setErrors([]);
  };

  const validate = (): boolean => {
    const errs: string[] = [];
    if (isReadOnly) {
      setErrors(errs);
      return false;
    }
    const val = parseFloat(newValue);

    if (isNaN(val)) errs.push("Value must be a number.");
    else if (type === "income" && val <= 0) errs.push("Income must be greater than 0.");
    else if (type === "savingsRate" && (val < 0 || val > 100))
      errs.push("Savings rate must be between 0 and 100.");
    else if (type === "fixedExpense" && val === 0)
      errs.push("Fixed expense amount cannot be zero.");

    if (type === "fixedExpense" && !targetId)
      errs.push("Please select a fixed expense.");

    // Effective date must be in the future (for new schedules)
    if (!editSchedule) {
      if (
        effectiveYear < currentYear ||
        (effectiveYear === currentYear && effectiveMonth < currentMonth)
      ) {
        errs.push("Effective date must be in the current or a future month.");
      }
    }

    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        type,
        targetId: type === "fixedExpense" ? parseInt(targetId, 10) : null,
        effectiveYear,
        effectiveMonth,
        newValue: parseFloat(newValue),
        note: note.trim(),
      };

      if (editSchedule && editSchedule.id != null) {
        await StorageService.updateSchedule(editSchedule.id, payload);
      } else {
        await StorageService.addSchedule(payload);
      }

      onComplete?.();
      handleClose();
    } catch (err) {
      console.error("Schedule save failed:", err);
      setErrors([`Error: ${(err as Error).message}`]);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const inputCls =
    "bg-theme-background border border-transparent rounded-lg px-3 py-2 text-sm text-theme-text placeholder:text-theme-muted shadow-sm hover:border-theme-border focus:bg-theme-surface focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15 focus:shadow-md transition-all outline-none";
  const selectCls =
    "bg-theme-background border border-transparent rounded-lg px-3 py-2 text-sm text-theme-text shadow-sm hover:border-theme-border focus:bg-theme-surface focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15 focus:shadow-md transition-all outline-none cursor-pointer";
  const disabledCls = " opacity-60 cursor-not-allowed hover:border-transparent";

  const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear + i);

  // Month filtering: for current year only show current month onwards
  const minMonth = effectiveYear === currentYear ? currentMonth : 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isReadOnly ? "Schedule Details" : editSchedule ? "Edit Schedule" : "Add Schedule"}
      className="max-w-md w-[92vw]"
    >
      <div className="space-y-4">
        {isReadOnly && (
          <div className="modal-readonly-banner">
            This schedule has already taken effect and cannot be edited.
          </div>
        )}

        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-theme-text">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "income" | "savingsRate" | "fixedExpense")}
            className={cn(selectCls, "w-full", isReadOnly && disabledCls)}
            disabled={isReadOnly}
          >
            {SCHEDULE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Target (conditional) */}
        {type === "fixedExpense" && (
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-theme-text">
              Fixed Expense
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className={cn(selectCls, "w-full", isReadOnly && disabledCls)}
              disabled={isReadOnly}
            >
              <option value="">Select…</option>
              {fixedExpenses.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Effective Date */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-theme-text">
            Effective Date
          </label>
          <div className="flex items-center gap-2">
            <select
              value={effectiveYear}
              onChange={(e) => {
                const newYear = parseInt(e.target.value, 10);
                setEffectiveYear(newYear);
                // If switching to current year and selected month is now in the past, reset to current month
                if (newYear === currentYear && effectiveMonth < currentMonth) {
                  setEffectiveMonth(currentMonth);
                }
              }}
              className={cn(selectCls, "w-28", isReadOnly && disabledCls)}
              disabled={isReadOnly}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={Math.max(effectiveMonth, minMonth)}
              onChange={(e) => setEffectiveMonth(parseInt(e.target.value, 10))}
              className={cn(selectCls, "w-28", isReadOnly && disabledCls)}
              disabled={isReadOnly}
            >
              {MONTHS.map((m, i) => {
                const monthNum = i + 1;
                if (monthNum < minMonth) return null;
                return (
                  <option key={m} value={monthNum}>
                    {m}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Value */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-theme-text">
            {type === "savingsRate"
              ? "New Rate (%)"
              : type === "income"
                ? "New Monthly Income"
                : "New Amount"}
          </label>
          <input
            type="number"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={
              type === "savingsRate" ? "e.g. 25" : "e.g. 6000"
            }
            step={type === "savingsRate" ? "0.1" : "0.01"}
            className={cn(inputCls, "w-full", isReadOnly && disabledCls)}
            disabled={isReadOnly}
          />
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-theme-text">
            Note <span className="text-theme-muted font-normal">(optional)</span>
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Annual salary review"
            className={cn(inputCls, "w-full", isReadOnly && disabledCls)}
            disabled={isReadOnly}
          />
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="space-y-1">
            {errors.map((err, i) => (
              <p key={i} className="text-theme-danger text-xs">
                {err}
              </p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={handleClose}
            className="btn-modal-cancel"
          >
            {isReadOnly ? "Close" : "Cancel"}
          </button>
          {!isReadOnly && (
            <button
              onClick={handleSave}
              className="btn-modal-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : editSchedule ? "Update" : "Save Schedule"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
