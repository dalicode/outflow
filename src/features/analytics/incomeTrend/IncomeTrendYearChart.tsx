import { useMemo, useCallback } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import type { YearTrendRow } from "../../../utils/analyticsTrendUtils";
import type { ThemeColors } from "../AnalyticsCharts";

interface IncomeTrendYearChartProps {
  rows: YearTrendRow[];
  priorRows?: YearTrendRow[] | null;
  priorYear?: number;
  selectedMonth: number | null;
  onSelectMonth: (monthIndex: number | null) => void;
  colors: ThemeColors;
  formatAmount: (n: number) => string;
}

interface TooltipPayloadItem {
  value: number;
  name: string;
  color: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
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

  const thisYearEntry = payload.find((p) => p.name === "thisYear");
  const monthlySavedEntry = payload.find((p) => p.name === "monthlySaved");
  const priorSavedEntry = payload.find((p) => p.name === "priorSaved");
  const deltaEntry = payload.find((p) => p.name === "savedDelta");

  const cumulativeValue: number | undefined = thisYearEntry?.value;
  const monthlySavedValue: number | undefined = monthlySavedEntry?.value;
  const priorSavedValue: number | undefined = priorSavedEntry?.value;
  const deltaValue: number | null = deltaEntry?.value ?? null;

  const row = thisYearEntry?.payload as {
    income?: number;
    expenses?: number;
    saved?: number;
    savingsRate?: number | null;
    priorSavedAmt?: number;
  } | undefined;

  const savedDelta =
    deltaValue != null ? deltaValue
    : monthlySavedValue != null && priorSavedValue != null
      ? monthlySavedValue - priorSavedValue
      : null;

