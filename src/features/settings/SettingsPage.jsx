import React, { useRef, useState } from "react";
import { useSettings } from "../../context/settingsContext";
import { StorageService } from "../../services/storageService";
import { THEMES } from "../../utils/themeConfig";
import Card from "../../components/ui/Card";

function Row({ label, value, onChange, options }) {
  return (
    <div className="flex items-center justify-between py-1.5">
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

const themePreviews = {
  default: {
    background: "#f8fafc",
    border: "#e2e8f0",
    primary: "#6366f1",
    text: "#1e293b",
    isDark: false,
  },
  modernSoft: {
    background: "#f5f3ff",
    border: "#ede9fe",
    primary: "#a78bfa",
    text: "#1f1642",
    isDark: false,
  },
  sharpProfessional: {
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

function ThemeCard({ theme, isSelected, onClick }) {
  const preview = themePreviews[theme.id] || themePreviews.default;
  const radiusMap = {
    default: "8px",
    modernSoft: "16px",
    sharpProfessional: "2px",
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

function ThemeSelector({ value, onChange }) {
  const themeList = Object.values(THEMES);

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

function expenseToRow(exp, formatDate) {
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

function downloadCSV(rows, filename) {
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
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
}

function parseCSV(text) {
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

export default function SettingsPage({ expenses, onImport, onRefreshAll, triggerSync }) {
  const { settings, save, formatDate, formatAmount, currentTheme } =
    useSettings();
  const fileRef = useRef();
  const jsonFileRef = useRef();
  const [importStatus, setImportStatus] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [jsonReplaceMode, setJsonReplaceMode] = useState(false);
  const [exportRange, setExportRange] = useState({ from: "", to: "" });

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

  function parseDateInput(raw) {
    if (!raw) return null
    // Strip time & timezone: "2022/07/16 9:48:04 PM AST" → "2022/07/16"
    const datePart = raw.split(/\s+/)[0]
    // YYYY/MM/DD
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(datePart)) {
      const [y, m, d] = datePart.split('/')
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    // MM/DD/YYYY or M/D/YYYY (app default)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(datePart)) {
      const [m, d, y] = datePart.split('/')
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    // YYYY-MM-DD (already ISO)
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart
    }
    return null
  }

  function getField(row, keys) {
    for (const k of keys) {
      if (row[k] != null && row[k] !== '') return row[k]
    }
    return undefined
  }

  const [importErrors, setImportErrors] = useState([])

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus("Reading…");
    setImportErrors([]);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        setImportStatus("No data rows found. Check CSV headers and content.");
        fileRef.current.value = "";
        return;
      }

      const valid = [];
      const errors = [];
      parsed.forEach((row, i) => {
        const rawDate = getField(row, ['date', 'timestamp'])
        const rawAmount = getField(row, ['amount'])
        const amount = parseFloat(rawAmount)
        const iso = parseDateInput(rawDate)

        if (!rawDate) {
          errors.push(`Row ${i + 2}: missing date/timestamp column`)
          return
        }
        if (!iso) {
          errors.push(`Row ${i + 2}: unrecognised date format "${rawDate}"`)
          return
        }
        if (!rawAmount) {
          errors.push(`Row ${i + 2}: missing amount column`)
          return
        }
        if (isNaN(amount)) {
          errors.push(`Row ${i + 2}: amount "${rawAmount}" is not a number`)
          return
        }
        if (amount === 0) {
          errors.push(`Row ${i + 2}: amount cannot be zero`)
          return
        }
        valid.push({
          date: iso,
          category: getField(row, ['category']) || 'Uncategorized',
          description: getField(row, ['description', 'item']) || '',
          amount,
        })
      });

      setImportErrors(errors)

      if (errors.length) {
        setImportStatus(
          `${errors.length} row(s) skipped: ${errors.slice(0, 3).join("; ")}`,
        );
      }

      if (valid.length === 0) {
        setImportStatus("No valid rows found. See errors below.");
        fileRef.current.value = "";
        return;
      }

      const existing = await StorageService.getAll();
      const existingKeys = new Set(
        existing.map((e) => `${e.date}|${e.amount}|${e.description}`),
      );

      let toAdd = replaceMode
        ? valid
        : valid.filter(
            (r) => !existingKeys.has(`${r.date}|${r.amount}|${r.description}`),
          );
      const skipped = valid.length - toAdd.length;

      for (const row of toAdd) await StorageService.add(row);
      await onImport();

      setImportStatus(
        `Imported ${toAdd.length} row(s)${skipped ? `, skipped ${skipped} duplicate(s)` : ""}.${errors.length ? ` ${errors.length} invalid row(s) skipped.` : ""}`,
      );
    } catch (err) {
      console.error('Import failed:', err);
      setImportStatus(`Import failed: ${err.message}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleJsonExport = async () => {
    try {
      setImportStatus("Exporting JSON backup…");
      const data = await StorageService.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spending-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setImportStatus("JSON backup exported successfully.");
    } catch (err) {
      console.error("JSON export failed:", err);
      setImportStatus(`JSON export failed: ${err.message}`);
    }
  };

  const handleJsonImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus("Reading JSON backup…");
    setImportErrors([]);
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImportStatus("Invalid JSON file.");
        if (jsonFileRef.current) jsonFileRef.current.value = "";
        return;
      }

      if (!parsed || typeof parsed !== "object") {
        setImportStatus("Invalid data: must be an object.");
        if (jsonFileRef.current) jsonFileRef.current.value = "";
        return;
      }

      const knownKeys = [
        "expenses",
        "categories",
        "fixedExpenses",
        "fixedExpenseSnapshots",
        "settings",
        "syncQueue",
      ];
      const hasKnownKey = knownKeys.some((k) => k in parsed);
      if (!hasKnownKey) {
        setImportStatus(
          "Invalid backup: must include at least one known data key.",
        );
        if (jsonFileRef.current) jsonFileRef.current.value = "";
        return;
      }

      await StorageService.importAllData(parsed, { replace: jsonReplaceMode });
      await onRefreshAll?.();
      triggerSync?.();

      setImportStatus(
        `JSON backup imported successfully.${jsonReplaceMode ? " Existing data was replaced." : " Merged with existing data."}`,
      );
    } catch (err) {
      console.error("JSON import failed:", err);
      setImportStatus(`JSON import failed: ${err.message}`);
    }
    if (jsonFileRef.current) jsonFileRef.current.value = "";
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
      <h2 className="text-xs font-semibold text-theme-muted uppercase tracking-widest">
        Settings
      </h2>
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
          <Row
            label="Font"
            value={settings.font}
            onChange={(v) => save({ font: v })}
            options={[
              ["system", "System default"],
              ["sans", "Sans-serif"],
              ["serif", "Serif"],
              ["mono", "Monospace"],
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
          <p className="text-xs text-theme-muted pt-1">
            Preview:{" "}
            <span
              dangerouslySetInnerHTML={{ __html: formatAmount(1234567.89) }}
            />
          </p>
        </Card>
      </div>

      <Card title="Date Format">
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
        <p className="text-xs text-theme-muted pt-1">
          Preview: {formatDate(new Date().toISOString().slice(0, 10))}
        </p>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Card title="Export CSV" className="flex-1">
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
          <label className="flex items-center gap-1.5 text-xs text-theme-text mb-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={replaceMode}
              onChange={(e) => setReplaceMode(e.target.checked)}
              className="rounded-theme-small"
            />
            Replace mode
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="block w-full text-xs text-theme-muted file:mr-2 file:py-1 file:px-2 file:rounded-theme-small file:border-0 file:text-xs file:font-medium file:bg-theme-primary/10 file:text-theme-primary hover:file:bg-theme-primary/20 truncate"
          />
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Card title="Data Backup (JSON)" className="flex-1">
          <p className="text-xs text-theme-muted mb-2">
            Export or import your complete dataset including expenses, categories, fixed expenses, and settings.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleJsonExport}
              className="shrink-0 bg-theme-primary hover:opacity-90 text-white text-xs font-medium px-2.5 py-1.5 rounded-theme-small transition-opacity"
            >
              Export JSON
            </button>
          </div>
        </Card>

        <Card title="Import JSON Backup" className="flex-1">
          <label className="flex items-center gap-1.5 text-xs text-theme-text mb-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={jsonReplaceMode}
              onChange={(e) => setJsonReplaceMode(e.target.checked)}
              className="rounded-theme-small"
            />
            Replace existing data
          </label>
          <input
            ref={jsonFileRef}
            type="file"
            accept=".json"
            onChange={handleJsonImport}
            className="block w-full text-xs text-theme-muted file:mr-2 file:py-1 file:px-2 file:rounded-theme-small file:border-0 file:text-xs file:font-medium file:bg-theme-primary/10 file:text-theme-primary hover:file:bg-theme-primary/20 truncate"
          />
        </Card>
      </div>

      {(importStatus || importErrors.length > 0) && (
        <div className="bg-theme-surface rounded-theme-large shadow-sm p-4 space-y-2 border border-theme-border">
          <h2 className="text-xs font-semibold text-theme-muted uppercase tracking-widest">Import Log</h2>
          {importStatus && (
            <p className={`text-xs ${importStatus.includes("success") || importStatus.startsWith("Imported") ? "text-theme-success" : "text-theme-danger"}`}>
              {importStatus}
            </p>
          )}
          {importErrors.length > 0 && (
            <details>
              <summary className="text-xs text-theme-danger cursor-pointer select-none">
                View all {importErrors.length} error(s)
              </summary>
              <ul className="mt-1.5 max-h-32 overflow-y-auto space-y-0.5 text-xs text-theme-danger/90 font-mono">
                {importErrors.map((err, i) => (
                  <li key={i} className="break-all">{err}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </main>
  );
}
