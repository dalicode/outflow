import type { ThemeColors } from "./AnalyticsCharts";

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  accentColor?: string;
  colors: ThemeColors;
}

export default function MetricCard({ label, value, subValue, accentColor, colors }: MetricCardProps) {
  return (
    <div className="rounded-theme-large border p-4 text-center bg-theme-background border-theme-border">
      <div className="text-xs font-medium mb-1 text-theme-muted">{label}</div>
      <div className="text-xl font-bold" style={{ color: accentColor || colors.text }}>
        {value}
      </div>
      {subValue && (
        <div className="text-[0.6875rem] mt-0.5 text-theme-muted">{subValue}</div>
      )}
    </div>
  );
}
