import { useState } from "react";
import { useSettings } from "../../context/settingsContext";
import { cn } from "../../utils/cn";
import {
  getCategoryColor,
  GREEN_TO_RED_SCALE,
} from "./summaryColorUtils";
import type { MonthlySummary } from "../../types";

interface BudgetFlowProps {
  summary: MonthlySummary;
  variableBreakdown: VariableBreakdownItem[];
}

interface BarSegment {
  label: string;
  value: number;
  pct: number;
  colorClass?: string;
  bgClass?: string;
  textColor?: string;
  bgColor?: string;
}

interface HoveredBarSegment {
  label: string;
  value: number;
  pct: number;
  left: number;
  top: number;
}

interface VariableBreakdownItem {
  name: string;
  amount: number;
  pct: number;
}

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

export default function BudgetFlow({
  summary,
  variableBreakdown,
}: BudgetFlowProps) {
  const { formatAmount, currentTheme } = useSettings();
  const [hoveredSegment, setHoveredSegment] = useState<HoveredBarSegment | null>(
    null,
  );

  const {
    income,
    fixedExpensesTotal,
    variableExpenses,
    autoSavings,
    remaining,
  } = summary;

  const isOverBudget = remaining < 0;
  const baselineRemaining = Math.max(
    0,
    income - Math.max(0, autoSavings) - fixedExpensesTotal,
  );
  const totalAllocated = fixedExpensesTotal + variableExpenses + Math.max(0, autoSavings);
  const spentPct = pct(totalAllocated, income);
  const reservedSavingsColor = currentTheme.colors.text;
  const remainingTone = getRemainingBarColor(
    remaining,
    baselineRemaining,
    currentTheme.colors.success,
    currentTheme.colors.danger,
  );

  const segments: BarSegment[] = [
    {
      label: "Auto Savings",
      value: Math.max(0, autoSavings),
      pct: pct(Math.max(0, autoSavings), income),
      textColor: reservedSavingsColor,
      bgColor: reservedSavingsColor,
    },
    {
      label: "Fixed",
      value: fixedExpensesTotal,
      pct: pct(fixedExpensesTotal, income),
      colorClass: "text-theme-primary",
      bgClass: "bg-theme-primary",
    },
    ...variableBreakdown.map((item) => ({
      label: item.name,
      value: item.amount,
      pct: pct(item.amount, income),
      bgColor: getCategoryColor(item.name),
    })),
  ].filter((s) => s.value > 0);

  return (
    <div className="rounded-theme-large border border-theme-border bg-theme-surface p-5 space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-theme-muted uppercase tracking-wider mb-0.5">Monthly Budget</p>
          <p className="text-2xl font-bold text-theme-text tabular-nums">
            {formatAmount(income)}
          </p>
        </div>
        <div className={cn(
          "text-right",
          isOverBudget ? "text-theme-danger" : remaining === 0 ? "text-theme-muted" : "text-theme-success",
        )}>
          <p className="text-xs uppercase tracking-wider mb-0.5 opacity-70">
            {isOverBudget ? "Over budget" : "Remaining"}
          </p>
          <p className="text-2xl font-bold tabular-nums">
            {formatAmount(Math.abs(remaining))}
          </p>
        </div>
      </div>

      {/* Stacked progress bar */}
      {income > 0 && (
        <div className="space-y-2">
          <div className="relative pt-7">
            {hoveredSegment && (
              <div
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-theme-medium border border-theme-border bg-theme-surface px-2.5 py-1.5 shadow-sm"
                style={{
                  left: hoveredSegment.left,
                  top: hoveredSegment.top,
                }}
              >
                <div className="text-[0.6875rem] font-medium text-theme-text">
                  {hoveredSegment.label}
                </div>
                <div className="text-[0.6875rem] text-theme-muted tabular-nums">
                  {formatAmount(hoveredSegment.value)} · {hoveredSegment.pct.toFixed(0)}%
                </div>
              </div>
            )}
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-theme-background gap-px"
              onMouseLeave={() => setHoveredSegment(null)}
            >
            {segments.map((seg) =>
              seg.pct > 0 ? (
                <div
                  key={seg.label}
                  className={cn(
                    "h-full transition-all duration-500",
                    seg.bgClass,
                  )}
                  style={{
                    width: `${seg.pct}%`,
                    backgroundColor: seg.bgColor,
                  }}
                  onMouseEnter={(e) => {
                    const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
                    if (!parentRect) return;
                    setHoveredSegment({
                      label: seg.label,
                      value: seg.value,
                      pct: seg.pct,
                      left: e.clientX - parentRect.left,
                      top: -10,
                    });
                  }}
                  onMouseMove={(e) => {
                    const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
                    if (!parentRect) return;
                    setHoveredSegment((prev) =>
                      prev
                        ? {
                            ...prev,
                            left: e.clientX - parentRect.left,
                            top: -10,
                          }
                        : prev,
                    );
                  }}
                />
              ) : null,
            )}
            {/* Remaining portion */}
            {!isOverBudget && remaining > 0 && (
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${pct(remaining, income)}%`,
                  backgroundColor: remainingTone,
                }}
                onMouseEnter={(e) => {
                  const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (!parentRect) return;
                  setHoveredSegment({
                    label: "Remaining",
                    value: remaining,
                    pct: pct(remaining, income),
                    left: e.clientX - parentRect.left,
                    top: -10,
                  });
                }}
                onMouseMove={(e) => {
                  const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
                  if (!parentRect) return;
                  setHoveredSegment((prev) =>
                    prev
                      ? {
                          ...prev,
                          left: e.clientX - parentRect.left,
                          top: -10,
                        }
                      : prev,
                  );
                }}
              />
            )}
          </div>
          </div>
          <div className="flex justify-between text-[0.6875rem] text-theme-muted tabular-nums">
            <span>0%</span>
            <span className={cn(spentPct > 100 ? "text-theme-danger font-medium" : "")}>
              {spentPct.toFixed(0)}% allocated
            </span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Allocation rows */}
      <div className="space-y-1">
        <AllocationRow
          label="Fixed Expenses"
          value={fixedExpensesTotal}
          pct={pct(fixedExpensesTotal, income)}
          colorClass="bg-theme-primary"
          textClass="text-theme-primary"
          formatAmount={formatAmount}
        />
        <AllocationRow
          label="Variable Expenses"
          value={variableExpenses}
          pct={pct(variableExpenses, income)}
          colorClass="bg-theme-danger"
          textClass="text-theme-danger"
          formatAmount={formatAmount}
        />
        <AllocationRow
          label="Auto Savings"
          value={Math.max(0, autoSavings)}
          pct={pct(Math.max(0, autoSavings), income)}
          dotColor={reservedSavingsColor}
          textColor={reservedSavingsColor}
          formatAmount={formatAmount}
        />

        {/* Divider */}
        <div className="border-t border-theme-border my-2" />

        {/* Remaining / over budget */}
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-block w-2 h-2 rounded-full shrink-0",
              isOverBudget ? "bg-theme-danger" : "bg-theme-success",
            )} />
            <span className="text-sm font-medium text-theme-text">
              {isOverBudget ? "Over Budget" : "Remaining"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-theme-muted tabular-nums w-10 text-right">
              {income > 0 ? `${Math.abs(pct(remaining, income)).toFixed(0)}%` : "—"}
            </span>
            <span className={cn(
              "text-sm font-semibold tabular-nums w-24 text-right",
              isOverBudget ? "text-theme-danger" : "text-theme-success",
            )}>
              {isOverBudget ? "−" : "+"}{formatAmount(Math.abs(remaining))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AllocationRowProps {
  label: string;
  value: number;
  pct: number;
  colorClass?: string;
  textClass?: string;
  dotColor?: string;
  textColor?: string;
  formatAmount: (n: number) => string;
}

function AllocationRow({
  label,
  value,
  pct,
  colorClass,
  textClass,
  dotColor,
  textColor,
  formatAmount,
}: AllocationRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span
        className={cn("inline-block w-2 h-2 rounded-full shrink-0", colorClass)}
        style={{ backgroundColor: dotColor }}
      />
      <span className="text-sm text-theme-text flex-1 min-w-0 truncate">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-theme-muted tabular-nums w-10 text-right">
          {pct > 0 ? `${pct.toFixed(0)}%` : "—"}
        </span>
        <span
          className={cn("text-sm font-semibold tabular-nums w-24 text-right", textClass)}
          style={{ color: textColor }}
        >
          {formatAmount(value)}
        </span>
      </div>
    </div>
  );
}
