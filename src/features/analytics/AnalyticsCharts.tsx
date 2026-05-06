import { useMemo } from "react";
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

function useThemeColors(): ThemeColors {
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
      className="rounded-theme-large border p-4 text-center"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.grid,
      }}
    >
      <div className="text-xs font-medium mb-1" style={{ color: colors.muted }}>
        {label}
      </div>
      <div
        className="text-xl font-bold"
        style={{ color: accentColor || colors.text }}
      >
        {value}
      </div>
      {subValue && (
        <div
          className="text-[0.6875rem] mt-0.5"
          style={{ color: colors.muted }}
        >
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

const MonthlyTrendChart = ({ data, colors, monthCount }: ChartProps) => {
  const chartData = useMemo(() => {
    return MONTHS.slice(0, monthCount).map((m, i) => ({
      month: m,
      total: data.monthlyTotals[i] || 0,
      savings: data.monthlyTotalSavings[i] || 0,
    }));
  }, [data, monthCount]);

  const hasData = chartData.some((d) => d.total > 0);
  if (!hasData) return <EmptyState label="No spending data" />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
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
              formatter={(v: number, name: string) => [
                fmtCompact(v),
                name === "total" ? "Total Expenses" : "Total Savings",
              ]}
            />
          }
        />
        <Legend
          wrapperStyle={{ fontSize: "12px", color: colors.text }}
          formatter={(v: string) =>
            v === "total" ? "Total Expenses" : "Total Savings"
          }
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke={colors.primary}
          strokeWidth={2}
          fill="url(#trendGrad)"
          dot={{ r: 3, fill: colors.primary }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="savings"
          stroke={colors.success}
          strokeWidth={2}
          dot={{ r: 3, fill: colors.success }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
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

const RankedCategoryTable = ({
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

const RankedPayeeTable = ({
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

// ── 5. Income vs. Expenses ───────────────────────────────────────────────────

const IncomeVsExpensesChart = ({
  data,
  colors,
  monthCount,
  selectedMonth,
}: CategoryBreakdownChartProps) => {
  const chartData = useMemo(() => {
    if (selectedMonth !== null) {
      const m = selectedMonth;
      return [
        {
          month: MONTHS[m],
          income: data.monthlyIncome[m] || 0,
          expenses: data.monthlyTotals[m] || 0,
        },
      ];
    }
    return MONTHS.slice(0, monthCount).map((m, i) => ({
      month: m,
      income: data.monthlyIncome[i] || 0,
      expenses: data.monthlyTotals[i] || 0,
    }));
  }, [data, monthCount, selectedMonth]);

  const hasData = chartData.some((d) => d.income > 0 || d.expenses > 0);
  if (!hasData) return <EmptyState label="No income/expense data" />;

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
              formatter={(v: number, name: string) => [
                fmtCompact(v),
                name === "income" ? "Income" : "Expenses",
              ]}
            />
          }
        />
        <Legend
          wrapperStyle={{ fontSize: "12px", color: colors.text }}
          formatter={(v: string) => (v === "income" ? "Income" : "Expenses")}
        />
        <Bar
          dataKey="income"
          fill={colors.success}
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
        />
        <Bar
          dataKey="expenses"
          fill={colors.danger}
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
        />
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="rounded-theme-large bg-theme-surface shadow-sm p-4">
      <h3 className="text-sm font-semibold text-theme-text mb-3">{title}</h3>
      {children}
    </div>
  );
};

// ── Year View Layout ─────────────────────────────────────────────────────────

interface ViewProps {
  data: AnalyticsData;
  colors: ThemeColors;
  monthCount: number;
}

const YearView = ({ data, colors, monthCount }: ViewProps) => {
  return (
    <div className="space-y-4">
      {/* Row 1: Monthly Trend (full width) */}
      <ChartCard title="Monthly Spending Trend">
        <MonthlyTrendChart
          data={data}
          colors={colors}
          monthCount={monthCount}
        />
      </ChartCard>

      {/* Row 2: Monthly comparison + category movement (2-col on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Monthly Comparison">
          <MonthlyComparisonTable data={data} monthCount={monthCount} />
        </ChartCard>
        <ChartCard title="Category Movement">
          <RankedCategoryTable
            data={data}
            focusMonth={getFocusMonthIndex(monthCount, null)}
            focusLabel="Latest visible month"
          />
        </ChartCard>
      </div>

      {/* Row 3: Payee concentration + savings health (2-col on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Payee Concentration">
          <RankedPayeeTable
            data={data}
            focusMonth={getFocusMonthIndex(monthCount, null)}
            focusLabel="Latest visible month"
          />
        </ChartCard>
        <ChartCard title="Savings and Budget Health">
          <SavingsHealthTable
            data={data}
            monthCount={monthCount}
            selectedMonth={null}
          />
        </ChartCard>
      </div>

      {/* Row 4: Fixed expense stability (full width) */}
      <ChartCard title="Fixed Expense Stability">
        <FixedStabilityTable
          data={data}
          monthCount={monthCount}
          selectedMonth={null}
        />
      </ChartCard>
    </div>
  );
};

// ── Month View Layout ────────────────────────────────────────────────────────

interface MonthViewProps {
  data: AnalyticsData;
  multiYearData: AnalyticsData[];
  colors: ThemeColors;
  selectedMonth: number;
}

const MonthView = ({
  data,
  multiYearData,
  colors,
  selectedMonth,
}: MonthViewProps) => {
  return (
    <div className="space-y-4">
      {/* Row 1: Metric cards */}
      <MonthMetricCards
        data={data}
        selectedMonth={selectedMonth}
        colors={colors}
      />

      {/* Row 2: Income vs. Expenses */}
      <ChartCard title={`${MONTHS[selectedMonth]} Income vs. Expenses`}>
        <IncomeVsExpensesChart
          data={data}
          colors={colors}
          monthCount={0}
          selectedMonth={selectedMonth}
        />
      </ChartCard>

      {/* Row 3: Year over Year */}
      <ChartCard title={`${MONTHS[selectedMonth]} Year over Year`}>
        <YearOverYearChart
          multiYearData={multiYearData}
          selectedMonth={selectedMonth}
          colors={colors}
          monthLabel={MONTHS[selectedMonth]}
        />
      </ChartCard>

      {/* Row 4: Category movement + payee concentration (2-col on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title={`${MONTHS[selectedMonth]} Category Movement`}>
          <RankedCategoryTable
            data={data}
            focusMonth={selectedMonth}
            focusLabel={`${MONTHS[selectedMonth]} focus`}
          />
        </ChartCard>
        <ChartCard title={`${MONTHS[selectedMonth]} Payee Concentration`}>
          <RankedPayeeTable
            data={data}
            focusMonth={selectedMonth}
            focusLabel={`${MONTHS[selectedMonth]} focus`}
          />
        </ChartCard>
      </div>

      {/* Row 5: Savings health + fixed stability (2-col on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title={`${MONTHS[selectedMonth]} Savings and Budget Health`}>
          <SavingsHealthTable
            data={data}
            monthCount={0}
            selectedMonth={selectedMonth}
          />
        </ChartCard>
        <ChartCard title={`${MONTHS[selectedMonth]} Fixed Expense Stability`}>
          <FixedStabilityTable
            data={data}
            monthCount={0}
            selectedMonth={selectedMonth}
          />
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
  const monthCount = getMonthCount(year, currentYear, currentMonth);

  return (
    <div className="space-y-4 p-4 md:p-5">
      {selectedMonth === null ? (
        <YearView data={data} colors={colors} monthCount={monthCount} />
      ) : (
        <MonthView
          data={data}
          multiYearData={multiYearData}
          colors={colors}
          selectedMonth={selectedMonth}
        />
      )}
    </div>
  );
}
