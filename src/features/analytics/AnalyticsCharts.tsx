import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
  LabelList,
} from "recharts";
import { useSettings } from "../../context/settingsContext";
import { cn } from "../../utils/cn";
import { getCategoryColor } from "../summary/summaryColorUtils";
import YearOverYearChart from "./YearOverYearChart";
import type { AnalyticsData } from "../../types";

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

export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  danger: string;
  text: string;
  muted: string;
  surface: string;
  background: string;
  grid: string;
  chartPalette: string[];
}

export function useThemeColors(): ThemeColors {
  const { currentTheme } = useSettings();
  return useMemo(() => {
    const p = currentTheme.colors.primary;
    const s = currentTheme.colors.secondary;
    const su = currentTheme.colors.success;
    const d = currentTheme.colors.danger;
    const t = currentTheme.colors.text;
    const m = currentTheme.colors.muted;
    return {
      primary: p,
      secondary: s,
      success: su,
      danger: d,
      text: t,
      muted: m,
      surface: currentTheme.colors.surface,
      background: currentTheme.colors.background,
      grid: currentTheme.colors.border,
      chartPalette: [p, s, d, t, m, "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"],
    };
  }, [currentTheme]);
}

// ── Month slicing helper ─────────────────────────────────────────────────────

function getMonthCount(
  year: number,
  currentYear: number,
  currentMonth: number,
): number {
  if (year > currentYear) return 0;
  if (year === currentYear) return currentMonth + 1;
  return 12;
}

