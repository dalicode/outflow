import { useMemo, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { YearTrendRow } from "../../../utils/analyticsTrendUtils";
import type { ThemeColors } from "../AnalyticsCharts";

interface IncomeTrendYearChartProps {
  rows: YearTrendRow[];
  selectedMonth: number | null;
  onSelectMonth: (monthIndex: number | null) => void;
  colors: ThemeColors;
  formatAmount: (n: number) => string;
}

interface TooltipPayloadItem {
  value: number;
  name: string;
  color: string;
}

interface IncomeTrendTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  colors: ThemeColors;
  formatAmount: (n: number) => string;
}

const IncomeTrendTooltip = ({
  active,
  payload,
  label,
  colors,
  formatAmount,
}: IncomeTrendTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const value = payload[0]?.value;

  return (
    <div
      className="rounded-theme-medium border shadow-lg px-3 py-2 text-xs min-w-[180px]"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.grid,
        color: colors.text,
      }}
    >
      {label && (
        <div className="font-semibold mb-1.5" style={{ color: colors.text }}>
          {label}
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: payload[0]?.color }}
          />
          <span style={{ color: colors.muted }}>Net remaining</span>
        </div>
        <span
          className="font-medium tabular-nums"
          style={{
            color: value != null && value < 0 ? colors.danger : colors.success,
          }}
        >
          {value != null ? formatAmount(value) : "—"}
        </span>
      </div>
      <div
        className="mt-1 text-[0.625rem]"
        style={{ color: colors.muted }}
      >
        Cumulative all-time
      </div>
    </div>
  );
};

export default function IncomeTrendYearChart({
  rows,
  selectedMonth,
  onSelectMonth,
  colors,
  formatAmount,
}: IncomeTrendYearChartProps) {
  const chartData = useMemo(
    () =>
      rows.map((row) => ({
        month: row.monthLabel,
        cumulativeRemaining: row.cumulativeRemaining,
        monthIndex: row.monthIndex,
        hasData: row.hasData,
      })),
    [rows],
  );

  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
  const lineColor =
    lastRow && lastRow.cumulativeRemaining < 0 ? colors.danger : colors.success;

  const handleChartClick = useCallback(
    (chartState: {
      activePayload?: Array<{ payload: { monthIndex: number } }>;
    }) => {
      if (!chartState?.activePayload?.length) return;
      const clickedIndex = chartState.activePayload[0].payload.monthIndex;
      onSelectMonth(selectedMonth === clickedIndex ? null : clickedIndex);
    },
    [selectedMonth, onSelectMonth],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderDot = useCallback(
    (props: any) => {
      const { cx, cy, payload } = props;
      const isSelected = payload.monthIndex === selectedMonth;
      const hasData = payload.hasData;

      if (!hasData) {
        return (
          <circle
            key={`dot-${payload.monthIndex}`}
            cx={cx}
            cy={cy}
            r={3}
            fill={colors.background}
            stroke={lineColor}
            strokeWidth={1.5}
            opacity={0.4}
          />
        );
      }

      return (
        <circle
          key={`dot-${payload.monthIndex}`}
          cx={cx}
          cy={cy}
          r={isSelected ? 6 : 3}
          fill={lineColor}
          stroke={colors.background}
          strokeWidth={isSelected ? 2 : 0}
          style={{ cursor: "pointer" }}
        />
      );
    },
    [selectedMonth, lineColor, colors.background],
  );

  const yAxisFormatter = useCallback(
    (v: number) => {
      if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
      if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`;
      return `$${v}`;
    },
    [],
  );

  if (rows.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center">
        <span className="text-xs text-theme-muted">No data for this year</span>
      </div>
    );
  }

  if (rows.length === 1) {
    const row = rows[0];
    return (
      <div className="flex flex-col items-center justify-center h-[260px] gap-2">
        <div
          className="text-2xl font-bold tabular-nums"
          style={{
            color: row.cumulativeRemaining < 0 ? colors.danger : colors.success,
          }}
        >
          {formatAmount(row.cumulativeRemaining)}
        </div>
        <div className="text-xs" style={{ color: colors.muted }}>
          Net remaining after {row.monthLabel}
        </div>
        <div className="text-[0.625rem]" style={{ color: colors.muted }}>
          Add more months to see the trend
        </div>
      </div>
    );
  }

  return (
    <div aria-label="Cumulative net remaining chart showing all-time financial surplus or deficit by month">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          onClick={handleChartClick}
          style={{ cursor: "pointer" }}
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
            tickFormatter={yAxisFormatter}
          />
          <Tooltip
            content={
              <IncomeTrendTooltip
                colors={colors}
                formatAmount={formatAmount}
              />
            }
          />
          <ReferenceLine
            y={0}
            stroke={colors.grid}
            strokeDasharray="4 2"
            strokeWidth={1.5}
          />
          <Line
            type="monotone"
            dataKey="cumulativeRemaining"
            name="Net remaining"
            stroke={lineColor}
            strokeWidth={2.5}
            dot={renderDot}
            activeDot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="sr-only" aria-live="polite">
        {selectedMonth !== null && rows[selectedMonth]
          ? `Selected: ${rows[selectedMonth].monthLabel}, cumulative net remaining: ${formatAmount(rows[selectedMonth].cumulativeRemaining)}`
          : "No month selected"}
      </div>

      <label className="sr-only" htmlFor="income-trend-month-select">
        Select month to preview
      </label>
      <select
        id="income-trend-month-select"
        className="sr-only"
        value={selectedMonth ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          onSelectMonth(val === "" ? null : parseInt(val, 10));
        }}
        aria-label="Select month to preview"
      >
        <option value="">No month selected</option>
        {rows.map((row) => (
          <option key={row.monthIndex} value={row.monthIndex}>
            {row.monthLabel} — {formatAmount(row.cumulativeRemaining)} cumulative
          </option>
        ))}
      </select>
    </div>
  );
}
