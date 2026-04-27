import React, { useState, useEffect, useMemo } from "react";
import Modal from "../../components/ui/Modal";
import { StorageService } from "../../services/storageService";
import { getBackfillPreviewTimeline } from "../../utils/financeEngine";

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

// ── Modern Ghost Input Style ────────────────────────────────────────────────
const ghostInputCls =
  "bg-theme-background border border-transparent rounded-lg px-3 py-2 text-sm text-theme-text placeholder:text-theme-muted/40 shadow-sm hover:border-theme-border focus:bg-theme-surface focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15 focus:shadow-md transition-all outline-none";

const ghostSelectCls =
  "bg-theme-background border border-transparent rounded-lg px-2 py-2 text-sm text-theme-text shadow-sm hover:border-theme-border focus:bg-theme-surface focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15 focus:shadow-md transition-all outline-none cursor-pointer";

function RemoveBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded-full text-theme-muted hover:text-theme-danger hover:bg-theme-danger/10 transition-all"
      aria-label="Remove"
    >
      <span className="text-xs leading-none">&times;</span>
    </button>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-xl bg-theme-surface border border-theme-border shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-semibold text-theme-text">{title}</h3>
      {children}
    </div>
  );
}

// ── Reusable sub-components ──────────────────────────────────────────────────

