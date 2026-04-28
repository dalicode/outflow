import { useRef, useState, useEffect } from "react";
import { useSettings } from "../../context/settingsContext";
import { useAuth } from "../../context/authContext";
import { StorageService } from "../../services/storageService";
import { THEMES } from "../../utils/themeConfig";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import BackfillHistoricalDataModal from "./BackfillHistoricalDataModal";
import ScheduleModal from "./ScheduleModal";
import BackupSection from "./BackupSection";
import type { Expense, Schedule, ThemeConfig } from "../../types";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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
        className="border border-theme-border rounded-theme-medium px-2.5 py-1 text-sm bg-theme-surface text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-primary/40"
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

const themePreviews: Record<
  string,
  {
    background: string;
    border: string;
    primary: string;
    text: string;
    isDark: boolean;
  }
> = {
  default: {
    background: "#f1f5f9",
    border: "#cbd5e1",
    primary: "#334155",
    text: "#0f172a",
    isDark: false,
  },
  sharpProfessionalDark: {
    background: "#0f172a",
    border: "#334155",
    primary: "#94a3b8",
    text: "#f1f5f9",
    isDark: true,
  },
  darkMinimal: {
    background: "#09090b",
    border: "#27272a",
    primary: "#a1a1aa",
    text: "#fafafa",
    isDark: true,
  },
  runescapeClassic: {
    background: "#2b2118",
    border: "#4a3728",
    primary: "#c9a34e",
    text: "#eadfcb",
    isDark: true,
  },
};

interface ThemeCardProps {
  theme: ThemeConfig;
  isSelected: boolean;
  onClick: () => void;
}

