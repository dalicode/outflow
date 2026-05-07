import { useState, useEffect, useMemo } from "react";
import "./settings.css";
import { useSettings } from "../../context/settingsContext";
import { useAuth } from "../../context/authContext";
import { useToasts } from "../../context/toastContext";
import { StorageService } from "../../services/storageService";
import { cn } from "../../utils/cn";
import { getLocalToday } from "../../utils/historicalDataHelpers";
import { useScheduleList } from "../../hooks/useScheduleList";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import EditHistoricalDataModal from "./EditHistoricalDataModal";
import ScheduleModal from "./ScheduleModal";
import BackupSection from "./BackupSection";
import ThemeSelector from "./ThemeSelector";
import CsvExportCard from "./CsvExportCard";
import CsvImportCard from "./CsvImportCard";
import ImportLogPanel from "./ImportLogPanel";
import ScheduleList from "./ScheduleList";
import DangerZone from "./DangerZone";
import PrivacyBackupCard from "./PrivacyBackupCard";
import type { Expense, Schedule, Category, ScheduleMaterializationNotice } from "../../types";

interface RowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}

function Row({ label, value, onChange, options }: RowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-theme-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-theme px-2.5 py-1 text-sm cursor-pointer"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

interface SettingsPageProps {
  expenses: Expense[];
  onImport?: () => Promise<void> | void;
  onRefreshAll?: () => Promise<void> | void;
  triggerSync?: () => void;
}

export default function SettingsPage({
  expenses,
  onImport,
  onRefreshAll,
  triggerSync,
}: SettingsPageProps) {
  const { settings, save, formatDate, formatAmount, currentTheme } =
    useSettings();
  const { user } = useAuth();
  const { showToast } = useToasts();

  const [importStatus, setImportStatus] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [editHistoricalDataYears, setEditHistoricalDataYears] = useState<
    number[]
  >([]);
  const [showHistoricalCompletionPrompt, setShowHistoricalCompletionPrompt] =
    useState(false);
  const [isHistoricalDataModalOpen, setIsHistoricalDataModalOpen] =
    useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<Schedule | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [savingsRate, setSavingsRate] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [appliedScheduleNotices, setAppliedScheduleNotices] = useState<
    ScheduleMaterializationNotice[]
  >([]);

  const { schedules, loadSchedules, deleteSchedule } = useScheduleList();

  useEffect(() => {
    StorageService.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    StorageService.getSetting<ScheduleMaterializationNotice[]>(
      "scheduleMaterializationLog",
      [],
    ).then((log) => {
      setAppliedScheduleNotices(Array.isArray(log) ? log : []);
    });
  }, []);

  // Load current global values for quick-add in Edit Historical Data
  useEffect(() => {
    Promise.all([
      StorageService.getSetting("monthlyIncome", 0),
      StorageService.getSetting("savingsRate", 0),
    ]).then(([income, rate]) => {
      setMonthlyIncome(String((income as number | null) ?? ""));
      setSavingsRate(String((rate as number | null) ?? ""));
    });
  }, []);

  const handleImportComplete = async (importedYears: number[]) => {
    if (importedYears.length > 0) {
      setEditHistoricalDataYears(importedYears);
      setShowHistoricalCompletionPrompt(true);
    }
    await onRefreshAll?.();
  };

  const dismissHistoricalCompletionPrompt = () => {
    setShowHistoricalCompletionPrompt(false);
    showToast({
      message:
        "You can reopen this later in Settings under the Historical Data card.",
      tone: "default",
      durationMs: 7000,
    });
  };

  const reviewHistoricalData = () => {
    setShowHistoricalCompletionPrompt(false);
    setIsHistoricalDataModalOpen(true);
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setScheduleToEdit(schedule);
    setIsScheduleModalOpen(true);
  };

  const handleAddSchedule = () => {
    setScheduleToEdit(null);
    setIsScheduleModalOpen(true);
  };

  const handleScheduleModalClose = () => {
    setIsScheduleModalOpen(false);
    setScheduleToEdit(null);
  };

  const handleDismissAppliedScheduleNotices = async () => {
    await StorageService.setSetting("scheduleMaterializationLog", []);
    setAppliedScheduleNotices([]);
  };

  const handleClearAll = async () => {
    await StorageService.clearAllData();
    setImportStatus("All data cleared successfully.");
    onRefreshAll?.();
  };

  const availableYears = useMemo(() => {
    const expenseYears = [
      ...new Set(expenses.map((e) => parseInt(e.date.slice(0, 4), 10))),
    ].sort((a, b) => a - b);

    if (editHistoricalDataYears.length === 0) {
      return expenseYears;
    }

    const importedYearSet = new Set(editHistoricalDataYears);
    return [
      ...editHistoricalDataYears,
      ...expenseYears.filter((year) => !importedYearSet.has(year)),
    ];
  }, [editHistoricalDataYears, expenses]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6" data-testid="settings-page">
      <h1 className="text-2xl font-bold text-theme-text tracking-tight">Settings</h1>

      {/* Appearance — single card */}
      <Card title="Appearance">
        <ThemeSelector
          value={settings.visualTheme}
          onChange={(v) => save({ visualTheme: v })}
        />
        <div className="flex items-center gap-2 text-xs text-theme-muted pt-1">
          <span className="inline-block w-2 h-2 rounded-full bg-theme-success" />
          Active: <span className="font-medium text-theme-text">{currentTheme.name}</span>
        </div>

        <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mt-3 mb-2">Display</p>
        <Row label="Font" value={settings.font} onChange={(v) => save({ font: v })} options={[
          ["system", "System UI"], ["sans", "Sans-serif"], ["serif", "Serif"],
          ["mono", "Monospace"], ["roboto", "Roboto"], ["georgia", "Georgia"], ["financeMono", "Data Mono"],
        ]} />
        <Row label="Font size" value={settings.fontSize} onChange={(v) => save({ fontSize: v })} options={[
          ["0.85", "Small"], ["1", "Medium"], ["1.15", "Large"], ["1.3", "X-Large"],
        ]} />
        <Row label="Currency" value={settings.currencySymbol} onChange={(v) => save({ currencySymbol: v })} options={[
          ["$", "$ Dollar"], ["€", "€ Euro"], ["£", "£ Pound"], ["¥", "¥ Yen"], ["₹", "₹ Rupee"],
        ]} />
        <Row label="Decimals" value={settings.decimalPlaces} onChange={(v) => save({ decimalPlaces: v })} options={[
          ["0", "0"], ["1", "1"], ["2", "2"],
        ]} />
        <Row label="Separator" value={settings.thousandSep} onChange={(v) => save({ thousandSep: v })} options={[
          [",", "1,000"], [".", "1.000"], [" ", "1 000"],
        ]} />
        <Row label="Date format" value={settings.dateFormat} onChange={(v) => save({ dateFormat: v })} options={[
          ["MM/DD/YYYY", "MM/DD/YYYY"], ["DD/MM/YYYY", "DD/MM/YYYY"], ["YYYY-MM-DD", "YYYY-MM-DD"],
        ]} />
        <p className="text-xs text-theme-muted pt-1">
          Preview: {formatAmount(1234567.89)} · {formatDate(getLocalToday())}
        </p>
      </Card>

      {/* Preferences — single card */}
      <Card title="Preferences">
        <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
          <div>
            <span className="text-sm text-theme-text">Haptics</span>
            <p className="text-xs text-theme-muted">Vibration feedback on mobile actions</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.hapticsEnabled}
            onClick={() => save({ hapticsEnabled: !settings.hapticsEnabled })}
            className="settings-toggle"
          >
            <span className="settings-toggle-thumb" />
          </button>
        </label>

        <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mt-3 mb-2">Reminders</p>
        <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
          <div>
            <span className="text-sm text-theme-text">Check-in reminders</span>
            <p className="text-xs text-theme-muted">Optional nudges to log spending</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(settings.enableCheckInReminders)}
            onClick={() => void save({ enableCheckInReminders: !settings.enableCheckInReminders }).catch(console.warn)}
            className="settings-toggle"
          >
            <span className="settings-toggle-thumb" />
          </button>
        </label>
        {settings.enableCheckInReminders && (
          <div className="mt-3 space-y-3">
            <label className="flex flex-col gap-1 text-xs text-theme-muted">
              Reminder time
              <input
                type="time"
                value={settings.reminderTime ?? "20:00"}
                onChange={(e) => void save({ reminderTime: e.target.value }).catch(console.warn)}
                className="input-theme px-3 py-2 text-sm max-w-[10rem]"
              />
            </label>
            <div>
              <div className="mb-1 text-xs text-theme-muted">Days</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "0", label: "Sun" }, { value: "1", label: "Mon" },
                  { value: "2", label: "Tue" }, { value: "3", label: "Wed" },
                  { value: "4", label: "Thu" }, { value: "5", label: "Fri" },
                  { value: "6", label: "Sat" },
                ].map((day) => {
                  const reminderDays = settings.reminderDays ?? ["0","1","2","3","4","5","6"];
                  const active = reminderDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? reminderDays.filter((v) => v !== day.value)
                          : [...reminderDays, day.value];
                        void save({ reminderDays: next }).catch(console.warn);
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-theme-primary bg-theme-primary-subtle text-theme-primary"
                          : "border-theme-border bg-theme-surface text-theme-muted hover:text-theme-text",
                      )}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Data — single card */}
      <Card title="Data">
        <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">Historical Data</p>
        <p className="text-xs text-theme-muted mb-2">
          Edit income, savings rate, and fixed expenses for past years.
        </p>
        <button
          onClick={() => setIsHistoricalDataModalOpen(true)}
          data-testid="btn-open-historical-data"
          className="settings-action-btn"
        >
          Edit Historical Data
        </button>

        <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mt-3 mb-2">Scheduled Changes</p>
        <div className={cn(appliedScheduleNotices.length > 0 && "pb-3 border-b border-theme-border")}>
          <ScheduleList
            schedules={schedules}
            categories={categories}
            onEdit={handleEditSchedule}
            onDelete={deleteSchedule}
          />
          <button onClick={handleAddSchedule} data-testid="btn-add-schedule" className="settings-action-btn mt-2">
            + Add Schedule
          </button>
        </div>

        {appliedScheduleNotices.length > 0 && (
          <>
            <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider mt-3 mb-2">Applied Updates</p>
            <div className="space-y-2">
              {appliedScheduleNotices.map((notice) => (
                <div key={notice.id} className="rounded-theme-small border border-theme-border bg-theme-background px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-theme-text">{notice.title}</p>
                      <p className="text-xs text-theme-muted mt-0.5">{notice.summary}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-theme-primary">
                      {notice.effectiveLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={handleDismissAppliedScheduleNotices} className="settings-edit-btn">
                Dismiss
              </button>
            </div>
          </>
        )}
      </Card>

      {/* Import / Export section */}
      <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider px-1">
        Import / Export
      </p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <CsvExportCard expenses={expenses} formatDate={formatDate} />
        <CsvImportCard
          onImportComplete={handleImportComplete}
          onStatusChange={setImportStatus}
          onErrorsChange={setImportErrors}
        />
      </div>
      <ImportLogPanel importStatus={importStatus} importErrors={importErrors} />
      <PrivacyBackupCard />
      <BackupSection user={user} onStatus={setImportStatus} onRefreshAll={onRefreshAll} triggerSync={triggerSync} />

      {/* Advanced section */}
      <p className="text-xs font-semibold text-theme-muted uppercase tracking-wider px-1">
        Advanced
      </p>
      <DangerZone onClearAll={handleClearAll} />

      {/* Modals */}
      <EditHistoricalDataModal
        isOpen={isHistoricalDataModalOpen}
        onClose={() => setIsHistoricalDataModalOpen(false)}
        years={availableYears}
        expenses={expenses}
        defaultIncome={monthlyIncome}
        defaultSavingsRate={savingsRate}
        onComplete={() => {
          setEditHistoricalDataYears([]);
          setShowHistoricalCompletionPrompt(false);
          onRefreshAll?.();
          triggerSync?.();
        }}
      />

      <Modal
        isOpen={showHistoricalCompletionPrompt && editHistoricalDataYears.length > 0}
        onClose={dismissHistoricalCompletionPrompt}
        title="Complete Imported Months"
        size="md"
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <button type="button" onClick={dismissHistoricalCompletionPrompt} className="btn-cancel-sm flex-1">
              Later
            </button>
            <button type="button" onClick={reviewHistoricalData} className="btn-modal-primary flex-1">
              Review Historical Data
            </button>
          </div>
        }
      >
        <p className="text-sm text-theme-muted">
          Your transactions were imported successfully. Add income, fixed expenses, and savings rate for{" "}
          {editHistoricalDataYears.join(", ") + " "} to make summaries and analytics accurate.
        </p>
      </Modal>

      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={handleScheduleModalClose}
        editSchedule={scheduleToEdit}
        onComplete={() => {
          loadSchedules();
          onRefreshAll?.();
        }}
      />
    </main>
  );
}
