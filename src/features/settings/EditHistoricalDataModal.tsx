import { useState, useEffect, useMemo } from "react";
import Modal from "../../components/ui/Modal";
import { StorageService } from "../../services/storageService";
import { cn } from "../../utils/cn";
import {
  getMaxMonthForYear,
  findGapToFill,
  removeRangeAndMerge,
  updateRangeEndAndCascade,
  checkRangeOverlaps,
  isFullyCovered,
  monthMapToRanges,
  getYearlyVariableTotals,
  clamp,
  type RangeItem,
  flattenRangesToMonthMap,
} from "../../utils/historicalDataHelpers";
import type { Expense, FixedExpense, FixedExpenseSnapshot } from "../../types";

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

function formatAmount(
  amount: string | number,
  symbol = "$",
  decimals = 2,
): string {
  const n = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(n)) return "—";
  return `${symbol}${n.toFixed(decimals)}`;
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
  incomeRanges: import("../../utils/historicalDataHelpers").RangeItem[];
  savingsRanges: import("../../utils/historicalDataHelpers").RangeItem[];
  fixedItems: FixedItem[];
}

// ── Reusable sub-components (defined inside same file for cohesion) ──────────

// ── Reusable input style (uses global .input-theme) ─────────────────────────
const ghostInputCls = "input-theme px-3 py-2 text-sm";

const ghostSelectCls = "input-theme px-2 py-2 text-sm cursor-pointer";

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded-full text-theme-muted hover:text-theme-danger hover:bg-theme-danger-muted transition-all"
      aria-label="Remove"
    >
      <span className="text-xs leading-none">&times;</span>
    </button>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-theme-large bg-theme-surface border border-theme-border shadow-sm p-4 space-y-3">
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