function YearTabBar({ years, activeYear, dirtyYears, onSelect }) {
  return (
    <div className="border-b border-theme-border">
      <div className="flex items-end gap-0 px-1">
        {years.map((y) => {
          const isActive = y === activeYear;
          const isDirty = dirtyYears.has(y);
          return (
            <button
              key={y}
              onClick={() => onSelect(y)}
              className={`relative px-4 py-2 text-sm font-medium rounded-t-lg border-x border-t transition-colors focus:outline-none ${
                isActive
                  ? "bg-theme-surface text-theme-primary border-t-2 border-t-theme-primary border-theme-border border-b border-b-theme-surface shadow-sm"
                  : "bg-theme-background text-theme-muted border-transparent hover:text-theme-text hover:bg-theme-background/80"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {y}
                {isDirty && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-theme-primary inline-block" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiRangeList({ ranges, type, onAdd, onRemove, onUpdate }) {
  const isIncome = type === "income";
  const label = isIncome ? "Monthly Income" : "Auto Savings %";
  const placeholder = isIncome ? "e.g. 5000" : "e.g. 20";
  const step = isIncome ? "0.01" : "0.1";
  const inputWidth = isIncome ? "w-36" : "w-28";

  return (
    <SectionCard title={label}>
      {ranges.length === 0 && (
        <p className="text-xs text-theme-muted/60 italic">
          No ranges configured.
        </p>
      )}
      <div className="space-y-2">
        {ranges.map((range) => (
          <div key={range.id} className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              value={range.amount}
              onChange={(e) => onUpdate(range.id, { amount: e.target.value })}
              placeholder={placeholder}
              step={step}
              className={`${ghostInputCls} ${inputWidth}`}
            />
            <select
              value={range.startMonth}
              onChange={(e) =>
                onUpdate(range.id, { startMonth: parseInt(e.target.value, 10) })
              }
              className={`${ghostSelectCls} w-18`}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <span className="text-theme-muted text-xs">→</span>
            <select
              value={range.endMonth}
              onChange={(e) =>
                onUpdate(range.id, { endMonth: parseInt(e.target.value, 10) })
              }
              className={`${ghostSelectCls} w-18`}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <RemoveBtn onClick={() => onRemove(range.id)} />
          </div>
        ))}
      </div>
      <button
        onClick={onAdd}
        className="text-sm text-theme-primary hover:text-theme-primary/80 font-medium transition-colors"
      >
        + Add {isIncome ? "income" : "savings"} range
      </button>
    </SectionCard>
  );
}

function FixedExpenseList({ items, onAdd, onRemove, onUpdate, onPreset }) {
  const presets = ["Rent", "Utilities", "Insurance", "Internet", "Phone"];

  return (
    <SectionCard title="Fixed Expenses">
      {items.length === 0 && (
        <p className="text-xs text-theme-muted/60 italic">
          No fixed expenses configured.
        </p>
      )}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 flex-wrap">
            <input
              value={item.name}
              onChange={(e) => onUpdate(item.id, { name: e.target.value })}
              placeholder="Name"
              className={`${ghostInputCls} w-36`}
            />
            <input
              type="number"
              value={item.amount}
              onChange={(e) => onUpdate(item.id, { amount: e.target.value })}
              placeholder="Amount"
              step="0.01"
              className={`${ghostInputCls} w-28`}
            />
            <select
              value={item.startMonth}
              onChange={(e) =>
                onUpdate(item.id, { startMonth: parseInt(e.target.value, 10) })
              }
              className={`${ghostSelectCls} w-18`}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <span className="text-theme-muted text-xs">→</span>
            <select
              value={item.endMonth}
              onChange={(e) =>
                onUpdate(item.id, { endMonth: parseInt(e.target.value, 10) })
              }
              className={`${ghostSelectCls} w-18`}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <RemoveBtn onClick={() => onRemove(item.id)} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onAdd}
          className="text-sm text-theme-primary hover:text-theme-primary/80 font-medium transition-colors"
        >
          + Add another
        </button>
        <span className="text-xs text-theme-muted">Quick add:</span>
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => onPreset(preset)}
            className="text-xs text-theme-primary hover:underline font-medium transition-all"
          >
            {preset}
          </button>
        ))}
      </div>
    </SectionCard>
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
      return {
        month,
        income,
        fixedTotal,
        variableTotal,
        autoSavings,
        remaining,
        totalSavings,
        rate,
      };
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
      <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide block mb-2">
        Preview
      </label>
      <div className="overflow-x-auto rounded-xl border border-theme-border shadow-sm">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-theme-background border-b border-theme-border">
              <th className="text-left px-2 py-1.5 font-semibold text-theme-muted whitespace-nowrap sticky left-0 bg-theme-background">
                Name
              </th>
              {MONTHS.map((m) => (
                <th
                  key={m}
                  className="text-center px-1 py-1.5 font-semibold text-theme-muted w-10"
                >
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
              <tr
                key={row.label}
                className="border-b border-theme-border bg-theme-background/50"
              >
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
                  const totalCls =
                    total !== 0
                      ? row.getCls
                        ? row.getCls(total)
                        : row.cls
                      : "text-theme-muted/40";
                  return (
                    <td
                      className={`text-right px-2 py-1.5 font-semibold whitespace-nowrap ${totalCls}`}
                    >
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
    years.length > 0 ? years[0] : null,
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
        const [
          incomeOverrides,
          savingsOverrides,
          fixedDefs,
          incSetAt,
          savSetAt,
        ] = await Promise.all([
          StorageService.getSetting("yearlyIncomeOverrides", {}),
          StorageService.getSetting("yearlySavingsOverrides", {}),
          StorageService.getFixedExpenses(),
          StorageService.getSetting("monthlyIncomeSetAt", null),
          StorageService.getSetting("savingsRateSetAt", null),
        ]);

        const defMap = new Map(fixedDefs.map((f) => [f.id, f]));
        const configs = {};

        const globalInc = parseFloat(defaultIncome);
        const globalSav = parseFloat(defaultSavingsRate);

        // Fallback to current date if no set-at tracking exists
        const now = new Date();
        const incCutoff = incSetAt || { year: now.getFullYear(), month: now.getMonth() + 1 };
        const savCutoff = savSetAt || { year: now.getFullYear(), month: now.getMonth() + 1 };

        for (const year of years) {
          // Income: apply global defaults only from set-at month/year onward
          const incMonthMap = {};
          if (!isNaN(globalInc) && globalInc > 0) {
            if (year > incCutoff.year) {
              for (let m = 1; m <= 12; m++) incMonthMap[m] = globalInc;
            } else if (year === incCutoff.year) {
              for (let m = incCutoff.month; m <= 12; m++) incMonthMap[m] = globalInc;
            }
          }
          const incOverride = incomeOverrides[year];
          if (typeof incOverride === "number") {
            for (let m = 1; m <= 12; m++) incMonthMap[m] = incOverride;
          } else if (incOverride && typeof incOverride === "object") {
            for (let m = 1; m <= 12; m++) {
              if (incOverride[m] != null) incMonthMap[m] = incOverride[m];
            }
          }
          const incomeRanges = monthMapToRanges(incMonthMap);

          // Savings: apply global defaults only from set-at month/year onward
          const savMonthMap = {};
          if (!isNaN(globalSav) && globalSav >= 0) {
            if (year > savCutoff.year) {
              for (let m = 1; m <= 12; m++) savMonthMap[m] = globalSav;
            } else if (year === savCutoff.year) {
              for (let m = savCutoff.month; m <= 12; m++) savMonthMap[m] = globalSav;
            }
          }
          const savOverride = savingsOverrides[year];
          if (typeof savOverride === "number") {
            for (let m = 1; m <= 12; m++) savMonthMap[m] = savOverride;
          } else if (savOverride && typeof savOverride === "object") {
            for (let m = 1; m <= 12; m++) {
              if (savOverride[m] != null) savMonthMap[m] = savOverride[m];
            }
          }
          const savingsRanges = monthMapToRanges(savMonthMap);

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
      incomeRanges: [
        ...ranges,
        { id: nextId(), amount: "", startMonth: 1, endMonth: 12 },
      ],
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
      savingsRanges: [
        ...ranges,
        { id: nextId(), rate: "", startMonth: 1, endMonth: 12 },
      ],
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

    for (const year of dirtyYears) {
      const config = yearConfigs[year];
      if (!config) continue;

      const yearErrors = [];

      // Validate income ranges
      for (const range of config.incomeRanges) {
        const amt = parseFloat(range.amount);
        if (isNaN(amt)) yearErrors.push("Income amount must be a number.");
        else if (amt <= 0) yearErrors.push("Income amount must be > 0.");
        if (range.startMonth > range.endMonth)
          yearErrors.push("Income start month must be ≤ end month.");
      }

      // Validate savings ranges
      for (const range of config.savingsRanges) {
        const rate = parseFloat(range.rate);
        if (isNaN(rate)) yearErrors.push("Savings rate must be a number.");
        else if (rate < 0 || rate > 100)
          yearErrors.push("Savings rate must be 0–100.");
        if (range.startMonth > range.endMonth)
          yearErrors.push("Savings start month must be ≤ end month.");
      }

      // Validate fixed items
      for (const item of config.fixedItems) {
        if (!item.name.trim())
          yearErrors.push("Fixed expense name is required.");
        const amt = parseFloat(item.amount);
        if (isNaN(amt))
          yearErrors.push("Fixed expense amount must be a number.");
        else if (amt === 0)
          yearErrors.push("Fixed expense amount cannot be zero.");
        if (item.startMonth > item.endMonth)
          yearErrors.push("Fixed expense start month must be ≤ end month.");
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
      nextErrors._global = "Select at least one year and configure data for it.";
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

      for (const year of dirtyYears) {
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
          const existing = await StorageService.getSetting(
            "yearlyIncomeOverrides",
            {},
          );
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
          const existing = await StorageService.getSetting(
            "yearlySavingsOverrides",
            {},
          );
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
          (i) =>
            i.name.trim() &&
            !isNaN(parseFloat(i.amount)) &&
            parseFloat(i.amount) !== 0,
        );
        if (validFixedItems.length > 0) {
          if (saveMode === "replace") {
            // Atomic: delete old snapshots then insert new ones
            await dexieDb.transaction(
              "rw",
              dexieDb.fixedExpenseSnapshots,
              async () => {
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
              },
            );
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Backfill Historical Data"
      className="max-w-3xl w-[92vw] max-h-[90vh] flex flex-col"
    >
      {loading ? (
        <div className="py-8 text-center text-sm text-theme-muted">
          Loading existing data…
        </div>
      ) : (
        <>
          {/* Year tabs — sit outside the card */}
          {years.length > 1 && (
            <YearTabBar
              years={years}
              activeYear={activeYear}
              dirtyYears={dirtyYears}
              onSelect={setActiveYear}
            />
          )}

          {/* Content card */}
          <div className="bg-theme-surface border border-theme-border rounded-b-xl rounded-tr-xl shadow-sm overflow-y-auto pr-1">
            <div className="p-5 space-y-5">
              {activeYear && (
                <>
                  {/* Income ranges */}
                  <MultiRangeList
                    ranges={activeConfig.incomeRanges}
                    type="income"
                    onAdd={() => addIncomeRange(activeYear)}
                    onRemove={(id) => removeIncomeRange(activeYear, id)}
                    onUpdate={(id, patch) =>
                      updateIncomeRange(activeYear, id, patch)
                    }
                  />

                  {/* Savings ranges */}
                  <MultiRangeList
                    ranges={activeConfig.savingsRanges}
                    type="savings"
                    onAdd={() => addSavingsRange(activeYear)}
                    onRemove={(id) => removeSavingsRange(activeYear, id)}
                    onUpdate={(id, patch) =>
                      updateSavingsRange(activeYear, id, patch)
                    }
                  />

                  {/* Fixed expenses */}
                  <FixedExpenseList
                    items={activeConfig.fixedItems}
                    onAdd={() => addFixedItem(activeYear)}
                    onRemove={(id) => removeFixedItem(activeYear, id)}
                    onUpdate={(id, patch) =>
                      updateFixedItem(activeYear, id, patch)
                    }
                    onPreset={(preset) => addPreset(activeYear, preset)}
                  />

                  {/* Preview */}
                  <PreviewTable
                    yearConfig={activeConfig}
                    variableTotals={getYearlyVariableTotals(
                      activeYear,
                      expenses,
                    )}
                  />
                </>
              )}

              {/* Save mode — segmented control */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-theme-muted">
                  Save mode
                </span>
                <div className="inline-flex rounded-lg bg-theme-background border border-theme-border p-0.5">
                  <button
                    onClick={() => setSaveMode("merge")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      saveMode === "merge"
                        ? "bg-theme-surface text-theme-primary shadow-sm"
                        : "text-theme-muted hover:text-theme-text"
                    }`}
                  >
                    Merge
                  </button>
                  <button
                    onClick={() => setSaveMode("replace")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      saveMode === "replace"
                        ? "bg-theme-surface text-theme-primary shadow-sm"
                        : "text-theme-muted hover:text-theme-text"
                    }`}
                  >
                    Replace
                  </button>
                </div>
              </div>
              <p className="text-xs text-theme-muted leading-relaxed">
                <strong className="text-theme-text">Merge</strong>: New values
                overwrite existing months. Unchanged months keep their old
                values. Old snapshots remain.
                <br />
                <strong className="text-theme-text">Replace</strong>: All
                existing snapshots for the year are deleted and replaced.
                Income/savings overrides are fully rewritten.
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
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4">
            <button
              onClick={handleClose}
              className="bg-theme-background hover:bg-theme-border/40 text-theme-text font-medium px-4 py-2 rounded-lg border border-theme-border transition-all text-sm"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="bg-theme-primary hover:brightness-110 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all text-sm"
              disabled={saving}
            >
              {saving ? "Saving…" : "Confirm Backfill"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
