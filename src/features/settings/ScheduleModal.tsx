import { useState, useEffect } from "react";
import Modal from "../../components/ui/Modal";
import ModalFooter from "../../components/ui/ModalFooter";
import { StorageService } from "../../services/storageService";
import { cn } from "../../utils/cn";
import { toISODate, parseISODate } from "../../utils/historicalDataHelpers";
import type { Schedule, FixedExpense, Category } from "../../types";

const SCHEDULE_TYPES = [
  { value: "income", label: "Monthly Income" },
  { value: "savingsRate", label: "Auto Savings %" },
  { value: "fixedExpense", label: "Fixed Expense" },
  { value: "expense", label: "Expense" },
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
  const [type, setType] = useState<Schedule["type"]>("income");
  const [targetId, setTargetId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [newValue, setNewValue] = useState("");
  const [note, setNote] = useState("");
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const todayStr = toISODate(currentYear, currentMonth, now.getDate());
  const currentMonthStr = toISODate(currentYear, currentMonth, 1);

  const isReadOnly = editSchedule
    ? editSchedule.effectiveYear < currentYear ||
      (editSchedule.effectiveYear === currentYear && editSchedule.effectiveMonth <= currentMonth)
    : false;

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      const defs = await StorageService.getActiveFixedExpenses();
      setFixedExpenses(defs);
      const cats = await StorageService.getCategories();
      setCategories(cats);
    };
    load();
  }, [isOpen]);

  useEffect(() => {
    if (editSchedule) {
      setType(editSchedule.type);
      setTargetId(editSchedule.targetId ? String(editSchedule.targetId) : "");
      setEffectiveDate(
        toISODate(
          editSchedule.effectiveYear,
          editSchedule.effectiveMonth,
          editSchedule.day ?? 1,
        ),
      );
      setNewValue(String(editSchedule.newValue));
      setNote(editSchedule.note || "");
      setCategory(editSchedule.category || "");
    } else {
      reset();
    }
  }, [editSchedule, isOpen]);

  const reset = () => {
    setType("income");
    setTargetId("");
    setEffectiveDate(currentMonthStr);
    setNewValue("");
    setNote("");
    setCategory("");
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
    else if (type === "expense" && val <= 0)
      errs.push("Expense amount must be greater than 0.");

    if (type === "fixedExpense" && !targetId)
      errs.push("Please select a fixed expense.");

    if (type === "expense" && !category)
      errs.push("Please select a category.");

    // Date validation for all types
    if (!effectiveDate) {
      errs.push("Please select a date.");
    } else {
      const parsed = parseISODate(effectiveDate);
      if (!parsed) {
        errs.push("Invalid date format.");
      } else if (type === "expense") {
        if (
          parsed.year < currentYear ||
          (parsed.year === currentYear && parsed.month < currentMonth) ||
          (parsed.year === currentYear && parsed.month === currentMonth && parsed.day < now.getDate())
        ) {
          errs.push("Date must be today or in the future.");
        }
      } else {
        if (
          parsed.year < currentYear ||
          (parsed.year === currentYear && parsed.month < currentMonth)
        ) {
          errs.push("Effective date must be in the current or a future month.");
        }
      }
    }

    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const parsed = parseISODate(effectiveDate)!;
      const payload: Omit<Schedule, "id" | "isActive" | "createdAt"> =
        type === "expense"
          ? {
              type,
              targetId: null,
              effectiveYear: parsed.year,
              effectiveMonth: parsed.month,
              day: parsed.day,
              newValue: parseFloat(newValue),
              note: note.trim(),
              category,
            }
          : {
              type,
              targetId: type === "fixedExpense" ? parseInt(targetId, 10) : null,
              effectiveYear: parsed.year,
              effectiveMonth: parsed.month,
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

  const inputCls = "input-theme px-3 py-2 text-sm w-full";
  const selectCls = "input-theme px-3 py-2 text-sm w-full cursor-pointer";
  const disabledCls = " opacity-60 cursor-not-allowed";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isReadOnly ? "Schedule Details" : editSchedule ? "Edit Schedule" : "Add Schedule"}
      size="md"
      footer={
        <ScheduleModalFooter
          isReadOnly={isReadOnly}
          onClose={handleClose}
          onSave={handleSave}
          saving={saving}
          editSchedule={!!editSchedule}
        />
      }
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
            onChange={(e) => setType(e.target.value as Schedule["type"])}
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

        {/* Category (conditional for expense) */}
        {type === "expense" && (
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-theme-text">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={cn(selectCls, "w-full", isReadOnly && disabledCls)}
              disabled={isReadOnly}
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Effective Date */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-theme-text">
            {type === "expense" ? "Date" : "Effective Date"}
          </label>
          <input
            type="date"
            value={effectiveDate}
            min={type === "expense" ? todayStr : currentMonthStr}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className={cn(
              inputCls,
              "w-full",
              "date-input-theme",
              isReadOnly && disabledCls,
            )}
            disabled={isReadOnly}
          />
        </div>

        {/* Value */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-theme-text">
            {type === "savingsRate"
              ? "New Rate (%)"
              : type === "income"
                ? "New Monthly Income"
                : type === "expense"
                  ? "Amount"
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

      </div>
    </Modal>
  );
}

function ScheduleModalFooter({
  isReadOnly,
  onClose,
  onSave,
  saving,
  editSchedule,
}: {
  isReadOnly: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  editSchedule: boolean;
}) {
  return (
    <ModalFooter>
      <button onClick={onClose} className="btn-modal-cancel flex-1">
        {isReadOnly ? "Close" : "Cancel"}
      </button>
      {!isReadOnly && (
        <button
          onClick={onSave}
          className="btn-modal-primary flex-1"
          disabled={saving}
        >
          {saving ? "Saving…" : editSchedule ? "Update" : "Save Schedule"}
        </button>
      )}
    </ModalFooter>
  );
}
