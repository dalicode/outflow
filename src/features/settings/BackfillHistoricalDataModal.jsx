import React, { useState, useEffect, useMemo } from "react";
import Modal from "../../components/ui/Modal";
import { StorageService } from "../../services/storageService";
import { getBackfillPreviewTimeline } from "../../utils/financeEngine";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

let _idCounter = 0;
const nextId = () => `tmp-${++_idCounter}`;

function formatAmount(amount, symbol = "$", decimals = 2) {
  const n = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(n)) return "—";
  return `${symbol}${n.toFixed(decimals)}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Convert a { month: value } map into an array of contiguous ranges.
 * Months with no entry or null/undefined are treated as gaps.
 */
function monthMapToRanges(monthMap) {
  const ranges = [];
  let current = null;
  for (let m = 1; m <= 12; m++) {
    const val = monthMap?.[m];
    if (val != null && val !== 0) {
      if (current && current.amount === val) {
        current.endMonth = m;
      } else {
        if (current) ranges.push(current);
        current = { id: nextId(), amount: val, startMonth: m, endMonth: m };
      }
    } else {
      if (current) {
        ranges.push(current);
        current = null;
      }
    }
  }
  if (current) ranges.push(current);
  return ranges;
}

/**
 * Compute monthly variable expense totals for a given year from raw expenses.
 * Returns an array of 12 numbers (index 0 = Jan).
 */
function getYearlyVariableTotals(year, expenses) {
  const totals = Array(12).fill(0);
  const prefix = `${year}-`;
  for (const e of expenses || []) {
    if (!e.date || !e.date.startsWith(prefix)) continue;
    const month = parseInt(e.date.slice(5, 7), 10) - 1;
    if (month >= 0 && month < 12) {
      totals[month] += e.amount || 0;
    }
  }
  return totals;
}

/**
 * Flatten an array of ranges into a { month: value } map.
 * Later ranges overwrite earlier ones for overlapping months.
 */
function flattenRangesToMonthMap(ranges) {
  const map = {};
  for (const range of ranges) {
    const val = parseFloat(range.amount);
    if (isNaN(val)) continue;
    const sm = clamp(parseInt(range.startMonth, 10) || 1, 1, 12);
    const em = clamp(parseInt(range.endMonth, 10) || 12, 1, 12);
    for (let m = sm; m <= em; m++) {
      map[m] = val;
    }
  }
  return map;
}

// ── Reusable sub-components (defined inside same file for cohesion) ──────────

function YearTabBar({ years, activeYear, dirtyYears, onSelect }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {years.map((y) => {
        const isActive = y === activeYear;
        const isDirty = dirtyYears.has(y);
        return (
          <button
            key={y}
            onClick={() => onSelect(y)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-theme-small whitespace-nowrap transition-colors ${
              isActive
                ? "bg-theme-primary text-white"
                : "bg-theme-background border border-theme-border text-theme-text hover:bg-theme-primary/5"
            }`}
          >
            {y}
            {isDirty && !isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-theme-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function MultiRangeList({ ranges, type, onAdd, onRemove, onUpdate }) {
  const inputCls = "input-theme px-2 py-1.5 text-sm";
  const isIncome = type === "income";
  const label = isIncome ? "Monthly Income" : "Auto Savings %";
  const placeholder = isIncome ? "e.g. 5000" : "e.g. 20";
  const step = isIncome ? "0.01" : "0.1";
  const inputWidth = isIncome ? "w-32" : "w-24";

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide block">
        {label}
      </label>
      {ranges.length === 0 && (
        <p className="text-xs text-theme-muted/60 italic">No ranges configured.</p>
      )}
      {ranges.map((range) => (
        <div key={range.id} className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            value={range.amount}
            onChange={(e) => onUpdate(range.id, { amount: e.target.value })}
            placeholder={placeholder}
            step={step}
            className={`${inputCls} ${inputWidth}`}
          />
          <select
            value={range.startMonth}
            onChange={(e) => onUpdate(range.id, { startMonth: parseInt(e.target.value, 10) })}
            className={`${inputCls} w-16`}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <span className="text-theme-muted text-xs">→</span>
          <select
            value={range.endMonth}
            onChange={(e) => onUpdate(range.id, { endMonth: parseInt(e.target.value, 10) })}
            className={`${inputCls} w-16`}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <button
            onClick={() => onRemove(range.id)}
            className="text-theme-danger hover:opacity-80 text-sm leading-none px-1"
            aria-label="Remove"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="text-xs text-theme-primary hover:opacity-80 font-medium"
      >
        + Add {isIncome ? "income" : "savings"} range
      </button>
    </div>
  );
}

function FixedExpenseList({ items, onAdd, onRemove, onUpdate, onPreset }) {
  const inputCls = "input-theme px-2 py-1.5 text-sm";
  const presets = ["Rent", "Utilities", "Insurance", "Internet", "Phone"];

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide block">
        Fixed Expenses
      </label>
      {items.length === 0 && (
        <p className="text-xs text-theme-muted/60 italic">No fixed expenses configured.</p>
      )}
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 flex-wrap">
          <input
            value={item.name}
            onChange={(e) => onUpdate(item.id, { name: e.target.value })}
            placeholder="Name"
            className={`${inputCls} w-32`}
          />
          <input
            type="number"
            value={item.amount}
            onChange={(e) => onUpdate(item.id, { amount: e.target.value })}
            placeholder="Amount"
            step="0.01"
            className={`${inputCls} w-24`}
          />
          <select
            value={item.startMonth}
            onChange={(e) => onUpdate(item.id, { startMonth: parseInt(e.target.value, 10) })}
            className={`${inputCls} w-16`}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <span className="text-theme-muted text-xs">→</span>
          <select
            value={item.endMonth}
            onChange={(e) => onUpdate(item.id, { endMonth: parseInt(e.target.value, 10) })}
            className={`${inputCls} w-16`}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <button
            onClick={() => onRemove(item.id)}
            className="text-theme-danger hover:opacity-80 text-sm leading-none px-1"
            aria-label="Remove"
          >
            &times;
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onAdd}
          className="text-xs text-theme-primary hover:opacity-80 font-medium"
        >
          + Add another
        </button>
        <span className="text-xs text-theme-muted">Quick add:</span>
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => onPreset(preset)}
            className="text-xs px-2 py-0.5 rounded-theme-small bg-theme-primary/10 text-theme-primary hover:bg-theme-primary/20 transition-colors"
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewTable({ yearConfig, variableTotals }) {
  const timeline = useMemo(() => {
    const incomeMap = flattenRangesToMonthMap(yearConfig.incomeRanges);
    const savingsMap = flattenRangesToMonthMap(yearConfig.savingsRanges);

    const fixedItems = yearConfig.fixedItems
      .filter((i) => i.name.trim() && !isNaN(parseFloat(i.amount)))
      .map((i) => ({
        name: i.name.trim(),
        amount: parseFloat(i.amount) || 0,
        startMonth: clamp(parseInt(i.startMonth, 10) || 1, 1, 12),
        endMonth: clamp(parseInt(i.endMonth, 10) || 12, 1, 12),
      }));

    return Array.from({ length: 12 }, (_, m) => {
      const month = m + 1;
      const fixedTotal = fixedItems
        .filter((i) => month >= i.startMonth && month <= i.endMonth)
        .reduce((s, i) => s + i.amount, 0);
      const variableTotal = variableTotals?.[m] || 0;
      const income = incomeMap[month] || 0;
      const rate = savingsMap[month] || 0;
      const autoSavings = Math.max(0, income * (rate / 100));
      const remaining = income - fixedTotal - variableTotal - autoSavings;
      const totalSavings = autoSavings + remaining;
      return { month, income, fixedTotal, variableTotal, autoSavings, remaining, totalSavings, rate };
    });
  }, [yearConfig, variableTotals]);

  const hasAnyData =
    yearConfig.incomeRanges.length > 0 ||
    yearConfig.savingsRanges.length > 0 ||
    yearConfig.fixedItems.length > 0 ||
    (variableTotals || []).some((v) => v > 0);

  if (!hasAnyData) return null;

  const fixedItems = yearConfig.fixedItems.filter((i) => i.name.trim());

  return (
    <div>
      <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide block mb-1.5">
        Preview
      </label>
      <div className="overflow-x-auto rounded-theme-small border border-theme-border">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-theme-background border-b border-theme-border">
              <th className="text-left px-2 py-1.5 font-semibold text-theme-muted whitespace-nowrap sticky left-0 bg-theme-background">
                Name
              </th>
              {MONTHS.map((m) => (
                <th key={m} className="text-center px-1 py-1.5 font-semibold text-theme-muted w-10">
                  {m}
                </th>
              ))}
              <th className="text-right px-2 py-1.5 font-semibold text-theme-muted whitespace-nowrap">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {fixedItems.map((item) => {
              const sm = clamp(parseInt(item.startMonth, 10) || 1, 1, 12);
              const em = clamp(parseInt(item.endMonth, 10) || 12, 1, 12);
              const amt = parseFloat(item.amount) || 0;
              const total = amt * (em - sm + 1);
              return (
                <tr key={item.id} className="border-b border-theme-border">
                  <td className="px-2 py-1.5 text-theme-text font-semibold whitespace-nowrap sticky left-0 bg-theme-background">
                    {item.name.trim()}
                  </td>
                  {Array.from({ length: 12 }, (_, m) => (
                    <td
                      key={m}
                      className={`text-center px-1 py-1.5 ${
                        m + 1 >= sm && m + 1 <= em
                          ? "text-theme-text"
                          : "text-theme-muted/40"
                      }`}
                    >
                      {m + 1 >= sm && m + 1 <= em ? formatAmount(amt) : "—"}
                    </td>
                  ))}
                  <td className="text-right px-2 py-1.5 font-semibold text-theme-text whitespace-nowrap">
                    {formatAmount(total)}
                  </td>
                </tr>
              );
            })}
            {[
              {
                label: "Variable Expenses",
                values: timeline.map((t) => t.variableTotal),
                cls: "text-theme-danger",
              },
              {
                label: "Income",
                values: timeline.map((t) => t.income),
                cls: "text-theme-success",
              },
              {
                label: "Auto Savings",
                values: timeline.map((t) => t.autoSavings),
                cls: "text-theme-primary",
              },
              {
                label: "Total Savings",
                values: timeline.map((t) => t.totalSavings),
                getCls: (val) =>
                  val > 0
                    ? "text-theme-success"
                    : val < 0
                      ? "text-theme-danger"
                      : "text-theme-text",
              },
            ].map((row) => (
              <tr key={row.label} className="border-b border-theme-border bg-theme-background/50">
                <td className="px-2 py-1.5 text-theme-text font-semibold whitespace-nowrap sticky left-0 bg-theme-background">
                  {row.label}
                </td>
                {row.values.map((val, m) => (
                  <td
                    key={m}
                    className={`text-center px-1 py-1.5 ${
                      val !== 0
                        ? row.getCls
                          ? row.getCls(val)
                          : row.cls
                        : "text-theme-muted/40"
                    }`}
                  >
                    {val !== 0 ? formatAmount(val) : "—"}
                  </td>
                ))}
                {(() => {
                  const total = row.values.reduce((s, v) => s + v, 0);
                  const totalCls = total !== 0
                    ? row.getCls
                      ? row.getCls(total)
                      : row.cls
                    : "text-theme-muted/40";
                  return (
                    <td className={`text-right px-2 py-1.5 font-semibold whitespace-nowrap ${totalCls}`}>
                      {total !== 0 ? formatAmount(total) : "—"}
                    </td>
                  );
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function BackfillHistoricalDataModal({
  isOpen,
  onClose,
  years,
  expenses = [],
  onComplete,
  defaultIncome = "",
  defaultSavingsRate = "",
}) {
  const [activeYear, setActiveYear] = useState(() =>
    years.length > 0 ? years[0] : null
  );
  const [yearConfigs, setYearConfigs] = useState({});
  const [initialYearConfigs, setInitialYearConfigs] = useState({});
  const [dirtyYears, setDirtyYears] = useState(new Set());
  const [saveMode, setSaveMode] = useState("merge");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [resultMsg, setResultMsg] = useState("");

  // Load existing data when modal opens
  useEffect(() => {
    if (!isOpen || years.length === 0) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [incomeOverrides, savingsOverrides, fixedDefs] = await Promise.all([
          StorageService.getSetting("yearlyIncomeOverrides", {}),
          StorageService.getSetting("yearlySavingsOverrides", {}),
          StorageService.getFixedExpenses(),
        ]);

        const defMap = new Map(fixedDefs.map((f) => [f.id, f]));
        const configs = {};

        for (const year of years) {
          // Income: handle legacy flat format
          let incObj = incomeOverrides[year];
          if (typeof incObj === "number") {
            incObj = {};
            for (let m = 1; m <= 12; m++) incObj[m] = incObj;
          }
          const incomeRanges = monthMapToRanges(incObj);

          // Savings: handle legacy flat format
          let savObj = savingsOverrides[year];
          if (typeof savObj === "number") {
            savObj = {};
            for (let m = 1; m <= 12; m++) savObj[m] = savObj;
          }
          const savingsRanges = monthMapToRanges(savObj);

          // Fixed expenses from snapshots
          const snapshots = await StorageService.getSnapshotsForYear(year);
          const byDef = new Map();
          for (const s of snapshots) {
            if (!byDef.has(s.fixedExpenseId)) byDef.set(s.fixedExpenseId, []);
            byDef.get(s.fixedExpenseId).push(s);
          }
          const fixedItems = [];
          for (const [defId, snaps] of byDef) {
            const def = defMap.get(defId);
            const monthMap = {};
            for (const s of snaps) monthMap[s.month] = s.amountSnapshot;
            const ranges = monthMapToRanges(monthMap);
            for (const r of ranges) {
              fixedItems.push({
                id: nextId(),
                name: def?.name || s.nameSnapshot || "Unknown",
                amount: r.amount,
                startMonth: r.startMonth,
                endMonth: r.endMonth,
                existingFixedExpenseId: defId,
              });
            }
          }

          configs[year] = { incomeRanges, savingsRanges, fixedItems };
        }

        if (!cancelled) {
          setYearConfigs(configs);
          setInitialYearConfigs(JSON.parse(JSON.stringify(configs)));
          setActiveYear(years[0]);
          setDirtyYears(new Set());
          setErrors({});
          setResultMsg("");
          setSaveMode("merge");
        }
      } catch (err) {
        console.error("Failed to load backfill data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, years]);

  const updateYearConfig = (year, patch) => {
    setYearConfigs((prev) => ({
      ...prev,
      [year]: { ...prev[year], ...patch },
    }));
    setDirtyYears((prev) => new Set(prev).add(year));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[year];
      return next;
    });
  };

  const addIncomeRange = (year) => {
    const ranges = yearConfigs[year]?.incomeRanges || [];
    updateYearConfig(year, {
      incomeRanges: [...ranges, { id: nextId(), amount: "", startMonth: 1, endMonth: 12 }],
    });
  };

  const removeIncomeRange = (year, id) => {
    const ranges = yearConfigs[year]?.incomeRanges || [];
    updateYearConfig(year, {
      incomeRanges: ranges.filter((r) => r.id !== id),
    });
  };

  const updateIncomeRange = (year, id, patch) => {
    const ranges = yearConfigs[year]?.incomeRanges || [];
    updateYearConfig(year, {
      incomeRanges: ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const addSavingsRange = (year) => {
    const ranges = yearConfigs[year]?.savingsRanges || [];
    updateYearConfig(year, {
      savingsRanges: [...ranges, { id: nextId(), rate: "", startMonth: 1, endMonth: 12 }],
    });
  };

  const removeSavingsRange = (year, id) => {
    const ranges = yearConfigs[year]?.savingsRanges || [];
    updateYearConfig(year, {
      savingsRanges: ranges.filter((r) => r.id !== id),
    });
  };

  const updateSavingsRange = (year, id, patch) => {
    const ranges = yearConfigs[year]?.savingsRanges || [];
    updateYearConfig(year, {
      savingsRanges: ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const addFixedItem = (year) => {
    const items = yearConfigs[year]?.fixedItems || [];
    updateYearConfig(year, {
      fixedItems: [
        ...items,
        { id: nextId(), name: "", amount: "", startMonth: 1, endMonth: 12 },
      ],
    });
  };

  const removeFixedItem = (year, id) => {
    const items = yearConfigs[year]?.fixedItems || [];
    updateYearConfig(year, {
      fixedItems: items.filter((i) => i.id !== id),
    });
  };

  const updateFixedItem = (year, id, patch) => {
    const items = yearConfigs[year]?.fixedItems || [];
    updateYearConfig(year, {
      fixedItems: items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
  };

  const addPreset = (year, preset) => {
    const items = yearConfigs[year]?.fixedItems || [];
    updateYearConfig(year, {
      fixedItems: [
        ...items,
        { id: nextId(), name: preset, amount: "", startMonth: 1, endMonth: 12 },
      ],
    });
  };

  const validate = () => {
    const nextErrors = {};
    let hasError = false;
    let hasAnyData = false;

    for (const year of years) {
      const config = yearConfigs[year];
      if (!config) continue;

      const yearErrors = [];

      // Validate income ranges
      for (const range of config.incomeRanges) {
        const amt = parseFloat(range.amount);
        if (isNaN(amt)) yearErrors.push("Income amount must be a number.");
        else if (amt <= 0) yearErrors.push("Income amount must be > 0.");
        if (range.startMonth > range.endMonth) yearErrors.push("Income start month must be ≤ end month.");
      }

      // Validate savings ranges
      for (const range of config.savingsRanges) {
        const rate = parseFloat(range.rate);
        if (isNaN(rate)) yearErrors.push("Savings rate must be a number.");
        else if (rate < 0 || rate > 100) yearErrors.push("Savings rate must be 0–100.");
        if (range.startMonth > range.endMonth) yearErrors.push("Savings start month must be ≤ end month.");
      }

      // Validate fixed items
      for (const item of config.fixedItems) {
        if (!item.name.trim()) yearErrors.push("Fixed expense name is required.");
        const amt = parseFloat(item.amount);
        if (isNaN(amt)) yearErrors.push("Fixed expense amount must be a number.");
        else if (amt === 0) yearErrors.push("Fixed expense amount cannot be zero.");
        if (item.startMonth > item.endMonth) yearErrors.push("Fixed expense start month must be ≤ end month.");
      }

      const yearHasData =
        config.incomeRanges.length > 0 ||
        config.savingsRanges.length > 0 ||
        config.fixedItems.length > 0;
      if (yearHasData) hasAnyData = true;

      if (yearErrors.length) {
        nextErrors[year] = yearErrors;
        hasError = true;
      }
    }

    if (!hasAnyData) {
      nextErrors._global = "Configure data for at least one year.";
      hasError = true;
    }

    setErrors(nextErrors);
    return !hasError;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const dexieDb = StorageService.db;
      let totalSnapshots = 0;

      for (const year of years) {
        const config = yearConfigs[year];
        if (!config) continue;

        const hasData =
          config.incomeRanges.length > 0 ||
          config.savingsRanges.length > 0 ||
          config.fixedItems.length > 0;
        if (!hasData) continue;

        // 1. Income overrides
        const incomeMap = flattenRangesToMonthMap(config.incomeRanges);
        if (Object.keys(incomeMap).length > 0) {
          const existing = await StorageService.getSetting("yearlyIncomeOverrides", {});
          const updated = { ...existing };
          if (saveMode === "replace") {
            updated[year] = incomeMap;
          } else {
            updated[year] = { ...updated[year], ...incomeMap };
          }
          await StorageService.setSetting("yearlyIncomeOverrides", updated);
        }

        // 2. Savings overrides
        const savingsMap = flattenRangesToMonthMap(config.savingsRanges);
        if (Object.keys(savingsMap).length > 0) {
          const existing = await StorageService.getSetting("yearlySavingsOverrides", {});
          const updated = { ...existing };
          if (saveMode === "replace") {
            updated[year] = savingsMap;
          } else {
            updated[year] = { ...updated[year], ...savingsMap };
          }
          await StorageService.setSetting("yearlySavingsOverrides", updated);
        }

        // 3. Fixed expenses & snapshots
        const validFixedItems = config.fixedItems.filter(
          (i) => i.name.trim() && !isNaN(parseFloat(i.amount)) && parseFloat(i.amount) !== 0
        );
        if (validFixedItems.length > 0) {
          if (saveMode === "replace") {
            // Atomic: delete old snapshots then insert new ones
            await dexieDb.transaction("rw", dexieDb.fixedExpenseSnapshots, async () => {
              await StorageService.deleteSnapshotsForYear(year);
              const newSnapshots = [];
              for (const item of validFixedItems) {
                const newId = await StorageService.addArchivedFixedExpense({
                  name: item.name.trim(),
                  amount: parseFloat(item.amount),
                });
                const sm = clamp(parseInt(item.startMonth, 10) || 1, 1, 12);
                const em = clamp(parseInt(item.endMonth, 10) || 12, 1, 12);
                for (let m = sm; m <= em; m++) {
                  newSnapshots.push({
                    fixedExpenseId: newId,
                    year,
                    month: m,
                    amountSnapshot: parseFloat(item.amount),
                    nameSnapshot: item.name.trim(),
                  });
                }
              }
              if (newSnapshots.length > 0) {
                await StorageService.bulkUpsertSnapshots(newSnapshots);
              }
              totalSnapshots += newSnapshots.length;
            });
          } else {
            // Merge: create new definitions + snapshots, leave old ones untouched
            const newSnapshots = [];
            for (const item of validFixedItems) {
              const newId = await StorageService.addArchivedFixedExpense({
                name: item.name.trim(),
                amount: parseFloat(item.amount),
              });
              const sm = clamp(parseInt(item.startMonth, 10) || 1, 1, 12);
              const em = clamp(parseInt(item.endMonth, 10) || 12, 1, 12);
              for (let m = sm; m <= em; m++) {
                newSnapshots.push({
                  fixedExpenseId: newId,
                  year,
                  month: m,
                  amountSnapshot: parseFloat(item.amount),
                  nameSnapshot: item.name.trim(),
                });
              }
            }
            if (newSnapshots.length > 0) {
              await StorageService.bulkUpsertSnapshots(newSnapshots);
            }
            totalSnapshots += newSnapshots.length;
          }
        }
      }

      setResultMsg(`Created/updated ${totalSnapshots} snapshot(s).`);
      onComplete?.();
    } catch (err) {
      console.error("Backfill failed:", err);
      setResultMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setYearConfigs({});
    setInitialYearConfigs({});
    setActiveYear(years.length > 0 ? years[0] : null);
    setDirtyYears(new Set());
    setSaveMode("merge");
    setErrors({});
    setResultMsg("");
    onClose();
  };

  const activeConfig = yearConfigs[activeYear] || {
    incomeRanges: [],
    savingsRanges: [],
    fixedItems: [],
  };

  const inputCls = "input-theme px-2 py-1.5 text-sm";
  const btnSecondary =
    "bg-theme-background hover:bg-theme-border text-theme-text text-xs font-medium px-2.5 py-1.5 rounded-theme-small transition-colors border border-theme-border";
  const btnPrimary =
    "bg-theme-primary hover:opacity-90 text-white text-xs font-medium px-3 py-1.5 rounded-theme-small transition-opacity";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Backfill Historical Data"
      className="max-w-3xl w-[92vw] max-h-[90vh] flex flex-col"
    >
      {loading ? (
        <div className="py-8 text-center text-sm text-theme-muted">Loading existing data…</div>
      ) : (
        <>
          <div className="space-y-4 overflow-y-auto pr-1">
            {/* Year tabs */}
            {years.length > 1 && (
              <YearTabBar
                years={years}
                activeYear={activeYear}
                dirtyYears={dirtyYears}
                onSelect={setActiveYear}
              />
            )}

            {activeYear && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-theme-text">
                    {activeYear}
                  </span>
                  {dirtyYears.has(activeYear) && (
                    <span className="text-xs text-theme-primary">(edited)</span>
                  )}
                </div>

                {/* Income ranges */}
                <MultiRangeList
                  ranges={activeConfig.incomeRanges}
                  type="income"
                  onAdd={() => addIncomeRange(activeYear)}
                  onRemove={(id) => removeIncomeRange(activeYear, id)}
                  onUpdate={(id, patch) => updateIncomeRange(activeYear, id, patch)}
                />

                {/* Savings ranges */}
                <MultiRangeList
                  ranges={activeConfig.savingsRanges}
                  type="savings"
                  onAdd={() => addSavingsRange(activeYear)}
                  onRemove={(id) => removeSavingsRange(activeYear, id)}
                  onUpdate={(id, patch) => updateSavingsRange(activeYear, id, patch)}
                />

                {/* Fixed expenses */}
                <FixedExpenseList
                  items={activeConfig.fixedItems}
                  onAdd={() => addFixedItem(activeYear)}
                  onRemove={(id) => removeFixedItem(activeYear, id)}
                  onUpdate={(id, patch) => updateFixedItem(activeYear, id, patch)}
                  onPreset={(preset) => addPreset(activeYear, preset)}
                />

                {/* Preview */}
                <PreviewTable
                  yearConfig={activeConfig}
                  variableTotals={getYearlyVariableTotals(activeYear, expenses)}
                />
              </div>
            )}

            {/* Save mode toggle */}
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-theme-muted uppercase tracking-wide">
                Save mode
              </span>
              <label className="flex items-center gap-1.5 text-xs text-theme-text cursor-pointer">
                <input
                  type="radio"
                  name="saveMode"
                  value="merge"
                  checked={saveMode === "merge"}
                  onChange={() => setSaveMode("merge")}
                  className="rounded-theme-small"
                />
                Merge (default)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-theme-text cursor-pointer">
                <input
                  type="radio"
                  name="saveMode"
                  value="replace"
                  checked={saveMode === "replace"}
                  onChange={() => setSaveMode("replace")}
                  className="rounded-theme-small"
                />
                Replace
              </label>
            </div>
            <p className="text-xs text-theme-muted">
              <strong>Merge</strong>: New values overwrite existing months. Unchanged months keep their old values. Old snapshots remain.
              <br />
              <strong>Replace</strong>: All existing snapshots for the year are deleted and replaced. Income/savings overrides are fully rewritten.
            </p>

            {/* Validation errors */}
            {errors._global && (
              <p className="text-theme-danger text-xs">{errors._global}</p>
            )}
            {Object.entries(errors)
              .filter(([k]) => k !== "_global")
              .map(([year, errs]) => (
                <div key={year} className="space-y-0.5">
                  <p className="text-theme-danger text-xs font-semibold">
                    {year}:
                  </p>
                  {errs.map((err, i) => (
                    <p key={i} className="text-theme-danger text-xs">
                      {err}
                    </p>
                  ))}
                </div>
              ))}

            {resultMsg && (
              <p
                className={`text-xs ${
                  resultMsg.startsWith("Error")
                    ? "text-theme-danger"
                    : "text-theme-success"
                }`}
              >
                {resultMsg}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-border mt-3">
            <button onClick={handleClose} className={btnSecondary} disabled={saving}>
              Cancel
            </button>
            <button onClick={handleConfirm} className={btnPrimary} disabled={saving}>
              {saving ? "Saving…" : "Confirm Backfill"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
