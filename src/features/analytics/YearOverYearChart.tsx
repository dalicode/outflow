import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { cn } from "../../utils/cn";
import type { AnalyticsData } from "../../types";
import type { ThemeColors } from "./AnalyticsCharts";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "$0";
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function fmtFull(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "$0.00";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0%";
  return `${n.toFixed(1)}%`;
}

function fmtChange(value: number): string {
  if (value === 0) return "$0";
  const amount = fmtFull(Math.abs(value));
  return value > 0 ? `+${amount}` : `-${amount}`;
}

interface MonthSnapshot {
  year: number;
  expenses: number;
  income: number;
}

interface ChartPoint {
  label: string;
  year: string;
  expensesDelta: number;
  incomeDelta: number;
  prevExpenses: number;
  currExpenses: number;
  prevIncome: number;
  currIncome: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    payload: ChartPoint;
  }>;
  label?: string;
  colors: ThemeColors;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  colors,
}: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;

  return (
    <div
      className="rounded-theme-medium border shadow-lg px-3 py-2 text-xs"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.grid,
        color: colors.text,
      }}
    >
      <div className="font-semibold mb-1.5" style={{ color: colors.text }}>
        {point.label}
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: colors.danger }}
        />
        <span className="flex-1" style={{ color: colors.muted }}>
          Expenses
        </span>
        <span style={{ color: colors.text }}>
          {fmtFull(point.prevExpenses)} → {fmtFull(point.currExpenses)}
        </span>
        <span
          className={cn(
            "font-semibold",
            point.expensesDelta <= 0
              ? "text-theme-success"
              : "text-theme-danger",
          )}
        >
          {point.expensesDelta > 0 ? "+" : ""}
          {fmtChange(point.expensesDelta)} (
          {fmtPct(
            (point.expensesDelta /
              Math.max(Math.abs(point.prevExpenses), 1)) *
              100,
          )}
          )
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: colors.success }}
        />
        <span className="flex-1" style={{ color: colors.muted }}>
          Income
        </span>
        <span style={{ color: colors.text }}>
          {fmtFull(point.prevIncome)} → {fmtFull(point.currIncome)}
        </span>
        <span
          className={cn(
            "font-semibold",
            point.incomeDelta >= 0
              ? "text-theme-success"
              : "text-theme-danger",
          )}
        >
          {point.incomeDelta > 0 ? "+" : ""}
          {fmtChange(point.incomeDelta)} (
          {fmtPct(
            (point.incomeDelta / Math.max(Math.abs(point.prevIncome), 1)) *
              100,
          )}
          )
        </span>
      </div>
    </div>
  );
};

interface DeltaBadgeProps {
  current: number;
  previous: number;
  label: string;
  colors: ThemeColors;
}

const DeltaBadge = ({ current, previous, label, colors }: DeltaBadgeProps) => {
  if (previous === 0 && current === 0) return null;
  const delta = current - previous;
  const pct =
    previous !== 0
      ? (delta / Math.abs(previous)) * 100
      : delta > 0
        ? 100
        : -100;
  const isPositive = delta > 0;
  const isGood = label === "Expenses" ? !isPositive : isPositive;

  return (
    <div className="flex items-center gap-1 text-[0.6875rem]">
      <span style={{ color: colors.muted }}>{label}:</span>
      <span
        className={cn(
          "font-semibold",
          isGood ? "text-theme-success" : "text-theme-danger",
        )}
      >
        {isPositive ? "+" : ""}
        {fmtPct(pct)}
      </span>
      <span style={{ color: colors.muted }}>({fmtChange(delta)})</span>
    </div>
  );
};

interface ComparisonBadgeProps {
  currYear: number;
  prevYear: number;
  curr: MonthSnapshot;
  prev: MonthSnapshot;
  colors: ThemeColors;
}

const ComparisonBadge = ({
  currYear,
  prevYear,
  curr,
  prev,
  colors,
}: ComparisonBadgeProps) => {
  return (
    <div
      className="rounded-theme-medium border px-3 py-2"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.grid,
      }}
    >
      <div
        className="text-[0.6875rem] font-medium mb-1"
        style={{ color: colors.muted }}
      >
        {currYear} vs {prevYear}
      </div>
      <div className="space-y-0.5">
        <DeltaBadge
          current={curr.expenses}
          previous={prev.expenses}
          label="Expenses"
          colors={colors}
        />
        <DeltaBadge
          current={curr.income}
          previous={prev.income}
          label="Income"
          colors={colors}
        />
      </div>
    </div>
  );
};

