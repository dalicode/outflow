import { useMemo, useCallback, useState, useRef, useEffect } from "react";
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
  Brush,
  Customized,
} from "recharts";
import type { YearTrendRow, AllTimeRow } from "../../../utils/analyticsTrendUtils";
import type { ThemeColors } from "../AnalyticsCharts";

// ---------------------------------------------------------------------------
// Monotone cubic interpolation helpers — matches Recharts type="monotone"
// ---------------------------------------------------------------------------

/** Compute monotone tangents for a sequence of (x, y) points. */
function monotoneTangents(pts: { x: number; y: number }[]): number[] {
  const n = pts.length;
  const tangents = new Array<number>(n).fill(0);
  if (n < 2) return tangents;

  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    slopes.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx);
  }

  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents[i] = 0;
    } else {
      const h0 = pts[i].x - pts[i - 1].x;
      const h1 = pts[i + 1].x - pts[i].x;
      const w = (2 * h1 + h0) / (3 * (h0 + h1));
      tangents[i] = 1 / (w / slopes[i - 1] + (1 - w) / slopes[i]);
    }
  }

  // Monotonicity constraint
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const a = tangents[i] / slopes[i];
      const b = tangents[i + 1] / slopes[i];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        tangents[i] = t * a * slopes[i];
        tangents[i + 1] = t * b * slopes[i];
      }
    }
  }
  return tangents;
}

/**
 * Build an SVG path string for a smooth monotone cubic curve through `pts`.
 * Returns the full path (M + C commands).
 */
function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  const tangents = monotoneTangents(pts);
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3;
    const cp1x = pts[i].x + dx;
    const cp1y = pts[i].y + tangents[i] * dx;
    const cp2x = pts[i + 1].x - dx;
    const cp2y = pts[i + 1].y - tangents[i + 1] * dx;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`;
  }
  return d;
}

/**
 * Split a smooth monotone path into colored segments (green = rising, red = falling).
 * Each segment is a cubic bezier from point i to i+1, colored by direction.
 */
function coloredMonotoneSegments(
  pts: { x: number; y: number }[],
  values: number[],
  successColor: string,
  dangerColor: string,
): { d: string; color: string }[] {
  if (pts.length < 2) return [];
  const tangents = monotoneTangents(pts);
  return pts.slice(1).map((pt, i) => {
    const prev = pts[i];
    const dx = (pt.x - prev.x) / 3;
    const cp1x = prev.x + dx;
    const cp1y = prev.y + tangents[i] * dx;
    const cp2x = pt.x - dx;
    const cp2y = pt.y - tangents[i + 1] * dx;
    const d = `M${prev.x.toFixed(2)},${prev.y.toFixed(2)} C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
    const rising = values[i + 1] >= values[i];
    return { d, color: rising ? successColor : dangerColor };
  });
}

interface IncomeTrendYearChartProps {
  rows: YearTrendRow[];
  priorRows?: YearTrendRow[] | null;
  priorYear?: number;
  selectedMonth: number | null;
  onSelectMonth: (monthIndex: number | null) => void;
  colors: ThemeColors;
  formatAmount: (n: number) => string;
  /** Full all-time dataset for the brush mini-timeline */
  allTimeRows?: AllTimeRow[];
  /** Currently selected year — used to set the default brush window */
  selectedYear?: number;
  /** Called when the brush window changes */
  onBrushChange?: (window: AllTimeRow[]) => void;
  /** External brush window to apply (e.g. from year strip pan) */
  externalBrushWindow?: AllTimeRow[] | null;
  /** Increment to force re-apply even if window content is the same */
  externalBrushVersion?: number;
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

// ---------------------------------------------------------------------------
// BrushOverview — draws the full all-time sparkline as a raw SVG path so the
// Recharts Brush component cannot clip it, then overlays the Brush on top for
// its drag handles.
// ---------------------------------------------------------------------------

interface BrushOverviewProps {
  allTimeRows: AllTimeRow[];
  brushIndices: { start: number; end: number } | null;
  defaultBrushIndices: { start: number; end: number } | null;
  colors: ThemeColors;
  onBrushChange: (next: { start: number; end: number }) => void;
}

function BrushOverview({
  allTimeRows,
  brushIndices,
  defaultBrushIndices,
  colors,
  onBrushChange,
}: BrushOverviewProps) {
  // We need the rendered width to compute the SVG path. Use a ResizeObserver
  // via a ref so the path stays accurate on resize.
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Recharts Brush uses margin { left: 0, right: 10 } by default in our chart.
  // Match those margins so the sparkline aligns with the brush handles.
  const marginLeft = 0;
  const marginRight = 10;
  const chartWidth = width - marginLeft - marginRight;
  const height = 20; // drawing area height (brush container is 50px total)

  // Compute a single smooth monotone path with a hard-snap green/red gradient.
  const sparkPath = useMemo(() => {
    if (chartWidth <= 0 || allTimeRows.length < 2) return { path: "", stops: [] as { offset: string; color: string }[] };
    const values = allTimeRows.map((r) => r.cumulativeRemaining);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const xStep = chartWidth / (allTimeRows.length - 1);
    const pts = values.map((v, i) => ({
      x: marginLeft + i * xStep,
      y: 2 + height - ((v - min) / range) * height,
    }));

    // Build gradient stops with hard color snaps at each segment boundary.
    // Two stops at the same offset = instant color change, no blending.
    const totalWidth = pts[pts.length - 1].x - pts[0].x || 1;
    const stops: { offset: string; color: string }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const color = values[i + 1] >= values[i] ? colors.success : colors.danger;
      const pct = (((pts[i].x - pts[0].x) / totalWidth) * 100).toFixed(2) + "%";
      if (i > 0) stops.push({ offset: pct, color: stops[stops.length - 1].color });
      stops.push({ offset: pct, color });
    }
    if (stops.length > 0) stops.push({ offset: "100%", color: stops[stops.length - 1].color });

    return { path: monotonePath(pts), stops };
  }, [allTimeRows, chartWidth, marginLeft, height, colors.success, colors.danger]);

