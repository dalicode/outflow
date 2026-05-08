import { useMemo, useRef, useState, useEffect } from "react";
import {
  ComposedChart,
  Brush,
  ResponsiveContainer,
} from "recharts";
import { monotonePath } from "../../../utils/chartMath";
import type { AllTimeRow } from "../../../utils/analyticsTrendUtils";
import type { ThemeColors } from "../AnalyticsCharts";

interface BrushOverviewProps {
  allTimeRows: AllTimeRow[];
  brushIndices: { start: number; end: number } | null;
  defaultBrushIndices: { start: number; end: number } | null;
  colors: ThemeColors;
  onBrushChange: (next: { start: number; end: number }) => void;
}

export default function BrushOverview({
  allTimeRows,
  brushIndices,
  defaultBrushIndices,
  colors,
  onBrushChange,
}: BrushOverviewProps) {
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const total = allTimeRows.length;
      const current = brushIndices ?? defaultBrushIndices ?? { start: 0, end: total - 1 };
      const windowSize = current.end - current.start + 1;
      const step = Math.max(1, Math.round(windowSize * 0.15));
      const raw = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const delta = raw > 0 ? step : -step;
      const newStart = Math.max(0, Math.min(total - windowSize, current.start + delta));
      const newEnd = newStart + windowSize - 1;
      onBrushChange({ start: newStart, end: newEnd });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [allTimeRows, brushIndices, defaultBrushIndices, onBrushChange]);

  const marginLeft = 0;
  const marginRight = 10;
  const chartWidth = width - marginLeft - marginRight;
  const height = 20;

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
    <div className="mt-2" ref={containerRef} data-brush-overview style={{ touchAction: "none" }}>
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
