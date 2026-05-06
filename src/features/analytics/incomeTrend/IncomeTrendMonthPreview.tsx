import { forwardRef } from "react";
import type { YearTrendRow } from "../../../utils/analyticsTrendUtils";
import type { ThemeColors } from "../AnalyticsCharts";

function formatSavingsRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${rate.toFixed(1)}%`;
}

function formatDelta(
  current: number,
  previous: number | null,
  formatAmount: (n: number) => string,
): string | null {
  if (previous === null) return null;
  const delta = current - previous;
  if (delta === 0) return null;
  const formatted = formatAmount(Math.abs(delta));
  return delta > 0 ? `+${formatted}` : `-${formatted}`;
}

interface StatChipProps {
  label: string;
  value: string;
  valueColor?: string;
}

function StatChip({ label, value, valueColor }: StatChipProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[0.625rem] font-medium text-theme-muted uppercase tracking-wider truncate">
        {label}
      </span>
      <span
        className="text-sm font-semibold tabular-nums truncate"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

interface IncomeTrendMonthPreviewProps {
  row: YearTrendRow;
  prevCumulativeRemaining: number | null;
  colors: ThemeColors;
  formatAmount: (n: number) => string;
  onViewMonth: () => void;
  onDismiss: () => void;
}

const IncomeTrendMonthPreview = forwardRef<HTMLDivElement, IncomeTrendMonthPreviewProps>(
  function IncomeTrendMonthPreview({
    row,
    prevCumulativeRemaining,
    colors,
    formatAmount,
    onViewMonth,
    onDismiss,
  }, ref) {
    const cumulativeDelta = formatDelta(
      row.cumulativeRemaining,
      prevCumulativeRemaining,
      formatAmount,
    );

    const cumulativeColor =
      row.cumulativeRemaining < 0 ? colors.danger : colors.success;

    const savedColor =
      row.saved < 0 ? colors.danger : row.saved > 0 ? colors.success : undefined;

    return (
      <div
        ref={ref}
        tabIndex={-1}
        className="motion-fade-up border-t border-theme-border outline-none"
        data-testid="income-trend-month-preview"
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 sm:px-5">
          <span className="text-sm font-semibold text-theme-text">
            {row.monthLabel}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Dismiss ${row.monthLabel} preview`}
            className="text-theme-muted hover:text-theme-text transition-colors p-1 -mr-1"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 px-4 pb-3 sm:grid-cols-4 sm:px-5">
          <StatChip
            label="Income"
            value={formatAmount(row.income)}
          />
          <StatChip
            label="Expenses"
            value={formatAmount(row.expenses)}
            valueColor={row.expenses > 0 ? colors.danger : undefined}
          />
          <StatChip
            label="Saved"
            value={formatAmount(row.saved)}
            valueColor={savedColor}
          />
          <StatChip
            label="Rate"
            value={formatSavingsRate(row.savingsRate)}
          />
        </div>

        <div
          className="mx-4 mb-3 sm:mx-5 rounded-theme-medium px-3 py-2.5"
          style={{
            backgroundColor:
              row.cumulativeRemaining < 0
                ? `color-mix(in srgb, ${colors.danger} 8%, ${colors.background})`
                : `color-mix(in srgb, ${colors.success} 8%, ${colors.background})`,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor:
              row.cumulativeRemaining < 0
                ? `color-mix(in srgb, ${colors.danger} 25%, ${colors.grid})`
                : `color-mix(in srgb, ${colors.success} 25%, ${colors.grid})`,
          }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span
              className="text-[0.625rem] font-medium uppercase tracking-wider"
              style={{ color: colors.muted }}
            >
              All-time cash flow
            </span>
            {cumulativeDelta && (
              <span
                className="text-[0.625rem] font-medium tabular-nums"
                style={{
                  color:
                    cumulativeDelta.startsWith("+")
                      ? colors.success
                      : colors.danger,
                }}
              >
                {cumulativeDelta} vs prev
              </span>
            )}
          </div>
          <div
            className="text-lg font-bold tabular-nums mt-0.5"
            style={{ color: cumulativeColor }}
          >
            {formatAmount(row.cumulativeRemaining)}
          </div>
        </div>

        <div className="px-4 pb-4 sm:px-5">
          <button
            type="button"
            onClick={onViewMonth}
            data-testid="income-trend-view-month-btn"
            className="btn-modal-primary w-full"
            aria-label={`View details for ${row.monthLabel}`}
          >
            View {row.monthLabel}
          </button>
        </div>
      </div>
    );
  },
);

export default IncomeTrendMonthPreview;
