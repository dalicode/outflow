import { useState, useEffect, useMemo } from "react";
import { useSettings } from "../../context/settingsContext";
import { useAuth } from "../../context/authContext";
import { StorageService } from "../../services/storageService";
import { getLocalToday } from "../../utils/historicalDataHelpers";
import { useScheduleList } from "../../hooks/useScheduleList";
import Card from "../../components/ui/Card";
import EditHistoricalDataModal from "./EditHistoricalDataModal";
import ScheduleModal from "./ScheduleModal";
import BackupSection from "./BackupSection";
import ThemeSelector from "./ThemeSelector";
import CsvExportCard from "./CsvExportCard";
import CsvImportCard from "./CsvImportCard";
import ImportLogPanel from "./ImportLogPanel";
import ScheduleList from "./ScheduleList";
import DangerZone from "./DangerZone";
import type { Expense, Schedule } from "../../types";

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
        className="input-md"
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

  const [importStatus, setImportStatus] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [editHistoricalDataYears, setEditHistoricalDataYears] = useState<
    number[]
  >([]);
  const [isHistoricalDataModalOpen, setIsHistoricalDataModalOpen] =
    useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<Schedule | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [savingsRate, setSavingsRate] = useState("");

  const { schedules, loadSchedules, deleteSchedule } = useScheduleList();

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

  const handleImportComplete = (importedYears: number[]) => {
    setEditHistoricalDataYears(importedYears);
    onImport?.();
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

  const handleClearAll = async () => {
    await StorageService.clearAllData();
    setImportStatus("All data cleared successfully.");
    onRefreshAll?.();
  };

  const availableYears = useMemo(
    () =>
      editHistoricalDataYears.length > 0
        ? editHistoricalDataYears
        : [
            ...new Set(expenses.map((e) => parseInt(e.date.slice(0, 4), 10))),
          ].sort((a, b) => a - b),
    [editHistoricalDataYears, expenses],
  );

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-theme-text tracking-tight">
          Settings
        </h1>
      </div>

      {/* Theme */}
      <Card title="Visual Theme">
        <p className="text-xs text-theme-muted mb-2">
          Choose a visual style. Changes apply instantly and sync across
          devices.
        </p>
        <ThemeSelector
          value={settings.visualTheme}
          onChange={(v) => save({ visualTheme: v })}
        />
        <div className="flex items-center gap-2 text-xs text-theme-muted pt-1">
          <span className="inline-block w-2 h-2 rounded-full bg-theme-success" />
          Active:{" "}
          <span className="font-medium text-theme-text">
            {currentTheme.name}
          </span>
          <span className="text-theme-border">|</span>
          Radius:{" "}
          <span className="font-medium">
            {currentTheme.borderRadius.small} /{" "}
            {currentTheme.borderRadius.medium} /{" "}
            {currentTheme.borderRadius.large}
          </span>
        </div>
      </Card>

      {/* Typography + Number Format */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card title="Typography">
          <p className="text-xs text-theme-muted mb-1.5">
            Choose the font family and size for the app interface.
          </p>
          <Row
            label="Font"
            value={settings.font}
            onChange={(v) => save({ font: v })}
            options={[
              ["system", "System UI"],
              ["sans", "Sans-serif"],
              ["serif", "Serif"],
              ["mono", "Monospace"],
              ["roboto", "Roboto"],
              ["georgia", "Georgia"],
              ["financeMono", "Data Mono"],
            ]}
          />
          <Row
            label="Font size"
            value={settings.fontSize}
            onChange={(v) => save({ fontSize: v })}
            options={[
              ["0.85", "Small (0.85×)"],
              ["1", "Medium (1×)"],
              ["1.15", "Large (1.15×)"],
              ["1.3", "X-Large (1.3×)"],
            ]}
          />
        </Card>

        <Card title="Number Format">
          <p className="text-xs text-theme-muted mb-1.5">
            Set how currency amounts are displayed across the app.
          </p>
          <Row
            label="Currency"
            value={settings.currencySymbol}
            onChange={(v) => save({ currencySymbol: v })}
            options={[
              ["$", "$ Dollar"],
              ["€", "€ Euro"],
              ["£", "£ Pound"],
              ["¥", "¥ Yen"],
              ["₹", "₹ Rupee"],
            ]}
          />
          <Row
            label="Decimals"
            value={settings.decimalPlaces}
            onChange={(v) => save({ decimalPlaces: v })}
            options={[["0", "0"], ["1", "1"], ["2", "2"]]}
          />
          <Row
            label="Separator"
            value={settings.thousandSep}
            onChange={(v) => save({ thousandSep: v })}
            options={[
              [",", "1,000"],
              [".", "1.000"],
              [" ", "1 000"],
            ]}
          />
          <p className="text-xs text-theme-muted pt-0.5">
            Preview:{" "}
            <span
              dangerouslySetInnerHTML={{
                __html: formatAmount(1234567.89),
              }}
            />
          </p>
        </Card>
      </div>

      {/* Date Format */}
      <Card title="Date Format">
        <p className="text-xs text-theme-muted mb-1.5">
          Choose how dates are shown throughout the app.
        </p>
        <Row
          label="Format"
          value={settings.dateFormat}
          onChange={(v) => save({ dateFormat: v })}
          options={[
            ["MM/DD/YYYY", "MM/DD/YYYY"],
            ["DD/MM/YYYY", "DD/MM/YYYY"],
            ["YYYY-MM-DD", "YYYY-MM-DD"],
          ]}
        />
        <p className="text-xs text-theme-muted pt-0.5">
          Preview: {formatDate(getLocalToday())}
        </p>
      </Card>

      {/* Export + Import */}
      <div className="flex flex-col sm:flex-row gap-3">
        <CsvExportCard expenses={expenses} formatDate={formatDate} />
        <CsvImportCard
          onImportComplete={handleImportComplete}
          onStatusChange={setImportStatus}
          onErrorsChange={setImportErrors}
        />
      </div>

      {/* Backup */}
      <BackupSection
        user={user}
        onStatus={setImportStatus}
        onRefreshAll={onRefreshAll}
        triggerSync={triggerSync}
      />

      {/* Import Log */}
      <ImportLogPanel importStatus={importStatus} importErrors={importErrors} />

      {/* Historical Data trigger (post-import) */}
      {editHistoricalDataYears.length > 0 && (
        <Card title="Edit Historical Fixed Expenses">
          <p className="text-xs text-theme-muted mb-2">
            You imported data for {editHistoricalDataYears.join(", ")}. Add
            fixed expenses retroactively to those years for accurate analytics.
          </p>
          <button
            onClick={() => setIsHistoricalDataModalOpen(true)}
            className="btn-primary-sm"
          >
            Edit Fixed Expenses
          </button>
        </Card>
      )}

      {/* Historical Data editor */}
      <Card title="Historical Data">
        <p className="text-xs text-theme-muted mb-2">
          Edit fixed expenses, savings rate, and monthly income for past months
          and years.
        </p>
        <button
          onClick={() => setIsHistoricalDataModalOpen(true)}
          className="bg-theme-primary hover:opacity-90 text-white text-xs font-medium px-3 py-1.5 rounded-theme-small transition-opacity"
        >
          Edit Historical Data
        </button>
      </Card>

      <EditHistoricalDataModal
        isOpen={isHistoricalDataModalOpen}
        onClose={() => setIsHistoricalDataModalOpen(false)}
        years={availableYears}
        expenses={expenses}
        defaultIncome={monthlyIncome}
        defaultSavingsRate={savingsRate}
        onComplete={() => {
          setEditHistoricalDataYears([]);
          onRefreshAll?.();
          triggerSync?.();
        }}
      />

      {/* Scheduled Changes */}
      <Card title="Scheduled Changes">
        <p className="text-xs text-theme-muted mb-2">
          Plan future changes to income, savings rate, fixed expenses, and
          expenses.
        </p>
        <ScheduleList
          schedules={schedules}
          onEdit={handleEditSchedule}
          onDelete={deleteSchedule}
        />
        <button
          onClick={handleAddSchedule}
          className="bg-theme-primary hover:opacity-90 text-white text-xs font-medium px-3 py-1.5 rounded-theme-small transition-opacity"
        >
          + Add Schedule
        </button>
      </Card>

      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={handleScheduleModalClose}
        editSchedule={scheduleToEdit}
        onComplete={() => {
          loadSchedules();
          onRefreshAll?.();
        }}
      />

      {/* Danger Zone */}
      <DangerZone onClearAll={handleClearAll} />

    </main>
  );
}