interface YearOverYearChartProps {
  multiYearData: AnalyticsData[];
  selectedMonth: number;
  colors: ThemeColors;
  monthLabel: string;
}

export default function YearOverYearChart({
  multiYearData,
  selectedMonth,
  colors,
  monthLabel,
}: YearOverYearChartProps) {
  const yoyData = useMemo<MonthSnapshot[]>(
    () =>
      multiYearData
        .map((d) => ({
          year: d.year,
          expenses: d.monthlyTotals[selectedMonth] || 0,
          income: d.monthlyIncome[selectedMonth] || 0,
        }))
        .filter((d) => d.expenses > 0 || d.income > 0),
    [multiYearData, selectedMonth],
  );

  const deltaData = useMemo<ChartPoint[]>(() => {
    return yoyData.slice(1).map((curr, i) => {
      const prev = yoyData[i];
      return {
        label: `${curr.year} vs ${prev.year}`,
        year: String(curr.year),
        expensesDelta: curr.expenses - prev.expenses,
        incomeDelta: curr.income - prev.income,
        prevExpenses: prev.expenses,
        currExpenses: curr.expenses,
        prevIncome: prev.income,
        currIncome: curr.income,
      };
    });
  }, [yoyData]);

  const badgeComparisons = useMemo(() => {
    const count = Math.min(yoyData.length - 1, 3);
    const comparisons: Array<{
      currYear: number;
      prevYear: number;
      curr: MonthSnapshot;
      prev: MonthSnapshot;
    }> = [];
    for (let i = 0; i < count; i++) {
      const currIdx = yoyData.length - 1 - i;
      const prevIdx = currIdx - 1;
      comparisons.push({
        currYear: yoyData[currIdx].year,
        prevYear: yoyData[prevIdx].year,
        curr: yoyData[currIdx],
        prev: yoyData[prevIdx],
      });
    }
    return comparisons;
  }, [yoyData]);

  const isLoading = multiYearData.some((d) => d.loading);

  if (isLoading) {
    return (
      <div className="h-[200px] md:h-[260px] flex items-center justify-center">
        <span className="text-xs text-theme-muted">Loading…</span>
      </div>
    );
  }

  if (yoyData.length < 2) {
    return (
      <div className="h-[200px] md:h-[260px] flex items-center justify-center">
        <span className="text-xs text-theme-muted">
          Need data from at least 2 years to compare
        </span>
      </div>
    );
  }

  const hasData = deltaData.some(
    (d) => d.expensesDelta !== 0 || d.incomeDelta !== 0,
  );
  if (!hasData) {
    return (
      <div className="h-[200px] md:h-[260px] flex items-center justify-center">
        <span className="text-xs text-theme-muted">
          No data for {monthLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={deltaData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.grid}
            opacity={0.5}
          />
          <XAxis
            dataKey="year"
            tick={{ fill: colors.muted, fontSize: 12 }}
            axisLine={{ stroke: colors.grid }}
          />
          <YAxis
            tick={{ fill: colors.muted, fontSize: 12 }}
            axisLine={{ stroke: colors.grid }}
            tickFormatter={fmtCompact}
          />
          <Tooltip content={<CustomTooltip colors={colors} />} />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: colors.text }}
            formatter={(v: string) =>
              v === "expensesDelta" ? "Expenses Δ" : "Income Δ"
            }
          />
          <ReferenceLine y={0} stroke={colors.grid} />
          <Line
            type="monotone"
            dataKey="expensesDelta"
            name="expensesDelta"
            stroke={colors.danger}
            strokeWidth={2}
            dot={{ r: 4, fill: colors.danger }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="incomeDelta"
            name="incomeDelta"
            stroke={colors.success}
            strokeWidth={2}
            dot={{ r: 4, fill: colors.success }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {badgeComparisons.map((comp, i) => (
          <ComparisonBadge
            key={i}
            currYear={comp.currYear}
            prevYear={comp.prevYear}
            curr={comp.curr}
            prev={comp.prev}
            colors={colors}
          />
        ))}
      </div>
    </div>
  );
}