  return (
    <div className="mt-2" ref={containerRef}>
      {/* Full-dataset sparkline — smooth path with hard-snap green/red gradient */}
      {width > 0 && sparkPath.path && (
        <svg
          width={width}
          height={height + 4}
          style={{ display: "block", pointerEvents: "none" }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="spark-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              {sparkPath.stops.map((s, i) => (
                <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={0.85} />
              ))}
            </linearGradient>
          </defs>
          <path
            d={sparkPath.path}
            fill="none"
            stroke="url(#spark-grad)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {/* Brush handles — rendered in a chart with no series so it can't clip anything */}
      <ResponsiveContainer width="100%" height={30}>
        <ComposedChart
          data={allTimeRows}
          margin={{ top: 0, right: marginRight, left: marginLeft, bottom: 0 }}
        >
          <Brush
            dataKey="label"
            height={30}
            stroke={colors.grid}
            fill={colors.background}
            travellerWidth={6}
            startIndex={brushIndices?.start ?? 0}
            endIndex={brushIndices?.end ?? allTimeRows.length - 1}
            onChange={(range) => {
              if (
                range &&
                typeof range.startIndex === "number" &&
                typeof range.endIndex === "number"
              ) {
                onBrushChange({ start: range.startIndex, end: range.endIndex });
              }
            }}
            style={{ fontSize: "10px" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ColoredCumulativeLine — rendered via <Customized>. Reads pixel coordinates
// from formattedGraphicalItems (the already-laid-out Line points) so we never
// have to call the axis scale directly.
// ---------------------------------------------------------------------------

interface ColoredCumulativeLineProps {
  // Injected by Recharts <Customized>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formattedGraphicalItems?: Array<{ item: { props: { dataKey: string } }; props: { points: Array<{ x: number; y: number; value: number; payload: { hasData: boolean; monthIndex: number } }> } }>;
  chartData: Array<{ thisYear: number; hasData: boolean; monthIndex: number }>;
  colors: ThemeColors;
  selectedMonth: number | null;
  onSelectMonth: (i: number | null) => void;
}

function ColoredCumulativeLine({
  formattedGraphicalItems,
  chartData,
  colors,
  selectedMonth,
  onSelectMonth,
}: ColoredCumulativeLineProps) {
  // Find the laid-out points for the "thisYear" line
  const lineItem = formattedGraphicalItems?.find(
    (item) => item.item.props.dataKey === "thisYear",
  );
  const points = lineItem?.props.points;

  if (!points || points.length < 2) return null;

  const values = points.map((p) => p.value);
  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  const segments = coloredMonotoneSegments(pts, values, colors.success, colors.danger);

  return (
    <g>
      {segments.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          fill="none"
          stroke={seg.color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {points.map((p, i) => {
        const isSelected = p.payload.monthIndex === selectedMonth;
        if (!p.payload.hasData) {
          return (
            <circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={colors.background}
              stroke={colors.muted}
              strokeWidth={1.5}
              opacity={0.4}
            />
          );
        }
        const rising = values[i] >= (values[i - 1] ?? values[i]);
        return (
          <circle
            key={`dot-${i}`}
            cx={p.x}
            cy={p.y}
            r={isSelected ? 6 : 3}
            fill={rising ? colors.success : colors.danger}
            stroke={colors.background}
            strokeWidth={isSelected ? 2 : 0}
            style={{ cursor: "pointer" }}
            onClick={() =>
              onSelectMonth(
                selectedMonth === p.payload.monthIndex ? null : p.payload.monthIndex,
              )
            }
          />
        );
      })}
    </g>
  );
}

export default function IncomeTrendYearChart({
  rows,
  priorRows,
  priorYear,
  selectedMonth,
  onSelectMonth,
  colors,
  formatAmount,
  allTimeRows,
  selectedYear,
  onBrushChange,
  externalBrushWindow,
  externalBrushVersion,
}: IncomeTrendYearChartProps) {
  // Brush indices into allTimeRows — default to the selected year's window
  const defaultBrushIndices = useMemo(() => {
    if (!allTimeRows || allTimeRows.length === 0) return null;
    const start = allTimeRows.findIndex((r) => r.year === selectedYear);
    if (start === -1) return null;
    const end = allTimeRows.findLastIndex((r) => r.year === selectedYear);
    return { start, end };
  }, [allTimeRows, selectedYear]);

  const [brushIndices, setBrushIndices] = useState<{ start: number; end: number } | null>(
    defaultBrushIndices,
  );

  // Reset brush when year changes
  const prevSelectedYear = useMemo(() => selectedYear, [selectedYear]);
  if (prevSelectedYear !== selectedYear) {
    setBrushIndices(defaultBrushIndices);
  }

  // Sync brush when external window is set (e.g. year strip pan)
  const prevExternalVersion = useRef(externalBrushVersion);
  if (prevExternalVersion.current !== externalBrushVersion && externalBrushWindow != null && allTimeRows) {
    prevExternalVersion.current = externalBrushVersion;
    const firstKey = externalBrushWindow[0]?.monthKey;
    const lastKey = externalBrushWindow[externalBrushWindow.length - 1]?.monthKey;
    const start = allTimeRows.findIndex((r) => r.monthKey === firstKey);
    const end = allTimeRows.findLastIndex((r) => r.monthKey === lastKey);
    if (start !== -1 && end !== -1) {
      setBrushIndices({ start, end });
    }
  }
  // Only switch to all-time mode when the brush spans outside the selected year
  const isBrushCustom = useMemo(() => {
    if (!brushIndices || !defaultBrushIndices) return false;
    return (
      brushIndices.start !== defaultBrushIndices.start ||
      brushIndices.end !== defaultBrushIndices.end
    );
  }, [brushIndices, defaultBrushIndices]);

  // When brush is active and custom, derive the visible rows from the brushed window
  const visibleAllTimeRows = useMemo(() => {
    if (!allTimeRows || !brushIndices || !isBrushCustom) return null;
    return allTimeRows.slice(brushIndices.start, brushIndices.end + 1);
  }, [allTimeRows, brushIndices, isBrushCustom]);  // Merge this year and prior year data by month index
  // When brush is active, use the all-time rows for the visible window
  const chartData = useMemo(() => {
    if (visibleAllTimeRows && visibleAllTimeRows.length > 0) {
      // Brush mode: use all-time rows with per-point prior-year data
      return visibleAllTimeRows.map((row) => ({
        month: row.label,
        thisYear: row.cumulativeRemaining,
        monthlySaved: row.saved,
        priorSaved: row.priorSaved,
        savedDelta: row.savedDelta,
        monthIndex: row.monthIndex,
        year: row.year,
        hasData: row.hasData,
        income: row.income,
        expenses: row.expenses,
        saved: row.saved,
        savingsRate: row.savingsRate,
        priorSavedAmt: row.priorSaved,
      }));
    }
    // Default: per-year rows with prior-year overlay
    const priorByMonth = new Map(
      (priorRows ?? []).map((r) => [r.monthIndex, r]),
    );
    return rows.map((row) => {
      const prior = priorByMonth.get(row.monthIndex);
      return {
        month: row.monthLabel,
        thisYear: row.cumulativeRemaining,
        monthlySaved: row.saved,
        priorSaved: prior?.saved ?? null,
        savedDelta: prior?.saved != null ? row.saved - prior.saved : null,
        monthIndex: row.monthIndex,
        year: selectedYear,
        hasData: row.hasData,
        income: row.income,
        expenses: row.expenses,
        saved: row.saved,
        savingsRate: row.savingsRate,
        priorSavedAmt: prior?.saved,
      };
    });
  }, [visibleAllTimeRows, rows, priorRows, selectedYear]);

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
        >          <CartesianGrid
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

          {/* Cumulative cash flow — drawn as colored SVG via Customized */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="thisYear"
            name="thisYear"
            stroke={colors.success}
            strokeWidth={0}
            dot={false}
            activeDot={false}
            legendType="line"
          />
          <Customized
            component={(props: object) => (
              <ColoredCumulativeLine
                {...(props as ColoredCumulativeLineProps)}
                chartData={chartData}
                colors={colors}
                selectedMonth={selectedMonth}
                onSelectMonth={onSelectMonth}
              />
            )}
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

      {/* Brush mini-timeline — full all-time history */}
      {allTimeRows && allTimeRows.length > 1 && (
        <BrushOverview
          allTimeRows={allTimeRows}
          brushIndices={brushIndices}
          defaultBrushIndices={defaultBrushIndices}
          colors={colors}
          onBrushChange={(next) => {
            setBrushIndices(next);
            if (onBrushChange) {
              onBrushChange(allTimeRows.slice(next.start, next.end + 1));
            }
          }}
        />
      )}

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
