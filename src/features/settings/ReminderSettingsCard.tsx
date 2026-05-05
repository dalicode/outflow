import Card from "../../components/ui/Card";
import { useSettings } from "../../context/settingsContext";
import { cn } from "../../utils/cn";

const WEEKDAYS = [
  { value: "0", label: "Sun" },
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
];

export default function ReminderSettingsCard() {
  const { settings, save } = useSettings();

  const reminderDays = settings.reminderDays ?? WEEKDAYS.map((day) => day.value);

  return (
    <Card title="Gentle check-ins">
      <p className="text-xs text-theme-muted mb-3">
        Optional reminders to log spending without pressure.
      </p>

      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm text-theme-text">Enable check-ins</span>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(settings.enableCheckInReminders)}
            onClick={() =>
              void save({
                enableCheckInReminders: !settings.enableCheckInReminders,
              }).catch((error) =>
                console.warn("Reminder setting save failed:", error),
              )
            }
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
              settings.enableCheckInReminders
                ? "bg-theme-primary"
                : "bg-theme-border",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                settings.enableCheckInReminders ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </label>

        <label className="flex flex-col gap-1 text-xs text-theme-muted">
          Reminder time
          <input
            type="time"
            value={settings.reminderTime ?? "20:00"}
            onChange={(e) =>
              void save({ reminderTime: e.target.value }).catch((error) =>
                console.warn("Reminder time save failed:", error),
              )
            }
            className="input-theme px-3 py-2 text-sm max-w-[10rem]"
          />
        </label>

        <div>
          <div className="mb-1 text-xs text-theme-muted">Days</div>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const active = reminderDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? reminderDays.filter((value) => value !== day.value)
                      : [...reminderDays, day.value];
                    void save({ reminderDays: next }).catch((error) =>
                      console.warn("Reminder day save failed:", error),
                    );
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-theme-primary bg-theme-primary-subtle text-theme-primary"
                      : "border-theme-border bg-theme-surface text-theme-muted hover:text-theme-text hover:bg-theme-border",
                  )}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-theme-muted">
          Preview: “Ready for a quick spending check-in?”
        </p>
      </div>
    </Card>
  );
}
