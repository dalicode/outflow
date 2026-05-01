import { cn } from "../../utils/cn";
import { useSettings } from "../../context/settingsContext";
import type { MonthlySummary } from "../../types";

interface DashboardHeaderProps {
  financialSummary: MonthlySummary | null;
  daysLeft: number;
}

export default function DashboardHeader({
  financialSummary,
  daysLeft,
}: DashboardHeaderProps) {
  const { formatAmount } = useSettings();

  return (
    <div className="flex items-start justify-between">
      <h1 className="text-2xl font-bold text-theme-text tracking-tight">
        Dashboard
      </h1>
      {financialSummary && (
        <div className="flex flex-col items-end text-right pt-0.5">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums leading-none",
              financialSummary.remaining >= 0
                ? "text-theme-success"
                : "text-theme-danger",
            )}
          >
            {formatAmount(financialSummary.remaining)}
          </span>
          <span className="text-xs text-theme-muted mt-0.5">
            Remaining
            {daysLeft > 0 && ` · T - ${daysLeft}`}
          </span>
        </div>
      )}
    </div>
  );
}
