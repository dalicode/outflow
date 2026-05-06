import { useMemo } from "react";
import { useSettings } from "../../context/settingsContext";
import Card from "../../components/ui/Card";
import { shouldShowCheckInReminder } from "../../utils/reminderUtils";
import type { Expense } from "../../types";

interface CheckInReminderCardProps {
  expenses: Expense[];
  onAddExpense: () => void;
}

export default function CheckInReminderCard({
  expenses,
  onAddExpense,
}: CheckInReminderCardProps) {
  const { settings, save } = useSettings();

  const shouldShow = useMemo(
    () => shouldShowCheckInReminder(settings, expenses),
    [expenses, settings],
  );

  if (!shouldShow) return null;

  return (
    <Card variant="minimal" className="mb-4 border-[color:color-mix(in_srgb,var(--theme-border)_70%,var(--theme-surface))]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-theme-text">
            Ready for a quick spending check-in?
          </p>
          <p className="text-xs text-theme-muted">
            Add anything from today in under 30 seconds.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={onAddExpense} className="btn-modal-primary">
            Add Expense
          </button>
          <button
            onClick={() =>
              void save({
                lastCheckInDismissedAt: new Date().toISOString(),
              }).catch((error) => console.warn("Reminder dismiss save failed:", error))
            }
            className="btn-cancel-sm"
          >
            Not now
          </button>
        </div>
      </div>
    </Card>
  );
}
