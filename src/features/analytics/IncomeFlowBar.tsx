import { useState } from "react";
import { cn } from "../../utils/cn";
import { useThemeColors } from "./AnalyticsCharts";
import { GREEN_TO_RED_SCALE } from "../summary/summaryColorUtils";

function getRemainingBarColor(
  remaining: number,
  baselineRemaining: number,
  successColor: string,
  dangerColor: string,
): string {
  if (remaining <= 0 || baselineRemaining <= 0) return dangerColor;
  const remainingPct = (remaining / baselineRemaining) * 100;
  const scale = [
    successColor,
    ...GREEN_TO_RED_SCALE.slice(1, -1).map((item) => item.hex),
    dangerColor,
  ];
  if (remainingPct >= 50) return scale[0];
  const ratioFromHalfToZero = (50 - remainingPct) / 50;
  const scaledIndex = 1 + Math.floor(ratioFromHalfToZero * (scale.length - 1));
  return scale[Math.min(scaledIndex, scale.length - 1)];
}

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

interface IncomeFlowBarProps {
  yearIncome: number;
  yearFixed: number;
  yearVariable: number;
  yearSavings: number;
  yearRemaining: number;
  monthlyIncome: number[];
  monthlyFixed: number[];
  monthlyVariable: number[];
  monthlySavings: (number | null)[];
  monthlyRemaining: (number | null)[];
  selectedMonth: number | null;
  monthCount: number;
  isCurrentYear: boolean;
  year: number;
  formatAmount: (n: number) => string;
}

interface HoveredSegment {
  key: string;
  label: string;
  value: number;
  pct: number;
  left: number;
}

interface BarSegmentData {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface AllocationRowProps {
  label: string;
  value: number;
  rowPct: number;
  dotColor: string;
  textColor: string;
  prefix?: string;
  formatAmount: (n: number) => string;
}

function AllocationRow({
  label,
  value,
  rowPct,
  dotColor,
  textColor,
  prefix = "",
  formatAmount,
}: AllocationRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      <span className="text-sm text-theme-text flex-1 min-w-0 truncate">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-theme-muted tabular-nums w-10 text-right">
          {rowPct > 0 ? `${rowPct.toFixed(0)}%` : "—"}
        </span>
        <span
          className="text-sm font-semibold tabular-nums w-24 text-right"
          style={{ color: textColor }}
        >
          {prefix}{formatAmount(value)}
        </span>
      </div>
    </div>
  );
}

