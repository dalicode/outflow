import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { AnalyticsData } from "../../types";
import type { ThemeColors } from "./AnalyticsCharts";
import { fmtCompact, fmtFull, fmtDelta } from "../../utils/analyticsFormatting";



// ── Types ────────────────────────────────────────────────────────────────────

interface YearPoint {
  label: string;
  year: number;
  savings: number;
  expenses: number;
  savingsDelta: number | null;
  expensesDelta: number | null;
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string; payload: YearPoint }>;
  colors: ThemeColors;
}

const YoYTooltip = ({ active, payload, colors }: TooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;

  return (
    <div
      className="rounded-theme-medium border shadow-lg px-3 py-2.5 text-xs min-w-[190px]"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.grid,
        color: colors.text,
      }}
    >
      <div className="font-semibold mb-2" style={{ color: colors.text }}>
        {pt.label}
      </div>

      <div className="flex items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors.success }} />
          <span style={{ color: colors.muted }}>Total Saved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-medium tabular-nums" style={{ color: colors.success }}>
            {fmtFull(pt.savings)}
          </span>
          {pt.savingsDelta != null && (
            <span
              className="tabular-nums text-[0.625rem]"
              style={{ color: pt.savingsDelta >= 0 ? colors.success : colors.danger }}
            >
              {fmtDelta(pt.savingsDelta)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors.danger }} />
          <span style={{ color: colors.muted }}>Expenses</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-medium tabular-nums" style={{ color: pt.expenses < 0 ? colors.success : colors.danger }}>
            {fmtFull(pt.expenses)}
          </span>
          {pt.expensesDelta != null && (
            <span
              className="tabular-nums text-[0.625rem]"
              style={{ color: pt.expensesDelta <= 0 ? colors.success : colors.danger }}
            >
              {fmtDelta(pt.expensesDelta)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

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
  const points = useMemo<YearPoint[]>(() => {
    const raw = multiYearData
      .filter((d) => !d.loading)
      .map((d) => ({
        year: d.year,
        savings: d.monthlyTotalSavings[selectedMonth] ?? 0,
        expenses: d.monthlyTotals[selectedMonth] ?? 0,
      }))
      .filter((d) => d.savings !== 0 || d.expenses !== 0)
      .sort((a, b) => a.year - b.year);

    return raw.map((d, i) => ({
      label: `${monthLabel} ${d.year}`,
      year: d.year,
      savings: d.savings,
      expenses: d.expenses,
      savingsDelta: i === 0 ? null : d.savings - raw[i - 1].savings,
      expensesDelta: i === 0 ? null : d.expenses - raw[i - 1].expenses,
    }));
  }, [multiYearData, selectedMonth, monthLabel]);

  const isLoading = multiYearData.some((d) => d.loading);

  if (isLoading) {
    return (
      <div className="h-[260px] flex items-center justify-center">
        <span className="text-xs text-theme-muted">Loading…</span>
      </div>
    );
  }

  if (points.length < 2) {
    return (
      <div className="h-[260px] flex items-center justify-center">
        <span className="text-xs text-theme-muted">
          Need data from at least 2 years to compare
        </span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={points}
        margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
        barCategoryGap="25%"
        barGap={4}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.5} vertical={false} />

        <XAxis
          dataKey="label"
          tick={{ fill: colors.muted, fontSize: 11 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
        />

        <YAxis
          tick={{ fill: colors.muted, fontSize: 11 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          tickFormatter={fmtCompact}
        />

        <Tooltip content={<YoYTooltip colors={colors} />} cursor={{ fill: colors.grid, opacity: 0.15 }} />

        <Legend
          verticalAlign="top"
          align="right"
          wrapperStyle={{ fontSize: "11px", paddingBottom: "6px" }}
          formatter={(value) => (value === "savings" ? "Total Saved" : "Expenses")}
        />

        {/* Savings bars */}
        <Bar dataKey="savings" name="savings" maxBarSize={40} radius={[3, 3, 0, 0]}>
          {points.map((_pt, i) => (
            <Cell key={i} fill={colors.success} fillOpacity={0.85} />
          ))}
          <LabelList
            content={(props) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { x, y, width, index } = props as any;
              const pt = points[index as number];
              if (!pt || pt.savingsDelta == null) return null;
              const isPos = pt.savingsDelta >= 0;
              return (
                <text
                  x={(x as number) + (width as number) / 2}
                  y={(y as number) - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isPos ? colors.success : colors.danger}
                >
                  {fmtDelta(pt.savingsDelta)}
                </text>
              );
            }}
          />
        </Bar>

        {/* Expenses bars */}
        <Bar dataKey="expenses" name="expenses" maxBarSize={40} radius={[3, 3, 0, 0]}>
          {points.map((_pt, i) => (
            <Cell key={i} fill={colors.danger} fillOpacity={0.75} />
          ))}
          <LabelList
            content={(props) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { x, y, width, index } = props as any;
              const pt = points[index as number];
              if (!pt || pt.expensesDelta == null) return null;
              const isIncrease = pt.expensesDelta > 0;
              return (
                <text
                  x={(x as number) + (width as number) / 2}
                  y={(y as number) - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isIncrease ? colors.danger : colors.success}
                >
                  {fmtDelta(pt.expensesDelta)}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
