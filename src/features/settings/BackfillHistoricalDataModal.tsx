import { useState, useEffect, useMemo } from "react";
import Modal from "../../components/ui/Modal";
import { StorageService } from "../../services/storageService";
import type { Expense, FixedExpenseSnapshot } from "../../types";

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

function formatAmount(amount: string | number, symbol = "$", decimals = 2): string {
  const n = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(n)) return "—";
  return `${symbol}${n.toFixed(decimals)}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

interface RangeItem {
  id: string;
  amount: string | number;
  startMonth: number;
  endMonth: number;
}

interface FixedItem {
  id: string;
  name: string;
  amount: string | number;
  startMonth: number;
  endMonth: number;
  existingFixedExpenseId?: number;
}

interface YearConfig {
  incomeRanges: RangeItem[];
  savingsRanges: RangeItem[];
  fixedItems: FixedItem[];
}

/**
 * Convert a { month: value } map into an array of contiguous ranges.
 * Months with no entry or null/undefined are treated as gaps.
 */
function monthMapToRanges(monthMap: Record<number, number | null | undefined>): RangeItem[] {
  const ranges: RangeItem[] = [];
  let current: RangeItem | null = null;
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
function getYearlyVariableTotals(year: number, expenses: Expense[]): number[] {
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
function flattenRangesToMonthMap(ranges: RangeItem[]): Record<number, number> {
  const map: Record<number, number> = {};
  for (const range of ranges) {
    const val = parseFloat(String(range.amount));
    if (isNaN(val)) continue;
    const sm = clamp(range.startMonth || 1, 1, 12);
    const em = clamp(range.endMonth || 12, 1, 12);
    for (let m = sm; m <= em; m++) {
      map[m] = val;
    }
  }
  return map;
}

// ── Reusable sub-components (defined inside same file for cohesion) ──────────

// ── Modern Ghost Input Style ────────────────────────────────────────────────
const ghostInputCls =
  "bg-theme-background border border-transparent rounded-lg px-3 py-2 text-sm text-theme-text placeholder:text-theme-muted shadow-sm hover:border-theme-border focus:bg-theme-surface focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15 focus:shadow-md transition-all outline-none";

const ghostSelectCls =
  "bg-theme-background border border-transparent rounded-lg px-2 py-2 text-sm text-theme-text shadow-sm hover:border-theme-border focus:bg-theme-surface focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/15 focus:shadow-md transition-all outline-none cursor-pointer";

function RemoveBtn({ onClick }: { onClick: () => void }) {
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-theme-surface border border-theme-border shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-semibold text-theme-text">{title}</h3>
      {children}
    </div>
  );
}

// ── Reusable sub-components ──────────────────────────────────────────────────

interface YearTabBarProps {
  years: number[];
  activeYear: number | null;
  dirtyYears: Set<number>;
  onSelect: (year: number) => void;
}

function YearTabBar({ years, activeYear, dirtyYears, onSelect }: YearTabBarProps) {
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

interface MonthSelectProps {
  value: number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  maxMonth?: number;
  cls?: string;
}

function MonthSelect({ value, onChange, maxMonth = 12, cls }: MonthSelectProps) {
  return (
    <select value={value} onChange={onChange} className={cls}>
      {MONTHS.map((m, i) => {
        const monthNum = i + 1;
        if (monthNum > maxMonth) return null;
        return (
          <option key={m} value={monthNum}>
            {m}
          </option>
        );
      })}
    </select>
  );
}

interface MultiRangeListProps {
  ranges: RangeItem[];
  type: "income" | "savings";
  year: number;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<RangeItem>) => void;
}

function MultiRangeList({ ranges, type, year, onAdd, onRemove, onUpdate }: MultiRangeListProps) {
  const isIncome = type === "income";
  const label = isIncome ? "Monthly Income" : "Auto Savings %";
  const placeholder = isIncome ? "e.g. 5000" : "e.g. 20";
  const step = isIncome ? "0.01" : "0.1";
  const inputWidth = isIncome ? "w-36" : "w-28";

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isCurrentYear = year === currentYear;
  const maxMonth = isCurrentYear ? currentMonth - 1 : 12;

  return (
    <SectionCard title={label}>
      {ranges.length === 0 && (
        <p className="text-xs text-theme-muted italic">
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
            <MonthSelect
              value={range.startMonth}
              onChange={(e) =>
                onUpdate(range.id, { startMonth: parseInt(e.target.value, 10) })
              }
              maxMonth={maxMonth}
              cls={`${ghostSelectCls} w-18`}
            />
            <span className="text-theme-muted text-xs">→</span>
            <MonthSelect
              value={Math.min(range.endMonth, maxMonth)}
              onChange={(e) =>
                onUpdate(range.id, { endMonth: parseInt(e.target.value, 10) })
              }
              maxMonth={maxMonth}
              cls={`${ghostSelectCls} w-18`}
            />
            <RemoveBtn onClick={() => onRemove(range.id)} />
          </div>
        ))}
      </div>
      <button
        onClick={onAdd}
        className="text-sm text-theme-primary hover:text-theme-primary font-medium transition-colors"
      >
        + Add {isIncome ? "income" : "savings"} range
      </button>
    </SectionCard>
  );
}

interface FixedExpenseListProps {
  items: FixedItem[];
  year: number;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<FixedItem>) => void;
  onPreset: (preset: string) => void;
}

function FixedExpenseList({ items, year, onAdd, onRemove, onUpdate, onPreset }: FixedExpenseListProps) {
  const presets = ["Rent", "Utilities", "Insurance", "Internet", "Phone"];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isCurrentYear = year === currentYear;
  const maxMonth = isCurrentYear ? currentMonth - 1 : 12;

  return (
    <SectionCard title="Fixed Expenses">
      {items.length === 0 && (
        <p className="text-xs text-theme-muted italic">No fixed expenses configured.</p>
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
            <MonthSelect
              value={item.startMonth}
              onChange={(e) => onUpdate(item.id, { startMonth: parseInt(e.target.value, 10) })}
              maxMonth={maxMonth}
              cls={`${ghostSelectCls} w-18`}
            />
            <span className="text-theme-muted text-xs">→</span>
            <MonthSelect
              value={Math.min(item.endMonth, maxMonth)}
              onChange={(e) => onUpdate(item.id, { endMonth: parseInt(e.target.value, 10) })}
              maxMonth={maxMonth}
              cls={`${ghostSelectCls} w-18`}
            />
            <RemoveBtn onClick={() => onRemove(item.id)} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onAdd}
          className="text-sm text-theme-primary hover:text-theme-primary font-medium transition-colors"
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

interface PreviewTableProps {
  yearConfig: YearConfig;
  variableTotals: number[];
}

function PreviewTable({ yearConfig, variableTotals }: PreviewTableProps) {
  const timeline = useMemo(() => {
    const incomeMap = flattenRangesToMonthMap(yearConfig.incomeRanges);
    const savingsMap = flattenRangesToMonthMap(yearConfig.savingsRanges);

    const fixedItems = yearConfig.fixedItems
      .filter((i) => i.name.trim() && !isNaN(parseFloat(String(i.amount))))
      .map((i) => ({
        name: i.name.trim(),
        amount: parseFloat(String(i.amount)) || 0,
        startMonth: clamp(i.startMonth || 1, 1, 12),
        endMonth: clamp(i.endMonth || 12, 1, 12),
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
              const sm = clamp(parseInt(String(item.startMonth), 10) || 1, 1, 12);
              const em = clamp(parseInt(String(item.endMonth), 10) || 12, 1, 12);
              const amt = parseFloat(String(item.amount)) || 0;
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
                          : "text-theme-muted"
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
                getCls: (val: number) =>
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
                        : "text-theme-muted"
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
                      : "text-theme-muted";
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

interface BackfillHistoricalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  years: number[];
  expenses?: Expense[];
  onComplete?: () => void;
  defaultIncome?: string;
  defaultSavingsRate?: string;
}

export default function BackfillHistoricalDataModal({
  isOpen,
  onClose,
  years,
  expenses = [],
  onComplete,
  defaultIncome = "",
  defaultSavingsRate = "",
}: BackfillHistoricalDataModalProps) {
  const [activeYear, setActiveYear] = useState<number | null>(() =>
    years.length > 0 ? years[0] : null,
  );
  const [yearConfigs, setYearConfigs] = useState<Record<number, YearConfig>>({});
  const [dirtyYears, setDirtyYears] = useState<Set<number>>(new Set());
  const [saveMode, setSaveMode] = useState<"merge" | "replace">("merge");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
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
          fixedDefs,
          incSnaps,
          savSnaps,
          allFixedSnaps,
        ] = await Promise.all([
          StorageService.getFixedExpenses(),
          StorageService.getAllIncomeSnapshots(),
          StorageService.getAllSavingsSnapshots(),
          StorageService.getAllFixedExpenseSnapshots(),
        ]);

        const defMap = new Map((fixedDefs as Array<{ id?: number; name: string }>).map((f) => [f.id, f]));

        // Compute earliest and latest snapshot per fixed-expense definition
        const earliestByDef = new Map<number, { year: number; month: number }>();
        const latestByDef = new Map<number, { year: number; month: number }>();
        for (const s of allFixedSnaps) {
          const ex = earliestByDef.get(s.fixedExpenseId);
          if (!ex || s.year < ex.year || (s.year === ex.year && s.month < ex.month)) {
            earliestByDef.set(s.fixedExpenseId, { year: s.year, month: s.month });
          }
          const lx = latestByDef.get(s.fixedExpenseId);
          if (!lx || s.year > lx.year || (s.year === lx.year && s.month > lx.month)) {
            latestByDef.set(s.fixedExpenseId, { year: s.year, month: s.month });
          }
        }

        const configs: Record<number, YearConfig> = {};

        for (const year of years) {
          // Income: load from snapshots
          const yearIncSnaps = incSnaps.filter((s) => s.year === year);
          const incMonthMap: Record<number, number> = {};
          for (const s of yearIncSnaps) incMonthMap[s.month] = s.amountSnapshot;
          const incomeRanges = monthMapToRanges(incMonthMap);

          // Savings: load from snapshots
          const yearSavSnaps = savSnaps.filter((s) => s.year === year);
          const savMonthMap: Record<number, number> = {};
          for (const s of yearSavSnaps) savMonthMap[s.month] = s.rateSnapshot;
          const savingsRanges = monthMapToRanges(savMonthMap);

          // Fixed expenses from snapshots
          const snapshots = await StorageService.getSnapshotsForYear(year);
          const byDef = new Map<number, FixedExpenseSnapshot[]>();
          for (const s of snapshots) {
            if (!byDef.has(s.fixedExpenseId)) byDef.set(s.fixedExpenseId, []);
            byDef.get(s.fixedExpenseId)!.push(s);
          }
          const fixedItems: FixedItem[] = [];
          for (const [defId, snaps] of byDef) {
            const def = defMap.get(defId);
            const monthMap: Record<number, number> = {};
            for (const s of snaps) monthMap[s.month] = s.amountSnapshot;
            const ranges = monthMapToRanges(monthMap);
            for (const r of ranges) {
              fixedItems.push({
                id: nextId(),
                name: (def as { name?: string } | undefined)?.name || snaps[0]?.nameSnapshot || "Unknown",
                amount: r.amount,
                startMonth: r.startMonth,
                endMonth: r.endMonth,
                existingFixedExpenseId: defId,
              });
            }
          }

          // Backfill active fixed expenses that have no snapshots for this year
          for (const def of fixedDefs) {
            if (!def.id) continue;
            if (byDef.has(def.id)) continue; // already has explicit snapshots

            const earliest = earliestByDef.get(def.id);
            if (!earliest) continue; // never had snapshots → not a real tracked expense

            const latest = latestByDef.get(def.id);

            // Expense didn't exist yet in this year
            if (year < earliest.year) continue;

            // Archived and last snapshot was in an earlier year → not active
            if (def.isArchived && latest && year > latest.year) continue;

            const startMonth = year === earliest.year ? earliest.month : 1;
            let endMonth = 12;
            if (def.isArchived && latest && year === latest.year) {
              endMonth = latest.month;
            }

            fixedItems.push({
              id: nextId(),
              name: def.name,
              amount: def.amount,
              startMonth,
              endMonth,
              existingFixedExpenseId: def.id,
            });
          }

          configs[year] = { incomeRanges, savingsRanges, fixedItems };
        }

        if (!cancelled) {
          setYearConfigs(configs);
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
  }, [isOpen, years, defaultIncome, defaultSavingsRate]);

  const updateYearConfig = (year: number, patch: Partial<YearConfig>) => {
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

  const addIncomeRange = (year: number) => {
    const ranges = yearConfigs[year]?.incomeRanges || [];
    updateYearConfig(year, {
      incomeRanges: [
        ...ranges,
        { id: nextId(), amount: "", startMonth: 1, endMonth: 12 },
      ],
    });
  };

  const removeIncomeRange = (year: number, id: string) => {
    const ranges = yearConfigs[year]?.incomeRanges || [];
    updateYearConfig(year, {
      incomeRanges: ranges.filter((r) => r.id !== id),
    });
  };

  const updateIncomeRange = (year: number, id: string, patch: Partial<RangeItem>) => {
    const ranges = yearConfigs[year]?.incomeRanges || [];
    updateYearConfig(year, {
      incomeRanges: ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const addSavingsRange = (year: number) => {
    const ranges = yearConfigs[year]?.savingsRanges || [];
    updateYearConfig(year, {
      savingsRanges: [
        ...ranges,
        { id: nextId(), amount: "", startMonth: 1, endMonth: 12 },
      ],
    });
  };

  const removeSavingsRange = (year: number, id: string) => {
    const ranges = yearConfigs[year]?.savingsRanges || [];
    updateYearConfig(year, {
      savingsRanges: ranges.filter((r) => r.id !== id),
    });
  };

  const updateSavingsRange = (year: number, id: string, patch: Partial<RangeItem>) => {
    const ranges = yearConfigs[year]?.savingsRanges || [];
    updateYearConfig(year, {
      savingsRanges: ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const addFixedItem = (year: number) => {
    const items = yearConfigs[year]?.fixedItems || [];
    updateYearConfig(year, {
      fixedItems: [
        ...items,
        { id: nextId(), name: "", amount: "", startMonth: 1, endMonth: 12 },
      ],
    });
  };

  const removeFixedItem = (year: number, id: string) => {
    const items = yearConfigs[year]?.fixedItems || [];
    updateYearConfig(year, {
      fixedItems: items.filter((i) => i.id !== id),
    });
  };

  const updateFixedItem = (year: number, id: string, patch: Partial<FixedItem>) => {
    const items = yearConfigs[year]?.fixedItems || [];
    updateYearConfig(year, {
      fixedItems: items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
  };

  const addPreset = (year: number, preset: string) => {
    const items = yearConfigs[year]?.fixedItems || [];
    updateYearConfig(year, {
      fixedItems: [
        ...items,
        { id: nextId(), name: preset, amount: "", startMonth: 1, endMonth: 12 },
      ],
    });
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string[]> = {};
    let hasError = false;
    let hasAnyData = false;

    for (const year of dirtyYears) {
      const config = yearConfigs[year];
      if (!config) continue;

      const yearErrors: string[] = [];

      // Validate income ranges
      for (const range of config.incomeRanges) {
        const amt = parseFloat(String(range.amount));
        if (isNaN(amt)) yearErrors.push("Income amount must be a number.");
        else if (amt <= 0) yearErrors.push("Income amount must be > 0.");
        if (range.startMonth > range.endMonth)
          yearErrors.push("Income start month must be ≤ end month.");
      }

      // Validate savings ranges
      for (const range of config.savingsRanges) {
        const rate = parseFloat(String(range.amount));
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
        const amt = parseFloat(String(item.amount));
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
      nextErrors._global = ["Select at least one year and configure data for it."];
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

        // 1. Income & Savings snapshots
        const incomeMap = flattenRangesToMonthMap(config.incomeRanges);
        const savingsMap = flattenRangesToMonthMap(config.savingsRanges);
        if (saveMode === "replace") {
          await StorageService.deleteIncomeSnapshotsForYear(year);
          await StorageService.deleteSavingsSnapshotsForYear(year);
        }
        const incomeSnapshots = Object.entries(incomeMap).map(([month, amount]) => ({
          year,
          month: parseInt(month, 10),
          amountSnapshot: amount as number,
        }));
        const savingsSnapshots = Object.entries(savingsMap).map(([month, rate]) => ({
          year,
          month: parseInt(month, 10),
          rateSnapshot: rate as number,
        }));
        if (incomeSnapshots.length > 0) {
          await StorageService.bulkUpsertIncomeSnapshots(incomeSnapshots);
        }
        if (savingsSnapshots.length > 0) {
          await StorageService.bulkUpsertSavingsSnapshots(savingsSnapshots);
        }

        // 4. Fixed expenses & snapshots
        const validFixedItems = config.fixedItems.filter(
          (i) =>
            i.name.trim() &&
            !isNaN(parseFloat(String(i.amount))) &&
            parseFloat(String(i.amount)) !== 0,
        );
        if (validFixedItems.length > 0) {
          if (saveMode === "replace") {
            // Atomic: delete old snapshots then insert new ones
            await dexieDb.transaction(
              "rw",
              dexieDb.fixedExpenseSnapshots,
              async () => {
                await StorageService.deleteSnapshotsForYear(year);
                const newSnapshots: Array<{
                  fixedExpenseId: number;
                  year: number;
                  month: number;
                  amountSnapshot: number;
                  nameSnapshot: string;
                }> = [];
                for (const item of validFixedItems) {
                  const newId = await StorageService.addArchivedFixedExpense({
                    name: item.name.trim(),
                    amount: parseFloat(String(item.amount)),
                  });
                  const sm = clamp(parseInt(String(item.startMonth), 10) || 1, 1, 12);
                  const em = clamp(parseInt(String(item.endMonth), 10) || 12, 1, 12);
                  for (let m = sm; m <= em; m++) {
                    newSnapshots.push({
                      fixedExpenseId: newId,
                      year,
                      month: m,
                      amountSnapshot: parseFloat(String(item.amount)),
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
            const newSnapshots: Array<{
              fixedExpenseId: number;
              year: number;
              month: number;
              amountSnapshot: number;
              nameSnapshot: string;
            }> = [];
            for (const item of validFixedItems) {
              const newId = await StorageService.addArchivedFixedExpense({
                name: item.name.trim(),
                amount: parseFloat(String(item.amount)),
              });
              const sm = clamp(parseInt(String(item.startMonth), 10) || 1, 1, 12);
              const em = clamp(parseInt(String(item.endMonth), 10) || 12, 1, 12);
              for (let m = sm; m <= em; m++) {
                newSnapshots.push({
                  fixedExpenseId: newId,
                  year,
                  month: m,
                  amountSnapshot: parseFloat(String(item.amount)),
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
      setResultMsg(`Error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setYearConfigs({});
    setActiveYear(years.length > 0 ? years[0] : null);
    setDirtyYears(new Set());
    setSaveMode("merge");
    setErrors({});
    setResultMsg("");
    onClose();
  };

  const activeConfig: YearConfig = yearConfigs[activeYear ?? 0] || {
    incomeRanges: [],
    savingsRanges: [],
    fixedItems: [],
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Backfill Historical Data"
      size="full"
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

          {/* Content */}
          <div className="overflow-x-auto">
            <div className="space-y-5">
              {activeYear && (
                <>
                  {/* Income ranges */}
                  <MultiRangeList
                    ranges={activeConfig.incomeRanges}
                    type="income"
                    year={activeYear}
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
                    year={activeYear}
                    onAdd={() => addSavingsRange(activeYear)}
                    onRemove={(id) => removeSavingsRange(activeYear, id)}
                    onUpdate={(id, patch) =>
                      updateSavingsRange(activeYear, id, patch)
                    }
                  />

                  {/* Fixed expenses */}
                  <FixedExpenseList
                    items={activeConfig.fixedItems}
                    year={activeYear}
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
              className="btn-modal-cancel"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="btn-modal-primary"
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
