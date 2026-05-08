import type { ThemeColors } from "./AnalyticsCharts";

interface TooltipPayloadItem {
  value: number;
  name: string;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  colors: ThemeColors;
  formatter?: (value: number, name: string) => [string, string] | string;
}

export default function ChartTooltip({ active, payload, label, formatter, colors }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-theme-medium border shadow-lg px-3 py-2 text-xs"
      style={{ backgroundColor: colors.background, borderColor: colors.grid, color: colors.text }}
    >
      {label && (
        <div className="font-semibold mb-1" style={{ color: colors.text }}>{label}</div>
      )}
      {payload.map((entry, i) => {
        const value = formatter ? formatter(entry.value, entry.name) : entry.value;
        const displayValue = Array.isArray(value) ? value[0] : value;
        const displayName = Array.isArray(value) ? value[1] : entry.name;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="flex-1" style={{ color: colors.muted }}>{displayName}</span>
            <span className="font-medium" style={{ color: colors.text }}>{displayValue}</span>
          </div>
        );
      })}
    </div>
  );
}
