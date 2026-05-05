import { useSettings } from "../../context/settingsContext";
import { cn } from "../../utils/cn";
import type { MonthlySummary } from "../../types";

interface BudgetFlowProps {
  summary: MonthlySummary;
}

interface BarSegment {
  label: string;
  value: number;
  pct: number;
  colorClass: string;
  bgClass: string;
}

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function mixHex(startHex: string, endHex: string, amount: number): string {
  const [sr, sg, sb] = hexToRgb(startHex);
  const [er, eg, eb] = hexToRgb(endHex);
  const ratio = clamp(amount, 0, 1);
  const mix = (start: number, end: number) =>
    Math.round(start + (end - start) * ratio);

  return `rgb(${mix(sr, er)}, ${mix(sg, eg)}, ${mix(sb, eb)})`;
}

export default function BudgetFlow({ summary }: BudgetFlowProps) {
  const { formatAmount, currentTheme } = useSettings();

  const {
    income,
    fixedExpensesTotal,
    variableExpenses,
    autoSavings,
    remaining,
  } = summary;

  const isOverBudget = remaining < 0;
  const totalAllocated = fixedExpensesTotal + variableExpenses + Math.max(0, autoSavings);
  const spentPct = pct(totalAllocated, income);
  const remainingPct = pct(Math.max(0, remaining), income);
  const steppedRemainingPct = Math.round(remainingPct / 5) * 5;
  const remainingRatio = steppedRemainingPct / 100;
  const remainingTone = mixHex(
    currentTheme.colors.danger,
    currentTheme.colors.success,
    remainingRatio,
  );

  const segments: BarSegment[] = [
    {
      label: "Fixed",
      value: fixedExpensesTotal,
      pct: pct(fixedExpensesTotal, income),
      colorClass: "text-theme-primary",
      bgClass: "bg-theme-primary",
    },
    {
      label: "Variable",
      value: variableExpenses,
      pct: pct(variableExpenses, income),
      colorClass: "text-theme-secondary",
      bgClass: "bg-theme-secondary",
    },
    {
      label: "Savings",
      value: Math.max(0, autoSavings),
      pct: pct(Math.max(0, autoSavings), income),
      colorClass: "text-theme-success",
      bgClass: "bg-theme-success",
    },
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
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-theme-background gap-px">
            {segments.map((seg) =>
              seg.pct > 0 ? (
                <div
                  key={seg.label}
                  className={cn("h-full transition-all duration-500", seg.bgClass)}
                  style={{ width: `${seg.pct}%` }}
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
              />
            )}
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
          colorClass="bg-theme-secondary"
          textClass="text-theme-secondary"
          formatAmount={formatAmount}
        />
        <AllocationRow
          label="Auto Savings"
          value={Math.max(0, autoSavings)}
          pct={pct(Math.max(0, autoSavings), income)}
          colorClass="bg-theme-success"
          textClass="text-theme-success"
          formatAmount={formatAmount}
        />

        {/* Divider */}
        <div className="border-t border-theme-border my-2" />

        {/* Remaining / over budget */}
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-block w-2 h-2 rounded-full shrink-0",
              isOverBudget ? "bg-theme-danger" : "bg-theme-success opacity-40",
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
  colorClass: string;
  textClass: string;
  formatAmount: (n: number) => string;
}

function AllocationRow({
  label,
  value,
  pct,
  colorClass,
  textClass,
  formatAmount,
}: AllocationRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", colorClass)} />
      <span className="text-sm text-theme-text flex-1 min-w-0 truncate">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-theme-muted tabular-nums w-10 text-right">
          {pct > 0 ? `${pct.toFixed(0)}%` : "—"}
        </span>
        <span className={cn("text-sm font-semibold tabular-nums w-24 text-right", textClass)}>
          {formatAmount(value)}
        </span>
      </div>
    </div>
  );
}