export default function IncomeFlowBar({
  yearIncome,
  yearFixed,
  yearVariable,
  yearSavings,
  yearRemaining,
  monthlyIncome,
  monthlyFixed,
  monthlyVariable,
  monthlySavings,
  monthlyRemaining,
  selectedMonth,
  monthCount,
  isCurrentYear,
  year,
  formatAmount,
}: IncomeFlowBarProps) {
  const colors = useThemeColors();
  const [hoveredSegment, setHoveredSegment] = useState<HoveredSegment | null>(null);
  const [activeSegmentKey, setActiveSegmentKey] = useState<string | null>(null);

  const income    = selectedMonth !== null ? (monthlyIncome[selectedMonth] ?? 0)              : yearIncome;
  const fixed     = selectedMonth !== null ? (monthlyFixed[selectedMonth] ?? 0)               : yearFixed;
  const variable  = selectedMonth !== null ? (monthlyVariable[selectedMonth] ?? 0)            : yearVariable;
  const savings   = selectedMonth !== null ? (monthlySavings[selectedMonth] ?? 0)             : yearSavings;
  const remaining = selectedMonth !== null ? (monthlyRemaining[selectedMonth] ?? 0)           : yearRemaining;

  const cappedSavings = Math.min(Math.max(0, savings), income);
  const totalAllocated = cappedSavings + fixed + variable;
  const isOverBudget = totalAllocated > income;
  const overflowAmt = isOverBudget ? totalAllocated - income : 0;
  const baselineRemaining = Math.max(0, income - Math.max(0, savings) - fixed);
  const remainingTone = getRemainingBarColor(remaining, baselineRemaining, colors.success, colors.danger);
  const spentPct = pct(totalAllocated, income);

  const headlineLabel =
    selectedMonth !== null
      ? `${MONTH_LABELS[selectedMonth]} Income`
      : isCurrentYear
        ? "YTD Income"
        : "Total Income";

  const headlineContext =
    selectedMonth !== null
      ? null
      : isCurrentYear
        ? `${monthCount} month${monthCount === 1 ? "" : "s"}`
        : "12 months";

  const barSegments: BarSegmentData[] = [
    { key: "savings",  label: "Savings",  value: cappedSavings, color: colors.text },
    { key: "fixed",    label: "Fixed",    value: fixed,         color: colors.primary },
    { key: "variable", label: "Variable", value: variable,      color: colors.danger  },
    ...(!isOverBudget && remaining > 0
      ? [{ key: "remaining", label: "Remaining", value: remaining, color: remainingTone }]
      : []),
  ].filter((s) => s.value > 0);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, seg: BarSegmentData) => {
    const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    setHoveredSegment({
      key: seg.key,
      label: seg.label,
      value: seg.value,
      pct: pct(seg.value, income),
      left: e.clientX - parentRect.left,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    setHoveredSegment((prev) =>
      prev ? { ...prev, left: e.clientX - parentRect.left } : prev,
    );
  };

  const handleSegmentClick = (key: string) => {
    setActiveSegmentKey((prev) => (prev === key ? null : key));
  };

  const activeTooltip: HoveredSegment | null = hoveredSegment ?? (() => {
    if (!activeSegmentKey) return null;
    const seg = barSegments.find((s) => s.key === activeSegmentKey)
      ?? (isOverBudget && activeSegmentKey === "overflow"
        ? { key: "overflow", label: "Over Budget", value: overflowAmt, color: colors.danger }
        : null);
    if (!seg) return null;
    return { key: seg.key, label: seg.label, value: seg.value, pct: pct(seg.value, income), left: 50 };
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium text-theme-muted uppercase tracking-wider">
          {headlineLabel}
        </span>
        <span className="text-lg font-bold text-theme-text tabular-nums">
          {formatAmount(income)}
        </span>
        {headlineContext && (
          <span className="text-xs text-theme-muted">· {headlineContext}</span>
        )}
      </div>

      {income === 0 ? (
        <div className="h-8 flex items-center justify-center rounded-full bg-theme-background">
          <span className="text-xs text-theme-muted">No income data</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="relative pt-7">
            {activeTooltip && (
              <div
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-theme-medium border border-theme-border bg-theme-surface px-2.5 py-1.5 shadow-sm"
                style={{ left: activeTooltip.left }}
              >
                <div className="text-[0.6875rem] font-medium text-theme-text">
                  {activeTooltip.label}
                </div>
                <div className="text-[0.6875rem] text-theme-muted tabular-nums">
                  {formatAmount(activeTooltip.value)} · {activeTooltip.pct.toFixed(0)}%
                </div>
              </div>
            )}

            <div className="relative flex h-3 w-full" style={{ minWidth: 0 }}>
              <div
                className="flex h-full w-full overflow-hidden rounded-full bg-theme-background gap-px"
                onMouseLeave={() => setHoveredSegment(null)}
              >
                {barSegments.map((seg) => (
                  <div
                    key={seg.key}
                    className="h-full transition-all duration-500 cursor-pointer"
                    style={{ width: `${pct(seg.value, income)}%`, backgroundColor: seg.color }}
                    onMouseEnter={(e) => handleMouseEnter(e, seg)}
                    onMouseMove={handleMouseMove}
                    onClick={() => handleSegmentClick(seg.key)}
                  />
                ))}
              </div>

              {isOverBudget && overflowAmt > 0 && (
                <div
                  className="h-full rounded-r-full transition-all duration-500 cursor-pointer ml-px"
                  style={{
                    width: `${pct(overflowAmt, income)}%`,
                    backgroundColor: colors.danger,
                    opacity: 0.65,
                  }}
                  onMouseEnter={(e) => {
                    const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
                    if (!parentRect) return;
                    setHoveredSegment({
                      key: "overflow", label: "Over Budget", value: overflowAmt,
                      pct: pct(overflowAmt, income), left: e.clientX - parentRect.left,
                    });
                  }}
                  onMouseMove={handleMouseMove}
                  onClick={() => handleSegmentClick("overflow")}
                />
              )}

              {isOverBudget && (
                <div
                  className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed pointer-events-none"
                  style={{
                    left: `${pct(income, totalAllocated)}%`,
                    borderColor: colors.danger,
                    opacity: 0.7,
                  }}
                />
              )}
            </div>

            <div className="flex justify-between text-[0.6875rem] text-theme-muted tabular-nums mt-1">
              <span>0%</span>
              <span className={cn(spentPct > 100 ? "text-theme-danger font-medium" : "")}>
                {spentPct.toFixed(0)}% allocated
              </span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <AllocationRow
          label="Savings"
          value={cappedSavings}
          rowPct={pct(cappedSavings, income)}
          dotColor={colors.text}
          textColor={colors.text}
          formatAmount={formatAmount}
        />
        <AllocationRow
          label="Fixed Expenses"
          value={fixed}
          rowPct={pct(fixed, income)}
          dotColor={colors.primary}
          textColor={colors.primary}
          formatAmount={formatAmount}
        />
        <AllocationRow
          label="Variable Expenses"
          value={variable}
          rowPct={pct(variable, income)}
          dotColor={colors.danger}
          textColor={colors.danger}
          formatAmount={formatAmount}
        />

        <div className="border-t border-theme-border my-2" />

        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: remaining >= 0 ? colors.success : colors.danger }}
            />
            <span className="text-sm text-theme-text">
              {remaining >= 0 ? "Remaining" : "Over Budget"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-theme-muted tabular-nums w-10 text-right">
              {income > 0 ? `${Math.abs(pct(remaining, income)).toFixed(0)}%` : "—"}
            </span>
            <span
              className="text-sm font-semibold tabular-nums w-24 text-right"
              style={{ color: remaining >= 0 ? colors.success : colors.danger }}
            >
              {remaining >= 0 ? "+" : "−"}{formatAmount(Math.abs(remaining))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
