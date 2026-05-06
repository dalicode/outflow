export interface SummaryCardProps {
  label: string;
  value: string;
  tone: "success" | "danger" | "neutral";
}

export default function SummaryCard({ label, value, tone }: SummaryCardProps) {
  const toneClass =
    tone === "success"
      ? "text-theme-success"
      : tone === "danger"
        ? "text-theme-danger"
        : "text-theme-text";

  return (
    <div className="summary-card">
      <div
        className={`text-xl md:text-2xl font-bold tabular-nums ${toneClass}`}
      >
        {value}
      </div>
      <div className="text-sm text-theme-muted mt-1 font-medium">{label}</div>
    </div>
  );
}