function ThemeCard({ theme, isSelected, onClick }: ThemeCardProps) {
  const preview = themePreviews[theme.id] || themePreviews.default;
  const radiusMap: Record<string, string> = {
    default: "2px",
    sharpProfessionalDark: "2px",
    darkMinimal: "6px",
    runescapeClassic: "6px",
  };
  const cardRadius = radiusMap[theme.id] || "8px";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 w-28 sm:w-32 p-2 rounded-theme-large border-2 transition-all text-left snap-start ${
        isSelected
          ? "border-theme-primary ring-2 ring-theme-primary/30"
          : "border-transparent hover:border-theme-border"
      }`}
      style={{ background: preview.background }}
    >
      <div
        className="h-14 border overflow-hidden"
        style={{
          borderRadius: cardRadius,
          backgroundColor: preview.isDark ? "#18181b" : "#ffffff",
          borderColor: preview.border,
        }}
      >
        <div className="flex gap-1 p-1.5">
          <div
            className="h-1.5 flex-1"
            style={{
              backgroundColor: preview.primary,
              opacity: 0.7,
              borderRadius: cardRadius,
            }}
          />
          <div
            className="h-1.5 flex-1"
            style={{
              backgroundColor: preview.primary,
              opacity: 0.4,
              borderRadius: cardRadius,
            }}
          />
        </div>
        <div className="px-1.5 space-y-1">
          <div
            className="h-1.5 w-3/4"
            style={{
              backgroundColor: preview.border,
              borderRadius: cardRadius,
            }}
          />
          <div
            className="h-1.5 w-1/2"
            style={{
              backgroundColor: preview.primary,
              opacity: 0.8,
              borderRadius: cardRadius,
            }}
          />
        </div>
      </div>
      <p
        className="text-[11px] mt-1.5 text-center font-medium truncate"
        style={{ color: preview.text }}
      >
        {theme.name}
      </p>
      <div className="flex gap-1 justify-center mt-0.5">
        <span
          className="text-[9px] px-1 py-0.5 rounded-theme-small font-medium"
          style={{
            backgroundColor: preview.primary,
            color: "#fff",
            opacity: 0.9,
          }}
        >
          {theme.borderRadius.large}
        </span>
      </div>
    </button>
  );
}

interface ThemeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const themeList = Object.values(THEMES) as ThemeConfig[];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
      {themeList.map((theme) => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          isSelected={value === theme.id}
          onClick={() => onChange(theme.id)}
        />
      ))}
    </div>
  );
}

const CSV_HEADERS = [
  "Date",
  "Category",
  "Description",
  "Amount",
  "Month",
  "Year",
];

function expenseToRow(
  exp: Expense,
  formatDate: (iso: string) => string,
): (string | number)[] {
  const d = exp.date || "";
  const [y, m] = d.split("-");
  return [
    formatDate(d),
    exp.category ?? "",
    exp.description ?? "",
    exp.amount ?? 0,
    m ? parseInt(m, 10) : "",
    y ?? "",
  ];
}

const downloadCSV = (rows: (string | number)[][], filename: string) => {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [CSV_HEADERS, ...rows]
    .map((r) => r.map(escape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0]
    .split(",")
    .map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? [];
    const clean = vals.map((v) => v.replace(/^"|"$/g, "").trim());
    return Object.fromEntries(headers.map((h, i) => [h, clean[i] ?? ""]));
  });
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [exportRange, setExportRange] = useState({ from: "", to: "" });
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [backfillYears, setBackfillYears] = useState<number[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [savingsRate, setSavingsRate] = useState("");
  const [showClearModal, setShowClearModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  const { user } = useAuth();

  useEffect(() => {
    Promise.all([
      StorageService.getSetting("monthlyIncome", 0),
      StorageService.getSetting("savingsRate", 0),
    ]).then(([income, rate]) => {
      setMonthlyIncome(String((income as number | null) ?? ""));
      setSavingsRate(String((rate as number | null) ?? ""));
    });
  }, []);

  const loadSchedules = async () => {
    const all = await StorageService.getSchedules();
    setSchedules(all as Schedule[]);
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const handleExport = () => {
    let rows = expenses;
    if (exportRange.from) rows = rows.filter((e) => e.date >= exportRange.from);
    if (exportRange.to) rows = rows.filter((e) => e.date <= exportRange.to);
    const csvRows = rows.map((e) => expenseToRow(e, formatDate));
    downloadCSV(
      csvRows,
      `expenses-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  function parseDateInput(raw: string): string | null {
    if (!raw) return null;
    const datePart = raw.split(/\s+/)[0];
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(datePart)) {
      const [y, m, d] = datePart.split("/");
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(datePart)) {
      const [m, d, y] = datePart.split("/");
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
    return null;
  }

  function getField(
    row: Record<string, string>,
    keys: string[],
  ): string | undefined {
    for (const k of keys) {
      if (row[k] != null && row[k] !== "") return row[k];
    }
    return undefined;
  }

  const [importErrors, setImportErrors] = useState<string[]>([]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus("Reading…");
    setImportErrors([]);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        setImportStatus("No data rows found. Check CSV headers and content.");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      const valid: Array<{
        date: string;
        category: string;
        description: string;
        amount: number;
      }> = [];
      const errors: string[] = [];
      parsed.forEach((row, i) => {
        const rawDate = getField(row, ["date", "timestamp"]);
        const rawAmount = getField(row, ["amount"]);
        const amount = parseFloat(rawAmount ?? "");
        const iso = parseDateInput(rawDate ?? "");

        if (!rawDate) {
          errors.push(`Row ${i + 2}: missing date/timestamp column`);
          return;
        }
        if (!iso) {
          errors.push(`Row ${i + 2}: unrecognised date format "${rawDate}"`);
          return;
        }
        if (!rawAmount) {
          errors.push(`Row ${i + 2}: missing amount column`);
          return;
        }
        if (isNaN(amount)) {
          errors.push(`Row ${i + 2}: amount "${rawAmount}" is not a number`);
          return;
        }
        if (amount === 0) {
          errors.push(`Row ${i + 2}: amount cannot be zero`);
          return;
        }
        valid.push({
          date: iso,
          category: getField(row, ["category"]) || "Uncategorized",
          description: getField(row, ["description", "item"]) || "",
          amount,
        });
      });

      setImportErrors(errors);

      if (errors.length) {
        setImportStatus(
          `${errors.length} row(s) skipped: ${errors.slice(0, 3).join("; ")}`,
        );
      }

      if (valid.length === 0) {
        setImportStatus("No valid rows found. See errors below.");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      const existing = await StorageService.getAll();
      const existingKeys = new Set(
        (
          existing as Array<{
            date: string;
            amount: number;
            description?: string;
          }>
        ).map((e) => `${e.date}|${e.amount}|${e.description}`),
      );

      let toAdd = replaceMode
        ? valid
        : valid.filter(
            (r) => !existingKeys.has(`${r.date}|${r.amount}|${r.description}`),
          );
      const skipped = valid.length - toAdd.length;

      for (const row of toAdd) await StorageService.add(row);
      await onImport?.();

      const importedYears = [
        ...new Set(toAdd.map((r) => parseInt(r.date.slice(0, 4), 10))),
      ].sort((a, b) => a - b);
      setBackfillYears(importedYears);

      setImportStatus(
        `Imported ${toAdd.length} row(s)${skipped ? `, skipped ${skipped} duplicate(s)` : ""}.${errors.length ? ` ${errors.length} invalid row(s) skipped.` : ""}`,
      );
    } catch (err) {
      console.error("Import failed:", err);
      setImportStatus(`Import failed: ${(err as Error).message}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  };



  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-theme-text tracking-tight">
          Settings
        </h1>
      </div>
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
            options={[
              ["0", "0"],
              ["1", "1"],
              ["2", "2"],
            ]}
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
              dangerouslySetInnerHTML={{ __html: formatAmount(1234567.89) }}
            />
          </p>
        </Card>
      </div>

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
          Preview: {formatDate(new Date().toISOString().slice(0, 10))}
        </p>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Card title="Export CSV" className="flex-1">
          <p className="text-xs text-theme-muted mb-2">
            Download your expenses as a CSV file for a selected date range.
          </p>
          <div className="flex items-end gap-2">
            <label className="flex-1 flex flex-col gap-0.5 text-xs text-theme-muted min-w-0">
              <span className="truncate">From</span>
              <input
                type="date"
                value={exportRange.from}
                onChange={(e) =>
                  setExportRange((r) => ({ ...r, from: e.target.value }))
                }
                className="w-full border border-theme-border rounded-theme-small px-2 py-1 text-xs bg-theme-surface text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary/40"
              />
            </label>
            <label className="flex-1 flex flex-col gap-0.5 text-xs text-theme-muted min-w-0">
              <span className="truncate">To</span>
              <input
                type="date"
                value={exportRange.to}
                onChange={(e) =>
                  setExportRange((r) => ({ ...r, to: e.target.value }))
                }
                className="w-full border border-theme-border rounded-theme-small px-2 py-1 text-xs bg-theme-surface text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary/40"
              />
            </label>
            <button
              onClick={handleExport}
              className="shrink-0 bg-theme-primary hover:opacity-90 text-white text-xs font-medium px-2.5 py-1.5 rounded-theme-small transition-opacity"
            >
              Export
            </button>
          </div>
        </Card>

        <Card title="Import CSV" className="flex-1">
          <p className="text-xs text-theme-muted mb-2">
            Import expenses from a CSV file. Supports date, category,
            description, and amount columns.
          </p>
          <label className="flex items-center gap-1.5 text-xs text-theme-text mb-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={replaceMode}
              onChange={(e) => setReplaceMode(e.target.checked)}
              className="rounded-theme-small"
            />
            Replace mode
          </label>
          <label className="relative inline-flex cursor-pointer shrink-0">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
            />
            <span className="shrink-0 bg-theme-primary hover:opacity-90 text-white text-xs font-medium px-2.5 py-1.5 rounded-theme-small transition-opacity">
              Choose File
            </span>
          </label>
        </Card>
      </div>

      <BackupSection
        user={user}
        onStatus={setImportStatus}
        onRefreshAll={onRefreshAll}
        triggerSync={triggerSync}
      />

      {(importStatus || importErrors.length > 0) && (
        <div className="bg-theme-surface rounded-xl shadow-sm p-4 space-y-2">
          <h2 className="text-xs font-semibold text-theme-muted uppercase tracking-widest">
            Import Log
          </h2>
          {importStatus && (
            <p
              className={`text-xs ${importStatus.includes("success") || importStatus.startsWith("Imported") ? "text-theme-success" : "text-theme-danger"}`}
            >
              {importStatus}
            </p>
          )}
          {importErrors.length > 0 && (
            <details>
              <summary className="text-xs text-theme-danger cursor-pointer select-none">
                View all {importErrors.length} error(s)
              </summary>
              <ul className="mt-1.5 max-h-32 overflow-y-auto space-y-0.5 text-xs text-theme-danger font-mono">
                {importErrors.map((err, i) => (
                  <li key={i} className="break-all">
                    {err}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {backfillYears.length > 0 && (
        <Card title="Backfill Fixed Expenses">
          <p className="text-xs text-theme-muted mb-2">
            You imported data for {backfillYears.join(", ")}. Add fixed expenses
            retroactively to those years for accurate analytics.
          </p>
          <button
            onClick={() => setShowBackfillModal(true)}
            className="bg-theme-primary hover:opacity-90 text-white text-xs font-medium px-3 py-1.5 rounded-theme-small transition-opacity"
          >
            Backfill Fixed Expenses
          </button>
        </Card>
      )}

      {/* Standalone historical data editor */}
      <Card title="Historical Data">
        <p className="text-xs text-theme-muted mb-2">
          Edit fixed expenses, savings rate, and monthly income for past months
          and years.
        </p>
        <button
          onClick={() => setShowBackfillModal(true)}
          className="bg-theme-primary hover:opacity-90 text-white text-xs font-medium px-3 py-1.5 rounded-theme-small transition-opacity"
        >
          Edit Historical Data
        </button>
      </Card>

      <BackfillHistoricalDataModal
        isOpen={showBackfillModal}
        onClose={() => setShowBackfillModal(false)}
        years={
          backfillYears.length > 0
            ? backfillYears
            : [
                ...new Set(
                  expenses.map((e) => parseInt(e.date.slice(0, 4), 10)),
                ),
              ].sort((a, b) => a - b)
        }
        expenses={expenses}
        defaultIncome={monthlyIncome}
        defaultSavingsRate={savingsRate}
        onComplete={() => {
          setBackfillYears([]);
          onRefreshAll?.();
          triggerSync?.();
        }}
      />

      {/* Scheduled Changes */}
      <Card title="Scheduled Changes">
        <p className="text-xs text-theme-muted mb-2">
          Plan future changes to income, savings rate, and fixed expenses.
        </p>

        {schedules.length === 0 ? (
          <p className="text-xs text-theme-muted italic mb-3">
            No scheduled changes yet.
          </p>
        ) : (
          <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
            {(() => {
              const upcoming = schedules
                .filter((s) => s.isActive)
                .sort(
                  (a, b) =>
                    a.effectiveYear - b.effectiveYear ||
                    a.effectiveMonth - b.effectiveMonth,
                );

              const past = schedules
                .filter((s) => !s.isActive)
                .sort(
                  (a, b) =>
                    b.effectiveYear - a.effectiveYear ||
                    b.effectiveMonth - a.effectiveMonth,
                );

              return (
                <>
                  {upcoming.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wide">
                        Upcoming
                      </p>
                      {upcoming.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-theme-background border-l-2 border-l-theme-primary"
                        >
                          <div>
                            <span className="font-medium text-theme-text">
                              {s.type === "income"
                                ? "Income"
                                : s.type === "savingsRate"
                                  ? "Savings %"
                                  : "Fixed Exp."}
                            </span>
                            <span className="text-theme-muted mx-1">
                              &rarr;
                            </span>
                            <span className="text-theme-primary font-semibold">
                              {s.type === "savingsRate"
                                ? `${s.newValue}%`
                                : `$${s.newValue}`}
                            </span>
                            <span className="text-theme-muted ml-2">
                              {MONTHS[s.effectiveMonth - 1]} {s.effectiveYear}
                            </span>
                            {s.note && (
                              <span className="text-theme-muted ml-1">
                                ({s.note})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingSchedule(s);
                                setShowScheduleModal(true);
                              }}
                              className="text-theme-primary hover:opacity-80 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={async () => {
                                await StorageService.deleteSchedule(
                                  s.id as number,
                                );
                                loadSchedules();
                              }}
                              className="text-theme-danger hover:opacity-80 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors"
                            >
                              Del
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {past.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wide">
                        Archived
                      </p>
                      {past.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-theme-background"
                        >
                          <div>
                            <span className="font-medium text-theme-text">
                              {s.type === "income"
                                ? "Income"
                                : s.type === "savingsRate"
                                  ? "Savings %"
                                  : "Fixed Exp."}
                            </span>
                            <span className="text-theme-muted mx-1">
                              &rarr;
                            </span>
                            <span className="text-theme-primary font-semibold">
                              {s.type === "savingsRate"
                                ? `${s.newValue}%`
                                : `$${s.newValue}`}
                            </span>
                            <span className="text-theme-muted ml-2">
                              {MONTHS[s.effectiveMonth - 1]} {s.effectiveYear}
                            </span>
                            <span className="text-theme-success ml-1.5 text-[10px]">
                              &#10003;
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        <button
          onClick={() => {
            setEditingSchedule(null);
            setShowScheduleModal(true);
          }}
          className="bg-theme-primary hover:opacity-90 text-white text-xs font-medium px-3 py-1.5 rounded-theme-small transition-opacity"
        >
          + Add Schedule
        </button>
      </Card>

      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setEditingSchedule(null);
        }}
        editSchedule={editingSchedule}
        onComplete={() => {
          loadSchedules();
          onRefreshAll?.();
        }}
      />

      {/* Danger Zone */}
      <Card title="Danger Zone" className="border-theme-danger/30">
        <p className="text-xs text-theme-muted mb-2">
          Permanently delete all expenses, categories, fixed expenses,
          snapshots, and settings. This cannot be undone.
        </p>
        <button
          onClick={() => setShowClearModal(true)}
          className="bg-theme-danger hover:opacity-90 text-white text-xs font-medium px-3 py-1.5 rounded-theme-small transition-opacity"
        >
          Clear All Data
        </button>
      </Card>

      <Modal
        isOpen={showClearModal}
        onClose={() => {
          setShowClearModal(false);
          setDeleteConfirm("");
        }}
        title="Clear All Data"
        className="max-w-sm"
      >
        <div className="space-y-3">
          <p className="text-xs text-theme-muted">
            This will permanently delete{" "}
            <strong className="text-theme-text">everything</strong> — expenses,
            categories, fixed expenses, snapshots, and settings. This action
            cannot be undone.
          </p>
          <label className="flex flex-col gap-1 text-xs text-theme-muted">
            Type <span className="font-mono text-theme-danger">DELETE</span> to
            confirm
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="input-theme px-3 py-2 text-sm"
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (deleteConfirm !== "DELETE") return;
                try {
                  await StorageService.clearAllData();
                  setImportStatus("All data cleared successfully.");
                  setDeleteConfirm("");
                  setShowClearModal(false);
                  onRefreshAll?.();
                } catch (err) {
                  console.error("Clear all failed:", err);
                  setImportStatus(`Clear failed: ${(err as Error).message}`);
                }
              }}
              disabled={deleteConfirm !== "DELETE"}
              className="flex-1 bg-theme-danger hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium py-2 rounded-theme-small transition-opacity"
            >
              Clear Everything
            </button>
            <button
              onClick={() => {
                setShowClearModal(false);
                setDeleteConfirm("");
              }}
              className="flex-1 bg-theme-background hover:bg-theme-border text-theme-text text-xs font-medium py-2 rounded-theme-small transition-colors border border-theme-border"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>


    </main>
  );
}