  return (
    <div
      className="rounded-theme-medium border shadow-lg px-3 py-2 text-xs min-w-[200px]"
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

      {/* Cumulative cash flow */}
      {cumulativeValue != null && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: thisYearEntry?.color }}
            />
            <span style={{ color: colors.muted }}>Cumulative</span>
          </div>
          <span
            className="font-medium tabular-nums"
            style={{ color: cumulativeValue < 0 ? colors.danger : colors.success }}
          >
            {formatAmount(cumulativeValue)}
          </span>
        </div>
      )}

      {/* Monthly saved — this year vs prior year */}
      {(monthlySavedValue != null || priorSavedValue != null) && (
        <div
          className="mt-1.5 pt-1.5 space-y-0.5"
          style={{ borderTop: `1px solid ${colors.grid}` }}
        >
          {monthlySavedValue != null && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: monthlySavedEntry?.color }}
                />
                <span style={{ color: colors.muted }}>Saved this month</span>
              </div>
              <span
                className="font-medium tabular-nums"
                style={{ color: monthlySavedValue < 0 ? colors.danger : colors.success }}
              >
                {formatAmount(monthlySavedValue)}
              </span>
            </div>
          )}
          {priorSavedValue != null && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: priorSavedEntry?.color }}
                />
                <span style={{ color: colors.muted }}>Prior year</span>
              </div>
              <span
                className="font-medium tabular-nums"
                style={{ color: priorSavedValue < 0 ? colors.danger : colors.success }}
              >
                {formatAmount(priorSavedValue)}
              </span>
            </div>
          )}
          {savedDelta != null && (
            <div className="flex items-center justify-between gap-4 pt-0.5">
              <span style={{ color: colors.muted }}>vs last year</span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: savedDelta >= 0 ? colors.success : colors.danger }}
              >
                {savedDelta >= 0 ? "+" : "−"}{formatAmount(Math.abs(savedDelta))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* This month breakdown */}
      {row && (
        <div
          className="mt-1.5 pt-1.5 space-y-0.5"
          style={{ borderTop: `1px solid ${colors.grid}` }}
        >
          {row.income != null && row.income > 0 && (
            <div className="flex justify-between gap-4">
              <span style={{ color: colors.muted }}>Income</span>
              <span className="tabular-nums font-medium" style={{ color: colors.text }}>
                {formatAmount(row.income)}
              </span>
            </div>
          )}
          {row.savingsRate != null && (
            <div className="flex justify-between gap-4">
              <span style={{ color: colors.muted }}>Savings rate</span>
              <span className="tabular-nums font-medium" style={{ color: colors.text }}>
                {row.savingsRate.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function IncomeTrendYearChart({
  rows,
  priorRows,
  priorYear,
  selectedMonth,
  onSelectMonth,
  colors,
  formatAmount,
}: IncomeTrendYearChartProps) {
  // Merge this year and prior year data by month index
  const chartData = useMemo(() => {
    const priorByMonth = new Map(
      (priorRows ?? []).map((r) => [r.monthIndex, r]),
    );
    return rows.map((row) => {
      const prior = priorByMonth.get(row.monthIndex);
      return {
        month: row.monthLabel,
        thisYear: row.cumulativeRemaining,   // left axis — cumulative all-time
        monthlySaved: row.saved,             // right axis — this month's saved
        priorSaved: prior?.saved ?? null,    // right axis — prior year same month
        savedDelta:                          // right axis — delta bar
          prior?.saved != null ? row.saved - prior.saved : null,
        monthIndex: row.monthIndex,
        hasData: row.hasData,
        // Tooltip breakdown
        income: row.income,
        expenses: row.expenses,
        saved: row.saved,
        savingsRate: row.savingsRate,
        priorIncome: prior?.income,
        priorExpenses: prior?.expenses,
        priorSavedAmt: prior?.saved,
      };
    });
  }, [rows, priorRows]);

  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
  const lineColor =
    lastRow && lastRow.cumulativeRemaining < 0 ? colors.danger : colors.success;

  // Prior year line: muted color, always consistent
  const priorLineColor = colors.muted;
  const hasPriorData = priorRows != null && priorRows.length > 0;

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
      if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
      if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
      return `${v}`;
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
        <div className="text-xs text-theme-muted">
          Cash flow after {row.monthLabel}
        </div>
        <div className="text-[0.625rem] text-theme-muted">
          Add more months to see the trend
        </div>
      </div>
    );
  }

  return (
    <div aria-label="Cash flow chart showing cumulative surplus or deficit by month">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart
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
            padding={{ left: 0, right: 0 }}
          />
          {/* Left axis — cumulative cash flow */}
          <YAxis
            yAxisId="left"
            orientation="left"
            tick={{ fill: colors.muted, fontSize: 12 }}
            axisLine={{ stroke: colors.grid }}
            tickFormatter={yAxisFormatter}
          />
          {/* Right axis — monthly saved + delta */}
          <YAxis
            yAxisId="right"
            orientation="right"
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
            yAxisId="left"
            y={0}
            stroke={colors.grid}
            strokeDasharray="4 2"
            strokeWidth={1.5}
          />
          <ReferenceLine
            yAxisId="right"
            y={0}
            stroke={colors.grid}
            strokeDasharray="4 2"
            strokeWidth={1}
            opacity={0.4}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="line"
            wrapperStyle={{ fontSize: "11px", paddingBottom: "4px" }}
            formatter={(value) => {
              if (value === "thisYear") return "Cumulative";
              if (value === "monthlySaved") return "Saved (this year)";
              if (value === "priorSaved") return `Saved (${priorYear ?? "prior year"})`;
              if (value === "savedDelta") return "Delta";
              return value;
            }}
          />

          {/* Delta bars — rendered first so lines sit on top */}
          {hasPriorData && (
            <Bar
              yAxisId="right"
              dataKey="savedDelta"
              name="savedDelta"
              maxBarSize={20}
              opacity={0.35}
              radius={[2, 2, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`delta-${index}`}
                  fill={
                    entry.savedDelta == null
                      ? "transparent"
                      : entry.savedDelta >= 0
                        ? colors.success
                        : colors.danger
                  }
                />
              ))}
            </Bar>
          )}

          {/* Cumulative cash flow — left axis, solid, interactive */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="thisYear"
            name="thisYear"
            stroke={lineColor}
            strokeWidth={2.5}
            dot={renderDot}
            activeDot={false}
          />
          {/* Monthly saved this year — right axis, solid thinner */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="monthlySaved"
            name="monthlySaved"
            stroke={colors.primary}
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
          />
          {/* Prior year monthly saved — right axis, dashed muted */}
          {hasPriorData && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="priorSaved"
              name="priorSaved"
              stroke={priorLineColor}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              activeDot={false}
              connectNulls={false}
              opacity={0.6}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="sr-only" aria-live="polite">
        {selectedMonth !== null && rows[selectedMonth]
          ? `Selected: ${rows[selectedMonth].monthLabel}, cumulative cash flow: ${formatAmount(rows[selectedMonth].cumulativeRemaining)}`
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
            {row.monthLabel} — {formatAmount(row.cumulativeRemaining)} cash flow
          </option>
        ))}
      </select>
    </div>
  );
}