function sliceMonths(arr: (number | null)[], count: number): (number | null)[] {
  return arr.slice(0, count);
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  value: number;
  name: string;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  colors: ThemeColors;
  formatter?: (value: number, name: string) => [string, string] | string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  formatter,
  colors,
}: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-theme-medium border shadow-lg px-3 py-2 text-xs"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.grid,
        color: colors.text,
      }}
    >
      {label && (
        <div className="font-semibold mb-1" style={{ color: colors.text }}>
          {label}
        </div>
      )}
      {payload.map((entry, i) => {
        const value = formatter
          ? formatter(entry.value, entry.name)
          : entry.value;
        const displayValue = Array.isArray(value) ? value[0] : value;
        const displayName = Array.isArray(value) ? value[1] : entry.name;
        return (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="flex-1" style={{ color: colors.muted }}>
              {displayName}
            </span>
            <span className="font-medium" style={{ color: colors.text }}>
              {displayValue}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  accentColor?: string;
  colors: ThemeColors;
}

const MetricCard = ({
  label,
  value,
  subValue,
  accentColor,
  colors,
}: MetricCardProps) => {
  return (
    <div
      className="rounded-theme-large border p-4 text-center bg-theme-background border-theme-border"
    >
      <div className="text-xs font-medium mb-1 text-theme-muted">
        {label}
      </div>
      <div
        className="text-xl font-bold"
        style={{ color: accentColor || colors.text }}
      >
        {value}
      </div>
      {subValue && (
        <div className="text-[0.6875rem] mt-0.5 text-theme-muted">
          {subValue}
        </div>
      )}
    </div>
  );
};

// ── 1. Monthly Spending Trend ────────────────────────────────────────────────

interface ChartProps {
  data: AnalyticsData;
  colors: ThemeColors;
  monthCount: number;
}

// ── 1. Monthly Stacked Bar + Income Line ─────────────────────────────────────

const MonthlyStackedChart = ({ data, colors, monthCount }: ChartProps) => {
  // Build per-category variable rows for stacking
  const categoryKeys = useMemo(
    () => (data.variableRows ?? []).map((r) => r.key),
    [data.variableRows],
  );

  const chartData = useMemo(() => {
    return MONTHS.slice(0, monthCount).map((m, i) => {
      const fixed = data.monthlyFixedTotals[i] || 0;
      const income = data.monthlyIncome[i] || 0;
      const prevTotal = i > 0 ? (data.monthlyTotals[i - 1] || 0) : null;
      const total = data.monthlyTotals[i] || 0;
      const momDelta = prevTotal !== null ? total - prevTotal : null;
      const entry: Record<string, number | null> = { fixed, income, momDelta };
      // Add per-category amounts
      (data.variableRows ?? []).forEach((row) => {
        entry[row.key] = row.amounts[i] || 0;
      });
      return { month: m, ...entry };
    });
  }, [data, monthCount]);

  const hasData = chartData.some((d) =>
    (d.fixed as number) > 0 ||
    categoryKeys.some((k) => (d[k] as number) > 0),
  );
  if (!hasData) return <EmptyState label="No spending data" />;

  // Map key → display name for tooltip
  const keyToName = useMemo(() => {
    const map: Record<string, string> = {};
    (data.variableRows ?? []).forEach((r) => { map[r.key] = r.name; });
    return map;
  }, [data.variableRows]);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={chartData}
        margin={{ top: 24, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={colors.grid}
          opacity={0.5}
        />
        <XAxis
          dataKey="month"
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={{ stroke: colors.grid }}
        />
        <YAxis
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={{ stroke: colors.grid }}
          tickFormatter={fmtCompact}
        />
        <Tooltip
          content={
            <CustomTooltip
              colors={colors}
              formatter={(v: number, name: string) => {
                if (name === "fixed") return [fmtCompact(v), "Fixed"];
                if (name === "income") return [fmtCompact(v), "Income"];
                return [fmtCompact(v), keyToName[name] ?? name];
              }}
            />
          }
        />
        <Legend
          wrapperStyle={{ fontSize: "12px", color: colors.text }}
          formatter={(v: string) => {
            if (v === "fixed") return "Fixed";
            if (v === "income") return "Income";
            return keyToName[v] ?? v;
          }}
        />
        {/* Fixed expenses — bottom of stack */}
        <Bar
          dataKey="fixed"
          stackId="spend"
          fill={colors.primary}
          maxBarSize={32}
          radius={[0, 0, 0, 0]}
        />
        {/* Per-category variable bars — stacked above fixed */}
        {categoryKeys.map((key, idx) => {
          const isLast = idx === categoryKeys.length - 1;
          const catName = keyToName[key] ?? key;
          return (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              stackId="spend"
              fill={getCategoryColor(catName)}
              maxBarSize={32}
              radius={isLast ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            >
              {isLast && (
                <LabelList
                  dataKey="momDelta"
                  position="top"
                  content={(props) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { x, y, width, value } = props as any;
                    if (value == null || value === 0) return null;
                    const isPositive = value > 0;
                    return (
                      <text
                        x={(x as number) + (width as number) / 2}
                        y={(y as number) - 4}
                        textAnchor="middle"
                        fontSize={10}
                        fill={isPositive ? colors.danger : colors.success}
                      >
                        {isPositive ? "+" : "−"}{fmtCompact(Math.abs(value))}
                      </text>
                    );
                  }}
                />
              )}
            </Bar>
          );
        })}
        <Line
          type="monotone"
          dataKey="income"
          stroke={colors.success}
          strokeWidth={2}
          dot={{ r: 3, fill: colors.success }}
          activeDot={{ r: 5 }}
          strokeDasharray="4 2"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

// ── Table helpers ────────────────────────────────────────────────────────────

function getFocusMonthIndex(
  monthCount: number,
  selectedMonth: number | null,
): number | null {
  if (selectedMonth !== null) return selectedMonth;
  if (monthCount <= 0) return null;
  return monthCount - 1;
}

function fmtChange(value: number | null): string {
  if (value == null || isNaN(value)) return "—";
  if (value === 0) return "$0";
  const amount = fmtFull(Math.abs(value));
  return value > 0 ? `+${amount}` : `-${amount}`;
}

// ── 1b. Monthly comparison table ────────────────────────────────────────────

interface MonthlyComparisonTableProps {
  data: AnalyticsData;
  monthCount: number;
}

const MonthlyComparisonTable = ({
  data,
  monthCount,
}: MonthlyComparisonTableProps) => {
  const rows = useMemo(
    () =>
      MONTHS.slice(0, monthCount).map((month, index) => {
        const spending = data.monthlyTotals[index] || 0;
        const previous = index > 0 ? data.monthlyTotals[index - 1] || 0 : null;
        const savingsRate = data.monthlySavingsPct[index];
        const remaining = data.monthlyRemaining[index] ?? 0;
        return {
          month,
          income: data.monthlyIncome[index] || 0,
          fixed: data.monthlyFixedTotals[index] || 0,
          variable: data.monthlyVariableTotals[index] || 0,
          spending,
          remaining,
          savingsRate: savingsRate ?? 0,
          delta: previous == null ? null : spending - previous,
        };
      }),
    [data, monthCount],
  );

  if (rows.length === 0) return <EmptyState label="No month data" />;

  return (
    <div className="overflow-x-auto">
      <table className="analytics-breakdown-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Income</th>
            <th>Spend</th>
            <th>Fixed</th>
            <th>Variable</th>
            <th>Remaining</th>
            <th>Savings %</th>
            <th>MoM</th>
          </tr>
        </thead>
        <tbody className="text-theme-text text-sm">
          {rows.map((row) => (
            <tr key={row.month}>
              <td className="font-semibold text-theme-text">{row.month}</td>
              <td className="tabular-nums">{fmtFull(row.income)}</td>
              <td className="tabular-nums">{fmtFull(row.spending)}</td>
              <td className="tabular-nums">{fmtFull(row.fixed)}</td>
              <td className="tabular-nums">{fmtFull(row.variable)}</td>
              <td
                className={cn(
                  "tabular-nums",
                  row.remaining < 0
                    ? "text-theme-danger"
                    : "text-theme-success",
                )}
              >
                {fmtFull(row.remaining)}
              </td>
              <td className="tabular-nums">{fmtPct(row.savingsRate)}</td>
              <td
                className={cn(
                  "tabular-nums",
                  row.delta == null || row.delta === 0
                    ? "text-theme-muted"
                    : row.delta > 0
                      ? "text-theme-danger"
                      : "text-theme-success",
                )}
              >
                {fmtChange(row.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── 2b. Ranked movement table ───────────────────────────────────────────────

interface RankedCategoryTableProps {
  data: AnalyticsData;
  focusMonth: number | null;
  focusLabel: string;
}

export const RankedCategoryTable = ({
  data,
  focusMonth,
  focusLabel,
}: RankedCategoryTableProps) => {
  const rows = useMemo(() => {
    if (focusMonth == null) return [];
    const focusTotal = data.monthlyVariableTotals[focusMonth] || 0;
    return (data.variableRows || [])
      .map((row) => {
        const focus = row.amounts[focusMonth] || 0;
        const previous = focusMonth > 0 ? row.amounts[focusMonth - 1] || 0 : 0;
        return {
          key: row.key,
          name: row.name,
          focus,
          previous,
          total: row.yearTotal,
          share: focusTotal > 0 ? (focus / focusTotal) * 100 : 0,
        };
      })
      .filter((row) => row.focus > 0 || row.total > 0)
      .sort((a, b) => b.focus - a.focus || b.total - a.total)
      .slice(0, 8);
  }, [data.variableRows, data.monthlyVariableTotals, focusMonth]);

  if (focusMonth == null) return <EmptyState label="No category data" />;
  if (rows.length === 0) return <EmptyState label="No category data" />;

  return (
    <div className="overflow-x-auto">
      <table className="analytics-breakdown-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>{focusLabel}</th>
            <th>Previous</th>
            <th>Delta</th>
            <th>Share</th>
            <th>Year total</th>
          </tr>
        </thead>
        <tbody className={"text-theme-text text-sm"}>
          {rows.map((row) => {
            const delta = row.focus - row.previous;
            return (
              <tr key={row.key}>
                <td className="font-semibold text-theme-text">{row.name}</td>
                <td className="tabular-nums">{fmtFull(row.focus)}</td>
                <td className="tabular-nums">{fmtFull(row.previous)}</td>
                <td
                  className={cn(
                    "tabular-nums",
                    delta === 0
                      ? "text-theme-muted"
                      : delta > 0
                        ? "text-theme-danger"
                        : "text-theme-success",
                  )}
                >
                  {fmtChange(delta)}
                </td>
                <td className="tabular-nums">{`${row.share.toFixed(1)}%`}</td>
                <td className="tabular-nums">{fmtFull(row.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface RankedPayeeTableProps {
  data: AnalyticsData;
  focusMonth: number | null;
  focusLabel: string;
}

export const RankedPayeeTable = ({
  data,
  focusMonth,
  focusLabel,
}: RankedPayeeTableProps) => {
  const rows = useMemo(() => {
    if (focusMonth == null) return [];
    const focusTotal = data.payeeRows.reduce(
      (sum, row) => sum + (row.amounts[focusMonth] || 0),
      0,
    );
    return (data.payeeRows || [])
      .map((row) => {
        const focus = row.amounts[focusMonth] || 0;
        const previous = focusMonth > 0 ? row.amounts[focusMonth - 1] || 0 : 0;
        return {
          key: row.key,
          name: row.name,
          focus,
          previous,
          total: row.yearTotal,
          share: focusTotal > 0 ? (focus / focusTotal) * 100 : 0,
        };
      })
      .filter((row) => row.focus > 0 || row.total > 0)
      .sort((a, b) => b.focus - a.focus || b.total - a.total)
      .slice(0, 8);
  }, [data.payeeRows, focusMonth]);

  if (focusMonth == null) return <EmptyState label="No payee data" />;
  if (rows.length === 0) return <EmptyState label="No payee data" />;

  return (
    <div className="overflow-x-auto">
      <table className="analytics-breakdown-table">
        <thead>
          <tr>
            <th>Payee</th>
            <th>{focusLabel}</th>
            <th>Previous</th>
            <th>Delta</th>
            <th>Share</th>
            <th>Year total</th>
          </tr>
        </thead>
        <tbody className="text-theme-text text-sm">
          {rows.map((row) => {
            const delta = row.focus - row.previous;
            return (
              <tr key={row.key}>
                <td className="font-semibold text-theme-text">{row.name}</td>
                <td className="tabular-nums">{fmtFull(row.focus)}</td>
                <td className="tabular-nums">{fmtFull(row.previous)}</td>
                <td
                  className={cn(
                    "tabular-nums",
                    delta === 0
                      ? "text-theme-muted"
                      : delta > 0
                        ? "text-theme-danger"
                        : "text-theme-success",
                  )}
                >
                  {fmtChange(delta)}
                </td>
                <td className="tabular-nums">{`${row.share.toFixed(1)}%`}</td>
                <td className="tabular-nums">{fmtFull(row.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── 3b. Savings / budget health table ───────────────────────────────────────

interface SavingsHealthTableProps {
  data: AnalyticsData;
  monthCount: number;
  selectedMonth: number | null;
}

const SavingsHealthTable = ({
  data,
  monthCount,
  selectedMonth,
}: SavingsHealthTableProps) => {
  if (selectedMonth !== null) {
    const m = selectedMonth;
    const income = data.monthlyIncome[m] || 0;
    const spend = data.monthlyTotals[m] || 0;
    const remaining = data.monthlyRemaining[m] ?? 0;
    const savingsRate = data.monthlySavingsPct[m] ?? 0;
    const budgetUsed = income > 0 ? (spend / income) * 100 : 0;
    const pace =
      remaining < 0
        ? "Over budget"
        : savingsRate >= 60
          ? "Strong"
          : savingsRate >= 40
            ? "On track"
            : "Watch";

    const rows = [
      ["Income", fmtFull(income)],
      ["Spend", fmtFull(spend)],
      ["Remaining", fmtFull(remaining)],
      ["Savings rate", fmtPct(savingsRate)],
      ["Budget used", fmtPct(budgetUsed)],
      ["Pace", pace],
    ];

    return (
      <div className="overflow-x-auto">
        <table className="analytics-breakdown-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody className="text-theme-text text-sm">
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td className="font-semibold text-theme-text">{label}</td>
                <td className="tabular-nums">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const rows = MONTHS.slice(0, monthCount).map((month, index) => {
    const income = data.monthlyIncome[index] || 0;
    const spend = data.monthlyTotals[index] || 0;
    const remaining = data.monthlyRemaining[index] ?? 0;
    const savingsRate = data.monthlySavingsPct[index] ?? 0;
    const budgetUsed = income > 0 ? (spend / income) * 100 : 0;
    const pace =
      remaining < 0
        ? "Over budget"
        : budgetUsed <= 50
          ? "Under pace"
          : budgetUsed <= 75
            ? "On track"
            : "Ahead of pace";
    return {
      month,
      income,
      spend,
      remaining,
      savingsRate,
      budgetUsed,
      pace,
    };
  });

  if (rows.length === 0) return <EmptyState label="No budget health data" />;

  return (
    <div className="overflow-x-auto">
      <table className="analytics-breakdown-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Income</th>
            <th>Spend</th>
            <th>Remaining</th>
            <th>Savings %</th>
            <th>Budget used</th>
            <th>Pace</th>
          </tr>
        </thead>
        <tbody className="text-theme-text text-sm">
          {rows.map((row) => (
            <tr key={row.month}>
              <td className="font-semibold text-theme-text">{row.month}</td>
              <td className="tabular-nums">{fmtFull(row.income)}</td>
              <td className="tabular-nums">{fmtFull(row.spend)}</td>
              <td
                className={cn(
                  "tabular-nums",
                  row.remaining < 0
                    ? "text-theme-danger"
                    : "text-theme-success",
                )}
              >
                {fmtFull(row.remaining)}
              </td>
              <td className="tabular-nums">{fmtPct(row.savingsRate)}</td>
              <td className="tabular-nums">{fmtPct(row.budgetUsed)}</td>
              <td
                className={cn(
                  "tabular-nums",
                  row.remaining < 0
                    ? "text-theme-danger"
                    : "text-theme-success",
                )}
              >
                {row.pace}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── 4b. Fixed stability table ───────────────────────────────────────────────

interface FixedStabilityTableProps {
  data: AnalyticsData;
  monthCount: number;
  selectedMonth: number | null;
}

const FixedStabilityTable = ({
  data,
  monthCount,
  selectedMonth,
}: FixedStabilityTableProps) => {
  const focusMonth = getFocusMonthIndex(monthCount, selectedMonth);

  const rows = useMemo(() => {
    if (focusMonth == null) return [];
    return data.fixedRows
      .map((row) => {
        const focus = row.amounts[focusMonth] || 0;
        const previous = focusMonth > 0 ? row.amounts[focusMonth - 1] || 0 : 0;
        const activeMonths = row.amounts.filter((value) => value > 0).length;
        return {
          key: row.id,
          name: row.name,
          focus,
          previous,
          total: row.yearTotal,
          activeMonths,
          isArchived: row.isArchived,
        };
      })
      .filter((row) => row.focus > 0 || row.total > 0)
      .sort((a, b) => b.focus - a.focus || b.total - a.total)
      .slice(0, 8);
  }, [data.fixedRows, focusMonth]);

  if (focusMonth == null) return <EmptyState label="No fixed expense data" />;
  if (rows.length === 0) return <EmptyState label="No fixed expense data" />;

  return (
    <div className="overflow-x-auto">
      <table className="analytics-breakdown-table">
        <thead>
          <tr>
            <th>Fixed item</th>
            <th>Focus</th>
            <th>Previous</th>
            <th>Delta</th>
            <th>Year total</th>
            <th>Active months</th>
          </tr>
        </thead>
        <tbody className="text-theme-text text-sm">
          {rows.map((row) => {
            const delta = row.focus - row.previous;
            return (
              <tr key={row.key}>
                <td className="font-semibold text-theme-text">
                  <div className="flex items-center gap-2">
                    <span>{row.name}</span>
                    {row.isArchived && (
                      <span className="rounded-full border border-theme-border px-1.5 py-0.5 text-[0.625rem] text-theme-muted">
                        Archived
                      </span>
                    )}
                  </div>
                </td>
                <td className="tabular-nums">{fmtFull(row.focus)}</td>
                <td className="tabular-nums">{fmtFull(row.previous)}</td>
                <td
                  className={cn(
                    "tabular-nums",
                    delta === 0
                      ? "text-theme-muted"
                      : delta > 0
                        ? "text-theme-danger"
                        : "text-theme-success",
                  )}
                >
                  {fmtChange(delta)}
                </td>
                <td className="tabular-nums">{fmtFull(row.total)}</td>
                <td className="tabular-nums">{row.activeMonths}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── 2. Category Breakdown ────────────────────────────────────────────────────

interface CategoryBreakdownChartProps extends ChartProps {
  selectedMonth: number | null;
}

export const CategoryBreakdownChart = ({
  data,
  colors,
  monthCount,
  selectedMonth,
}: CategoryBreakdownChartProps) => {
  const pieData = useMemo(() => {
    const items: { name: string; value: number }[] = [];
    if (selectedMonth === null) {
      const fixedTotal = sliceMonths(
        data.monthlyFixedTotals,
        monthCount,
      ).reduce<number>((s, v) => s + (v || 0), 0);
      if (fixedTotal > 0) {
        items.push({ name: "Fixed Expenses", value: fixedTotal });
      }
      (data.variableRows || []).forEach((row) => {
        const total = sliceMonths(row.amounts, monthCount).reduce<number>(
          (s, v) => s + (v || 0),
          0,
        );
        if (total > 0) items.push({ name: row.name, value: total });
      });
      const savingsTotal = sliceMonths(
        data.monthlyTotalSavings,
        monthCount,
      ).reduce<number>((s, v) => s + (v || 0), 0);
      if (savingsTotal > 0) {
        items.push({ name: "Total Savings", value: savingsTotal });
      }
    } else {
      const m = selectedMonth;
      const fixedTotal = data.monthlyFixedTotals[m] || 0;
      if (fixedTotal > 0) {
        items.push({ name: "Fixed Expenses", value: fixedTotal });
      }
      (data.variableRows || []).forEach((row) => {
        const val = row.amounts?.[m] || 0;
        if (val > 0) items.push({ name: row.name, value: val });
      });
      const savingsTotal = data.monthlyTotalSavings[m] || 0;
      if (savingsTotal > 0) {
        items.push({ name: "Total Savings", value: savingsTotal });
      }
    }
    return items;
  }, [data, monthCount, selectedMonth]);

  const emptyLabel =
    selectedMonth === null
      ? "No category data"
      : `No data for ${MONTHS[selectedMonth]}`;
  if (pieData.length === 0) return <EmptyState label={emptyLabel} />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
        >
          {pieData.map((entry, i) => (
            <Cell
              key={i}
              fill={
                /saving/i.test(entry.name)
                  ? colors.success
                  : /fixed/i.test(entry.name)
                    ? colors.primary
                    : getCategoryColor(entry.name)
              }
            />
          ))}
        </Pie>
        <Tooltip
          content={
            <CustomTooltip
              colors={colors}
              formatter={(v: number, name: string) => [fmtCompact(v), name]}
            />
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

// ── 2b. Payee Breakdown ──────────────────────────────────────────────────────

export const PayeeBreakdownChart = ({
  data,
  colors,
  monthCount,
  selectedMonth,
}: CategoryBreakdownChartProps) => {
  const pieData = useMemo(() => {
    const rows = data.payeeRows ?? [];
    if (selectedMonth === null) {
      return rows
        .map((row) => ({
          name: row.name,
          value: sliceMonths(row.amounts, monthCount).reduce<number>(
            (s, v) => s + (v || 0),
            0,
          ),
        }))
        .filter((d) => d.value > 0);
    }
    return rows
      .map((row) => ({
        name: row.name,
        value: row.amounts?.[selectedMonth] || 0,
      }))
      .filter((d) => d.value > 0);
  }, [data.payeeRows, monthCount, selectedMonth]);

  const emptyLabel =
    selectedMonth === null
      ? "No payee data"
      : `No payee data for ${MONTHS[selectedMonth]}`;
  if (pieData.length === 0) return <EmptyState label={emptyLabel} />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
        >
          {pieData.map((entry, i) => (
            <Cell key={i} fill={getCategoryColor(entry.name)} />
          ))}
        </Pie>
        <Tooltip
          content={
            <CustomTooltip
              colors={colors}
              formatter={(v: number, name: string) => [fmtCompact(v), name]}
            />
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

// ── 3. Savings Rate Trend ────────────────────────────────────────────────────

export const SavingsRateChart = ({ data, colors, monthCount }: ChartProps) => {
  const chartData = useMemo(() => {
    return MONTHS.slice(0, monthCount).map((m, i) => ({
      month: m,
      rate: data.monthlySavingsPct[i] || 0,
    }));
  }, [data, monthCount]);

  const hasData = chartData.some((d) => d.rate !== 0 && d.rate != null);
  if (!hasData) return <EmptyState label="No savings data" />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={colors.grid}
          opacity={0.5}
        />
        <XAxis
          dataKey="month"
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={{ stroke: colors.grid }}
        />
        <YAxis
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={{ stroke: colors.grid }}
          tickFormatter={fmtPct}
          domain={[0, "auto"]}
        />
        <Tooltip
          content={
            <CustomTooltip
              colors={colors}
              formatter={(v: number) => [fmtPct(v), "Savings Rate"]}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke={colors.primary}
          strokeWidth={2}
          dot={{ r: 3, fill: colors.primary }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── 4. Monthly Total Savings ─────────────────────────────────────────────────

export const MonthlyTotalSavingsChart = ({
  data,
  colors,
  monthCount,
}: ChartProps) => {
  const chartData = useMemo(() => {
    return MONTHS.slice(0, monthCount).map((m, i) => ({
      month: m,
      savings: data.monthlyTotalSavings[i] || 0,
    }));
  }, [data, monthCount]);

  const hasData = chartData.some((d) => d.savings !== 0 && d.savings != null);
  if (!hasData) return <EmptyState label="No savings data" />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        barGap={2}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={colors.grid}
          opacity={0.5}
        />
        <XAxis
          dataKey="month"
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={{ stroke: colors.grid }}
        />
        <YAxis
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={{ stroke: colors.grid }}
          tickFormatter={fmtCompact}
        />
        <Tooltip
          content={
            <CustomTooltip
              colors={colors}
              formatter={(v: number) => [fmtCompact(v), "Total Savings"]}
            />
          }
        />
        <Bar dataKey="savings" radius={[3, 3, 0, 0]} maxBarSize={32}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.savings >= 0 ? colors.success : colors.danger}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Month View: Metric Cards ─────────────────────────────────────────────────

interface MonthMetricCardsProps {
  data: AnalyticsData;
  selectedMonth: number;
  colors: ThemeColors;
}

const MonthMetricCards = ({
  data,
  selectedMonth,
  colors,
}: MonthMetricCardsProps) => {
  const m = selectedMonth;
  const expenses = data.monthlyTotals[m] || 0;
  const income = data.monthlyIncome[m] || 0;
  const savingsRate = data.monthlySavingsPct[m] || 0;
  const totalSavings = data.monthlyTotalSavings[m] || 0;
  const remaining = data.monthlyRemaining[m] || 0;

  const savingsLabel = totalSavings >= 0 ? "Total Savings" : "Net Loss";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard
        label="Total Expenses"
        value={fmtFull(expenses)}
        accentColor={colors.danger}
        colors={colors}
      />
      <MetricCard
        label="Total Income"
        value={fmtFull(income)}
        accentColor={colors.success}
        colors={colors}
      />
      <MetricCard
        label="Savings Rate"
        value={fmtPct(savingsRate)}
        accentColor={colors.primary}
        colors={colors}
      />
      <MetricCard
        label={savingsLabel}
        value={fmtFull(Math.abs(totalSavings))}
        subValue={
          remaining !== 0 ? `Remaining: ${fmtCompact(remaining)}` : undefined
        }
        accentColor={totalSavings >= 0 ? colors.success : colors.danger}
        colors={colors}
      />
    </div>
  );
};

// ── 5. Ranked Category Viz — bar list with delta ─────────────────────────────

export const RankedCategoryViz = ({
  data,
  focusMonth,
  colors,
  formatAmount,
}: {
  data: AnalyticsData;
  focusMonth: number | null;
  colors: ThemeColors;
  formatAmount: (n: number) => string;
}) => {
  const rows = useMemo(() => {
    if (focusMonth == null) {
      // Year view — aggregate using yearTotal across all months
      const yearVariableTotal = (data.variableRows || []).reduce(
        (s, r) => s + r.yearTotal,
        0,
      );
      return (data.variableRows || [])
        .filter((row) => row.yearTotal > 0)
        .map((row) => ({
          key: row.key,
          name: row.name,
          focus: row.yearTotal,
          previous: 0,
          total: row.yearTotal,
          share:
            yearVariableTotal > 0
              ? (row.yearTotal / yearVariableTotal) * 100
              : 0,
          delta: 0,
        }))
        .sort((a, b) => b.focus - a.focus)
        .slice(0, 8);
    }
    // Month view — existing logic unchanged
    const focusTotal = data.monthlyVariableTotals[focusMonth] || 0;
    return (data.variableRows || [])
      .map((row) => {
        const focus = row.amounts[focusMonth] || 0;
        const previous = focusMonth > 0 ? row.amounts[focusMonth - 1] || 0 : 0;
        return {
          key: row.key,
          name: row.name,
          focus,
          previous,
          total: row.yearTotal,
          share: focusTotal > 0 ? (focus / focusTotal) * 100 : 0,
          delta: focus - previous,
        };
      })
      .filter((row) => row.focus > 0 || row.total > 0)
      .sort((a, b) => b.focus - a.focus || b.total - a.total)
      .slice(0, 8);
  }, [data.variableRows, data.monthlyVariableTotals, focusMonth]);

  if (rows.length === 0) return <EmptyState label="No category data" />;

  const maxAmount = rows[0]?.focus ?? 0;

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const barWidth = maxAmount > 0 ? (row.focus / maxAmount) * 100 : 0;
        const color = getCategoryColor(row.name);
        const hasDelta = row.previous > 0;
        const deltaPositive = row.delta > 0;

        return (
          <div key={row.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-theme-text truncate">
                  {row.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasDelta && row.delta !== 0 && (
                  <span
                    className="text-[0.6875rem] font-medium tabular-nums"
                    style={{
                      color: deltaPositive ? colors.danger : colors.success,
                    }}
                  >
                    {deltaPositive ? "+" : "−"}
                    {formatAmount(Math.abs(row.delta))}
                  </span>
                )}
                <span className="text-xs text-theme-muted tabular-nums w-8 text-right">
                  {row.share.toFixed(0)}%
                </span>
                <span className="text-sm font-medium text-theme-text tabular-nums w-20 text-right">
                  {formatAmount(row.focus)}
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-theme-background overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barWidth}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── 6. Ranked Payee Viz — bar list with delta ────────────────────────────────

export const RankedPayeeViz = ({
  data,
  focusMonth,
  colors,
  formatAmount,
}: {
  data: AnalyticsData;
  focusMonth: number | null;
  colors: ThemeColors;
  formatAmount: (n: number) => string;
}) => {
  const rows = useMemo(() => {
    if (focusMonth == null) {
      // Year view — aggregate using yearTotal across all months
      const yearPayeeTotal = (data.payeeRows || []).reduce(
        (s, r) => s + r.yearTotal,
        0,
      );
      return (data.payeeRows || [])
        .filter((row) => row.yearTotal > 0)
        .map((row) => ({
          key: row.key,
          name: row.name,
          focus: row.yearTotal,
          previous: 0,
          total: row.yearTotal,
          share:
            yearPayeeTotal > 0 ? (row.yearTotal / yearPayeeTotal) * 100 : 0,
          delta: 0,
        }))
        .sort((a, b) => b.focus - a.focus)
        .slice(0, 8);
    }
    // Month view — existing logic unchanged
    const focusTotal = data.payeeRows.reduce(
      (sum, row) => sum + (row.amounts[focusMonth] || 0),
      0,
    );
    return (data.payeeRows || [])
      .map((row) => {
        const focus = row.amounts[focusMonth] || 0;
        const previous = focusMonth > 0 ? row.amounts[focusMonth - 1] || 0 : 0;
        return {
          key: row.key,
          name: row.name,
          focus,
          previous,
          total: row.yearTotal,
          share: focusTotal > 0 ? (focus / focusTotal) * 100 : 0,
          delta: focus - previous,
        };
      })
      .filter((row) => row.focus > 0 || row.total > 0)
      .sort((a, b) => b.focus - a.focus || b.total - a.total)
      .slice(0, 8);
  }, [data.payeeRows, focusMonth]);

  if (rows.length === 0) return <EmptyState label="No payee data" />;

  const maxAmount = rows[0]?.focus ?? 0;

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const barWidth = maxAmount > 0 ? (row.focus / maxAmount) * 100 : 0;
        const hasDelta = row.previous > 0;
        const deltaPositive = row.delta > 0;

        return (
          <div key={row.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-theme-primary" />
                <span className="text-sm text-theme-text truncate">
                  {row.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasDelta && row.delta !== 0 && (
                  <span
                    className="text-[0.6875rem] font-medium tabular-nums"
                    style={{
                      color: deltaPositive ? colors.danger : colors.success,
                    }}
                  >
                    {deltaPositive ? "+" : "−"}
                    {formatAmount(Math.abs(row.delta))}
                  </span>
                )}
                <span className="text-xs text-theme-muted tabular-nums w-8 text-right">
                  {row.share.toFixed(0)}%
                </span>
                <span className="text-sm font-medium text-theme-text tabular-nums w-20 text-right">
                  {formatAmount(row.focus)}
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-theme-background overflow-hidden">
              <div
                className="h-full rounded-full bg-theme-primary transition-all duration-500"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ label }: { label: string }) => {
  return (
    <div className="h-[200px] md:h-[260px] flex items-center justify-center">
      <span className="text-xs text-theme-muted">{label}</span>
    </div>
  );
};

// ── Chart Card Wrapper ───────────────────────────────────────────────────────

const ChartCard = ({
  title,
  headerAction,
  children,
}: {
  title: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <div className="rounded-theme-large bg-theme-surface shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-theme-text">{title}</h3>
        {headerAction}
      </div>
      {children}
    </div>
  );
};

export const ViewToggle = ({
  isViz,
  onToggle,
}: {
  isViz: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="flex items-center gap-1 rounded-theme-small border border-theme-border px-2 py-1 text-[0.6875rem] font-medium text-theme-muted hover:text-theme-text hover:border-theme-text transition-colors"
    aria-label={isViz ? "Switch to table view" : "Switch to chart view"}
  >
    {isViz ? (
      <>
        <svg
          className="w-3 h-3"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="1" y="1" width="14" height="14" rx="1" />
          <line x1="1" y1="5" x2="15" y2="5" />
          <line x1="1" y1="9" x2="15" y2="9" />
          <line x1="1" y1="13" x2="15" y2="13" />
          <line x1="5" y1="1" x2="5" y2="15" />
        </svg>
        Table
      </>
    ) : (
      <>
        <svg
          className="w-3 h-3"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="1" y="6" width="3" height="9" />
          <rect x="6" y="3" width="3" height="12" />
          <rect x="11" y="1" width="3" height="14" />
        </svg>
        Chart
      </>
    )}
  </button>
);

// ── Year View Layout ─────────────────────────────────────────────────────────

interface ViewProps {
  data: AnalyticsData;
  colors: ThemeColors;
  monthCount: number;
  formatAmount: (n: number) => string;
}

const YearView = ({ data, colors, monthCount, formatAmount }: ViewProps) => {
  const [trendViz, setTrendViz] = useState(true);
  const [catViz, setCatViz] = useState(true);
  const [payeeViz, setPayeeViz] = useState(true);

  return (
    <div className="space-y-4">
      {/* Row 1: Monthly Spending (stacked bar + income line, toggles to table) */}
      <ChartCard
        title="Monthly Spending"
        headerAction={
          <ViewToggle isViz={trendViz} onToggle={() => setTrendViz((v) => !v)} />
        }
      >
        {trendViz ? (
          <MonthlyStackedChart data={data} colors={colors} monthCount={monthCount} />
        ) : (
          <MonthlyComparisonTable data={data} monthCount={monthCount} />
        )}
      </ChartCard>

      {/* Row 2: Category movement + Payee concentration (2-col on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="Category Movement"
          headerAction={
            <ViewToggle isViz={catViz} onToggle={() => setCatViz((v) => !v)} />
          }
        >
          {catViz ? (
            <RankedCategoryViz data={data} focusMonth={null} colors={colors} formatAmount={formatAmount} />
          ) : (
            <RankedCategoryTable data={data} focusMonth={null} focusLabel="Year total" />
          )}
        </ChartCard>
        <ChartCard
          title="Payee Concentration"
          headerAction={
            <ViewToggle isViz={payeeViz} onToggle={() => setPayeeViz((v) => !v)} />
          }
        >
          {payeeViz ? (
            <RankedPayeeViz data={data} focusMonth={null} colors={colors} formatAmount={formatAmount} />
          ) : (
            <RankedPayeeTable data={data} focusMonth={null} focusLabel="Year total" />
          )}
        </ChartCard>
      </div>
    </div>
  );
};

// ── Month View Layout ────────────────────────────────────────────────────────

interface MonthViewProps {
  data: AnalyticsData;
  multiYearData: AnalyticsData[];
  colors: ThemeColors;
  selectedMonth: number;
  formatAmount: (n: number) => string;
}

const MonthView = ({
  data,
  multiYearData,
  colors,
  selectedMonth,
  formatAmount,
}: MonthViewProps) => {
  const [catViz, setCatViz] = useState(true);
  const [payeeViz, setPayeeViz] = useState(true);

  return (
    <div className="space-y-4">
      {/* Year over Year */}
      <ChartCard title={`${MONTHS[selectedMonth]} Year over Year`}>
        <YearOverYearChart
          multiYearData={multiYearData}
          selectedMonth={selectedMonth}
          colors={colors}
          monthLabel={MONTHS[selectedMonth]}
        />
      </ChartCard>

      {/* Category movement + payee concentration (2-col on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title={`${MONTHS[selectedMonth]} Category Movement`}
          headerAction={
            <ViewToggle isViz={catViz} onToggle={() => setCatViz((v) => !v)} />
          }
        >
          {catViz ? (
            <RankedCategoryViz
              data={data}
              focusMonth={selectedMonth}
              colors={colors}
              formatAmount={formatAmount}
            />
          ) : (
            <RankedCategoryTable
              data={data}
              focusMonth={selectedMonth}
              focusLabel={`${MONTHS[selectedMonth]} focus`}
            />
          )}
        </ChartCard>
        <ChartCard
          title={`${MONTHS[selectedMonth]} Payee Concentration`}
          headerAction={
            <ViewToggle
              isViz={payeeViz}
              onToggle={() => setPayeeViz((v) => !v)}
            />
          }
        >
          {payeeViz ? (
            <RankedPayeeViz
              data={data}
              focusMonth={selectedMonth}
              colors={colors}
              formatAmount={formatAmount}
            />
          ) : (
            <RankedPayeeTable
              data={data}
              focusMonth={selectedMonth}
              focusLabel={`${MONTHS[selectedMonth]} focus`}
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

interface AnalyticsChartsProps {
  data: AnalyticsData;
  multiYearData: AnalyticsData[];
  year: number;
  currentYear: number;
  currentMonth: number;
  selectedMonth: number | null;
}

export default function AnalyticsCharts({
  data,
  multiYearData,
  year,
  currentYear,
  currentMonth,
  selectedMonth,
}: AnalyticsChartsProps) {
  const colors = useThemeColors();
  const { formatAmount } = useSettings();
  const monthCount = getMonthCount(year, currentYear, currentMonth);

  return (
    <div className="space-y-4 p-4 md:p-5">
      {selectedMonth === null ? (
        <YearView
          data={data}
          colors={colors}
          monthCount={monthCount}
          formatAmount={formatAmount}
        />
      ) : (
        <MonthView
          data={data}
          multiYearData={multiYearData}
          colors={colors}
          selectedMonth={selectedMonth}
          formatAmount={formatAmount}
        />
      )}
    </div>
  );
}