function YearTabBar({
  years,
  activeYear,
  dirtyYears,
  onSelect,
}: YearTabBarProps) {
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
              className={`relative px-4 py-2 text-sm font-medium rounded-t-theme-medium border-x border-t transition-colors focus:outline-none ${
                isActive
                  ? "bg-theme-surface text-theme-primary border-t-2 border-t-theme-primary border-theme-border border-b border-b-theme-surface shadow-sm"
                  : "bg-theme-background text-theme-muted border-transparent hover:text-theme-text hover:bg-theme-background-muted"
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
  minMonth?: number;
  maxMonth?: number;
  cls?: string;
}

function MonthSelect({
  value,
  onChange,
  minMonth = 1,
  maxMonth = 12,
  cls,
}: MonthSelectProps) {
  return (
    <select value={value} onChange={onChange} className={cls}>
      {MONTHS.map((m, i) => {
        const monthNum = i + 1;
        if (monthNum < minMonth || monthNum > maxMonth) return null;
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
  quickAddValue?: string;
  onQuickAdd?: (value: string) => void;
}

function MultiRangeList({
  ranges,
  type,
  year,
  onAdd,
  onRemove,
  onUpdate,
  quickAddValue,
  onQuickAdd,
}: MultiRangeListProps) {
  const isIncome = type === "income";
  const label = isIncome ? "Monthly Income" : "Auto Savings %";
  const placeholder = isIncome ? "e.g. 5000" : "e.g. 20";
  const step = isIncome ? "0.01" : "0.1";
  const inputWidth = isIncome ? "w-36" : "w-28";

  const maxMonth = getMaxMonthForYear(year);

  // Sort by startMonth for display and cascade logic
  const sortedRanges = [...ranges].sort((a, b) => a.startMonth - b.startMonth);

  // Determine if the year is fully covered (no gaps)
  const fullyCovered = isFullyCovered(sortedRanges, maxMonth);

  const hasQuickAddValue = quickAddValue && quickAddValue !== "0" && quickAddValue !== "";

  return (
    <SectionCard title={label}>
      {ranges.length === 0 && (
        <p className="text-xs text-theme-muted italic">No ranges configured.</p>
      )}
      <div className="space-y-2">
        {sortedRanges.map((range, idx) => {
          const nextRange = sortedRanges[idx + 1];
          const endMonthMax = nextRange ? nextRange.startMonth - 1 : maxMonth;
          return (
            <div key={range.id} className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                value={range.amount}
                onChange={(e) => onUpdate(range.id, { amount: e.target.value })}
                placeholder={placeholder}
                step={step}
                className={`${ghostInputCls} ${inputWidth}`}
              />
              {/* Start month is read-only — controlled by cascade logic */}
              <span
                className={`${ghostSelectCls} w-18 inline-block text-center select-none`}
              >
                {MONTHS[range.startMonth - 1]}
              </span>
              <span className="text-theme-muted text-xs">→</span>
              <MonthSelect
                value={Math.min(range.endMonth, maxMonth)}
                onChange={(e) =>
                  onUpdate(range.id, { endMonth: parseInt(e.target.value, 10) })
                }
                minMonth={range.startMonth}
                maxMonth={endMonthMax}
                cls={`${ghostSelectCls} w-18`}
              />
              <RemoveBtn onClick={() => onRemove(range.id)} />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onAdd}
          disabled={fullyCovered}
          className={cn(
            "text-sm font-medium transition-colors",
            fullyCovered
              ? "text-theme-muted cursor-not-allowed"
              : "text-theme-primary hover:text-theme-primary",
          )}
        >
          + Add {isIncome ? "income" : "savings"} range
        </button>
        {hasQuickAddValue && onQuickAdd && (
          <button
            onClick={() => onQuickAdd(quickAddValue)}
            disabled={fullyCovered}
            className={cn(
              "text-xs font-medium transition-colors",
              fullyCovered
                ? "text-theme-muted cursor-not-allowed"
                : "text-theme-primary hover:underline",
            )}
          >
            Use current: {isIncome ? formatAmount(Number(quickAddValue)) : `${quickAddValue}%`}
          </button>
        )}
      </div>
    </SectionCard>
  );
}

interface FixedExpenseListProps {
  items: FixedItem[];
  year: number;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<FixedItem>) => void;
  onPreset: (preset: { name: string; amount: string }) => void;
  currentFixedDefs: FixedExpense[];
}

const HARDCODED_PRESETS = [
  { name: "Rent", amount: "1200" },
  { name: "Utilities", amount: "150" },
  { name: "Insurance", amount: "200" },
  { name: "Internet", amount: "80" },
  { name: "Phone", amount: "50" },
];

function FixedExpenseList({
  items,
  year,
  onAdd,
  onRemove,
  onUpdate,
  onPreset,
  currentFixedDefs,
}: FixedExpenseListProps) {
  const presets = useMemo(() => {
    const presetMap = new Map<string, string>();
    currentFixedDefs.forEach((def) => {
      if (def.name?.trim()) {
        presetMap.set(def.name.trim(), String(def.amount));
      }
    });
    HARDCODED_PRESETS.forEach((p) => presetMap.set(p.name, p.amount));
    return Array.from(presetMap.entries()).map(([name, amount]) => ({
      name,
      amount,
    }));
  }, [currentFixedDefs]);

  const maxMonth = getMaxMonthForYear(year);

  return (
    <SectionCard title="Fixed Expenses">
      {items.length === 0 && (
        <p className="text-xs text-theme-muted italic">
          No fixed expenses configured.
        </p>
      )}
      <div className="space-y-2">
        {items.map((item) => {
          const displayEndMonth = Math.min(item.endMonth, maxMonth);
          return (
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
                onChange={(e) =>
                  onUpdate(item.id, {
                    startMonth: parseInt(e.target.value, 10),
                  })
                }
                maxMonth={maxMonth}
                cls={`${ghostSelectCls} w-18`}
              />
              <span className="text-theme-muted text-xs">→</span>
              <MonthSelect
                value={displayEndMonth}
                onChange={(e) =>
                  onUpdate(item.id, { endMonth: parseInt(e.target.value, 10) })
                }
                maxMonth={maxMonth}
                cls={`${ghostSelectCls} w-18`}
              />
              <RemoveBtn onClick={() => onRemove(item.id)} />
            </div>
          );
        })}
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
            key={preset.name}
            onClick={() => onPreset(preset)}
            className="text-xs text-theme-primary hover:underline font-medium transition-all"
          >
            {preset.name}
          </button>
        ))}
      </div>
      <p className="text-xs text-theme-muted mt-1">
        Pre-fills name and amount. Adjust the amount if it was different in this year.
      </p>
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
      autoSavings,
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

  const totals = useMemo(() => {
    return {
      fixed: timeline.reduce((s, t) => s + t.fixedTotal, 0),
      income: timeline.reduce((s, t) => s + t.income, 0),
      autoSavings: timeline.reduce((s, t) => s + t.autoSavings, 0),
      totalSavings: timeline.reduce((s, t) => s + t.totalSavings, 0),
    };
  }, [timeline]);

  const valueCell = (
    val: number,
    type:
      | "fixed"
      | "income"
      | "autoSavings"
      | "totalSavings",
  ) => {
    if (val === 0) return <span className="text-theme-muted">—</span>;
    const baseCls = "tabular-nums";
    switch (type) {
      case "fixed":
        return (
          <span className={cn(baseCls, "text-theme-text")}>
            {formatAmount(val)}
          </span>
        );
      case "income":
        return (
          <span className={cn(baseCls, "text-theme-success")}>
            {formatAmount(val)}
          </span>
        );
      case "autoSavings":
        return (
          <span className={cn(baseCls, "text-theme-primary")}>
            {formatAmount(val)}
          </span>
        );
      case "totalSavings":
        return (
          <span
            className={cn(
              baseCls,
              val > 0
                ? "text-theme-success"
                : val < 0
                  ? "text-theme-danger"
                  : "text-theme-text",
            )}
          >
            {formatAmount(val)}
          </span>
        );
    }
  };

  return (
    <div>
      <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide block mb-2">
        Preview
      </label>
      <div className="rounded-theme-large border border-theme-border shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-theme-background border-b border-theme-border">
              <th className="text-left px-2 py-1.5 font-semibold text-theme-muted">
                Month
              </th>
              <th className="text-right px-2 py-1.5 font-semibold text-theme-muted">
                Fixed
              </th>
              <th className="text-right px-2 py-1.5 font-semibold text-theme-muted">
                Income
              </th>
              <th className="text-right px-2 py-1.5 font-semibold text-theme-muted">
                Auto Savings
              </th>
              <th className="text-right px-2 py-1.5 font-semibold text-theme-muted">
                Total Savings
              </th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((t) => (
              <tr key={t.month} className="border-b border-theme-border">
                <td className="px-2 py-1.5 text-theme-text font-medium">
                  {MONTHS[t.month - 1]}
                </td>
                <td className="text-right px-2 py-1.5">
                  {valueCell(t.fixedTotal, "fixed")}
                </td>
                <td className="text-right px-2 py-1.5">
                  {valueCell(t.income, "income")}
                </td>
                <td className="text-right px-2 py-1.5">
                  {valueCell(t.autoSavings, "autoSavings")}
                </td>
                <td className="text-right px-2 py-1.5">
                  {valueCell(t.totalSavings, "totalSavings")}
                </td>
              </tr>
            ))}
            <tr className="bg-theme-background-semi font-semibold">
              <td className="px-2 py-1.5 text-theme-text">Total</td>
              <td className="text-right px-2 py-1.5">
                {valueCell(totals.fixed, "fixed")}
              </td>
              <td className="text-right px-2 py-1.5">
                {valueCell(totals.income, "income")}
              </td>
              <td className="text-right px-2 py-1.5">
                {valueCell(totals.autoSavings, "autoSavings")}
              </td>
              <td className="text-right px-2 py-1.5">
                {valueCell(totals.totalSavings, "totalSavings")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface EditHistoricalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  years: number[];
  expenses?: Expense[];
  onComplete?: () => void;
  defaultIncome?: string;
  defaultSavingsRate?: string;
}

export default function EditHistoricalDataModal({
  isOpen,
  onClose,
  years: rawYears,
  expenses = [],
  onComplete,
  defaultIncome = "",
  defaultSavingsRate = "",
}: EditHistoricalDataModalProps) {
  // Filter out current year if it has 0 editable months (e.g., January)
  const years = useMemo(
    () =>
      rawYears.filter((y) => {
        const maxMonth = getMaxMonthForYear(y);
        return maxMonth >= 1;
      }),
    [rawYears],
  );

  const [activeYear, setActiveYear] = useState<number | null>(() =>
    years.length > 0 ? years[0] : null,
  );
  const [yearConfigs, setYearConfigs] = useState<Record<number, YearConfig>>(
    {},
  );
  const [dirtyYears, setDirtyYears] = useState<Set<number>>(new Set());
  const [saveMode, setSaveMode] = useState<"merge" | "replace">("merge");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [resultMsg, setResultMsg] = useState("");
  const [currentFixedDefs, setCurrentFixedDefs] = useState<FixedExpense[]>([]);

  // Load existing data when modal opens
  useEffect(() => {
    if (!isOpen || years.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [fixedDefs, incSnaps, savSnaps, allFixedSnaps] =
          await Promise.all([
            StorageService.getFixedExpenses(),
            StorageService.getAllIncomeSnapshots(),
            StorageService.getAllSavingsSnapshots(),
            StorageService.getAllFixedExpenseSnapshots(),
          ]);

        const defMap = new Map(
          (fixedDefs as Array<{ id?: number; name: string }>).map((f) => [
            f.id,
            f,
          ]),
        );

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
          const snapshots = allFixedSnaps.filter((s) => s.year === year);
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
                name:
                  (def as { name?: string } | undefined)?.name ||
                  snaps[0]?.nameSnapshot ||
                  "Unknown",
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
          setActiveYear(years[0]);
          setDirtyYears(new Set());
          setErrors({});
          setResultMsg("");
          setSaveMode("merge");
          setCurrentFixedDefs(fixedDefs as FixedExpense[]);
        }
      } catch (err) {
        console.error("Failed to load historical data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, years]);

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
    const ranges = [...(yearConfigs[year]?.incomeRanges || [])];
    const gap = findGapToFill(ranges, getMaxMonthForYear(year));
    if (!gap) return;
    updateYearConfig(year, {
      incomeRanges: [...ranges, { id: nextId(), amount: "", ...gap }],
    });
  };

  const removeIncomeRange = (year: number, id: string) => {
    const ranges = yearConfigs[year]?.incomeRanges || [];
    updateYearConfig(year, {
      incomeRanges: removeRangeAndMerge(ranges, id),
    });
  };

  const updateIncomeRange = (
    year: number,
    id: string,
    patch: Partial<RangeItem>,
  ) => {
    const ranges = yearConfigs[year]?.incomeRanges || [];
    if (patch.endMonth != null) {
      updateYearConfig(year, {
        incomeRanges: updateRangeEndAndCascade(ranges, id, patch.endMonth),
      });
    } else {
      updateYearConfig(year, {
        incomeRanges: ranges.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      });
    }
  };

  const addSavingsRange = (year: number) => {
    const ranges = [...(yearConfigs[year]?.savingsRanges || [])];
    const gap = findGapToFill(ranges, getMaxMonthForYear(year));
    if (!gap) return;
    updateYearConfig(year, {
      savingsRanges: [...ranges, { id: nextId(), amount: "", ...gap }],
    });
  };

  const removeSavingsRange = (year: number, id: string) => {
    const ranges = yearConfigs[year]?.savingsRanges || [];
    updateYearConfig(year, {
      savingsRanges: removeRangeAndMerge(ranges, id),
    });
  };

  const updateSavingsRange = (
    year: number,
    id: string,
    patch: Partial<RangeItem>,
  ) => {
    const ranges = yearConfigs[year]?.savingsRanges || [];
    if (patch.endMonth != null) {
      updateYearConfig(year, {
        savingsRanges: updateRangeEndAndCascade(ranges, id, patch.endMonth),
      });
    } else {
      updateYearConfig(year, {
        savingsRanges: ranges.map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        ),
      });
    }
  };

  const quickAddIncomeRange = (year: number, value: string) => {
    const ranges = [...(yearConfigs[year]?.incomeRanges || [])];
    const gap = findGapToFill(ranges, getMaxMonthForYear(year));
    if (!gap) return;
    updateYearConfig(year, {
      incomeRanges: [...ranges, { id: nextId(), amount: value, ...gap }],
    });
  };

  const quickAddSavingsRange = (year: number, value: string) => {
    const ranges = [...(yearConfigs[year]?.savingsRanges || [])];
    const gap = findGapToFill(ranges, getMaxMonthForYear(year));
    if (!gap) return;
    updateYearConfig(year, {
      savingsRanges: [...ranges, { id: nextId(), amount: value, ...gap }],
    });
  };

  const addFixedItem = (year: number) => {
    const items = yearConfigs[year]?.fixedItems || [];
    updateYearConfig(year, {
      fixedItems: [
        ...items,
        {
          id: nextId(),
          name: "",
          amount: "",
          startMonth: 1,
          endMonth: getMaxMonthForYear(year),
        },
      ],
    });
  };

  const removeFixedItem = (year: number, id: string) => {
    const items = yearConfigs[year]?.fixedItems || [];
    updateYearConfig(year, {
      fixedItems: items.filter((i) => i.id !== id),
    });
  };

  const updateFixedItem = (
    year: number,
    id: string,
    patch: Partial<FixedItem>,
  ) => {
    const items = yearConfigs[year]?.fixedItems || [];
    updateYearConfig(year, {
      fixedItems: items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
  };

  const addPreset = (
    year: number,
    preset: { name: string; amount: string },
  ) => {
    const items = yearConfigs[year]?.fixedItems || [];
    updateYearConfig(year, {
      fixedItems: [
        ...items,
        {
          id: nextId(),
          name: preset.name,
          amount: preset.amount,
          startMonth: 1,
          endMonth: getMaxMonthForYear(year),
        },
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
      }
      yearErrors.push(...checkRangeOverlaps(config.incomeRanges, "Income"));

      // Validate savings ranges
      for (const range of config.savingsRanges) {
        const rate = parseFloat(String(range.amount));
        if (isNaN(rate)) yearErrors.push("Savings rate must be a number.");
        else if (rate < 0 || rate > 100)
          yearErrors.push("Savings rate must be 0–100.");
      }
      yearErrors.push(...checkRangeOverlaps(config.savingsRanges, "Savings"));

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
      nextErrors._global = [
        "Select at least one year and configure data for it.",
      ];
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
        const incomeSnapshots = Object.entries(incomeMap).map(
          ([month, amount]) => ({
            year,
            month: parseInt(month, 10),
            amountSnapshot: amount as number,
          }),
        );
        const savingsSnapshots = Object.entries(savingsMap).map(
          ([month, rate]) => ({
            year,
            month: parseInt(month, 10),
            rateSnapshot: rate as number,
          }),
        );
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
                  const sm = clamp(
                    parseInt(String(item.startMonth), 10) || 1,
                    1,
                    12,
                  );
                  const em = clamp(
                    parseInt(String(item.endMonth), 10) || 12,
                    1,
                    12,
                  );
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
              const sm = clamp(
                parseInt(String(item.startMonth), 10) || 1,
                1,
                12,
              );
              const em = clamp(
                parseInt(String(item.endMonth), 10) || 12,
                1,
                12,
              );
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
      console.error("Edit historical data failed:", err);
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
      title="Edit Historical Data"
      size="full"
      mobileActionLabel="Save"
      onMobileAction={handleConfirm}
      mobileActionDisabled={saving || Object.keys(errors).length > 0}
    >
      {loading ? (
        <div className="py-8 text-center text-sm text-theme-muted">
          Loading existing data…
        </div>
      ) : years.length === 0 ? (
        <div className="py-8 text-center text-sm text-theme-muted">
          No historical data available. There are no past months to edit yet.
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
                  quickAddValue={defaultIncome}
                  onQuickAdd={(value) => quickAddIncomeRange(activeYear, value)}
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
                  quickAddValue={defaultSavingsRate}
                  onQuickAdd={(value) => quickAddSavingsRange(activeYear, value)}
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
                  currentFixedDefs={currentFixedDefs}
                />

                {/* Preview */}
                <PreviewTable
                  yearConfig={activeConfig}
                  variableTotals={getYearlyVariableTotals(activeYear, expenses)}
                />
              </>
            )}

            {/* Save mode — segmented control */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-theme-muted">
                Save mode
              </span>
              <div className="inline-flex rounded-theme-medium bg-theme-background border border-theme-border p-0.5">
                <button
                  onClick={() => setSaveMode("merge")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-theme-medium transition-all ${
                    saveMode === "merge"
                      ? "bg-theme-surface text-theme-primary shadow-sm"
                      : "text-theme-muted hover:text-theme-text"
                  }`}
                >
                  Merge
                </button>
                <button
                  onClick={() => setSaveMode("replace")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-theme-medium transition-all ${
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
              overwrite existing months. Unchanged months keep their old values.
              Old snapshots remain.
              <br />
              <strong className="text-theme-text">Replace</strong>: All existing
              snapshots for the year are deleted and replaced. Income/savings
              overrides are fully rewritten.
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

          {/* Actions — desktop only */}
          <div className="hidden sm:flex items-center justify-end gap-2 pt-4">
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
              {saving ? "Saving…" : "Confirm Save"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
