import { useMemo } from "react";
import { cn } from "../../utils/cn";
import type { AnalyticsData } from "../../types";
import type { SummaryCardProps } from "./SummaryCard";
import { buildAnalyticsOverviewSnapshot } from "./analyticsOverviewUtils";

interface AnalyticsOverviewSectionProps {
  data: AnalyticsData;
  year: number;
  currentYear: number;
  currentMonth: number;
  selectedMonth: number | null;
  summaryCards: SummaryCardProps[];
  formatAmount: (value: number) => string;
}

function formatDelta(
  value: number | null,
  formatAmount: (input: number) => string,
): string {
  if (value === null) return "—";
  const amount = formatAmount(Math.abs(value));
  return value > 0 ? `+${amount}` : value < 0 ? `-${amount}` : amount;
}

function formatRateChange(value: number | null): string {
  if (value === null) return "—";
  const rounded = Math.abs(value).toFixed(1);
  return value > 0
    ? `+${rounded} pts`
    : value < 0
      ? `-${rounded} pts`
      : `${rounded} pts`;
}

export default function AnalyticsOverviewSection({
  data,
  year,
  currentYear,
  currentMonth,
  selectedMonth,
  summaryCards,
  formatAmount,
}: AnalyticsOverviewSectionProps) {
  const overview = useMemo(
    () =>
      buildAnalyticsOverviewSnapshot(
        data,
        year,
        currentYear,
        currentMonth,
        selectedMonth,
      ),
    [data, year, currentYear, currentMonth, selectedMonth],
  );

  const selectedRow = overview.selectedRow;
  const previousRow = overview.previousRow;
  const trendHeadline =
    selectedRow && previousRow
      ? `${selectedRow.monthLabel} spent ${formatDelta(
          selectedRow.spending - previousRow.spending,
          formatAmount,
        )} vs ${previousRow.monthLabel} and moved ${formatRateChange(
          selectedRow.savingsRate - previousRow.savingsRate,
        )} in savings rate.`
      : overview.bestSpendRow && overview.bestSavingsRow
        ? `Spending peaked in ${overview.bestSpendRow.monthLabel}, while ${overview.bestSavingsRow.monthLabel} had the strongest savings rate.`
        : "Add more months to see month-to-month analytics.";

  const insightChips = [
    selectedRow
      ? {
          label: "Selected spend",
          value: formatAmount(selectedRow.spending),
        }
      : overview.bestSpendRow
        ? {
            label: "Peak spend month",
            value: overview.bestSpendRow.monthLabel,
          }
        : null,
    overview.bestSavingsRow
      ? {
          label: "Top savings month",
          value: overview.bestSavingsRow.monthLabel,
        }
      : null,
    selectedRow
      ? {
          label: "Top category",
          value: selectedRow.topCategoryName,
        }
      : overview.bestSpendRow
        ? {
            label: "Average spend",
            value: formatAmount(overview.averageSpend),
          }
        : null,
    selectedRow
      ? {
          label: "Top payee",
          value: selectedRow.topPayeeName,
        }
      : {
          label: "Average savings rate",
          value: `${overview.averageSavingsRate.toFixed(1)}%`,
        },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <section className="analytics-overview space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="analytics-overview-summary">
            <div className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-theme-muted">
              {card.label}
            </div>
            <div
              className={cn(
                "mt-1 text-xl font-bold tabular-nums md:text-2xl",
                card.tone === "success"
                  ? "text-theme-success"
                  : card.tone === "danger"
                    ? "text-theme-danger"
                    : "text-theme-text",
              )}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="analytics-overview-band">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div>
              <h2 className="text-sm font-semibold text-theme-text">
                Year at a glance
              </h2>
              <p className="text-sm text-theme-muted">{trendHeadline}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {insightChips.map((chip) => (
                <span key={chip.label} className="analytics-overview-chip">
                  <span className="analytics-overview-chip-label">
                    {chip.label}
                  </span>
                  <span className="analytics-overview-chip-value">
                    {chip.value}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {selectedRow && (
            <div className="analytics-overview-snapshot">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-theme-muted">
                    Snapshot
                  </div>
                  <div className="text-sm font-semibold text-theme-text">
                    {selectedRow.monthLabel}
                    {selectedRow.isCurrent ? " (current)" : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-theme-muted">
                    Remaining
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-theme-text">
                    {formatAmount(selectedRow.remaining)}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="analytics-overview-stat">
                  <span>Income</span>
                  <strong>{formatAmount(selectedRow.income)}</strong>
                </div>
                <div className="analytics-overview-stat">
                  <span>Spend</span>
                  <strong>{formatAmount(selectedRow.spending)}</strong>
                </div>
                <div className="analytics-overview-stat">
                  <span>Savings rate</span>
                  <strong>{selectedRow.savingsRate.toFixed(1)}%</strong>
                </div>
                <div className="analytics-overview-stat">
                  <span>MoM change</span>
                  <strong>
                    {formatDelta(selectedRow.deltaFromPrevious, formatAmount)}
                  </strong>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-theme-muted">Top category</span>
                  <span className="font-medium text-theme-text">
                    {selectedRow.topCategoryName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-theme-muted">Top payee</span>
                  <span className="font-medium text-theme-text">
                    {selectedRow.topPayeeName}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.85fr)]">
          <div className="analytics-overview-table-wrap">
            <div className="analytics-overview-table-header">
              <div>
                <div className="text-sm font-semibold text-theme-text">
                  Month-to-month comparison
                </div>
                <div className="text-xs text-theme-muted">
                  Income, spending, savings, and the biggest category for each
                  visible month.
                </div>
              </div>
              <div className="text-xs text-theme-muted">
                {overview.monthCount} month
                {overview.monthCount === 1 ? "" : "s"} visible
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="analytics-overview-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Income</th>
                    <th>Spend</th>
                    <th>Fixed</th>
                    <th>Variable</th>
                    <th>Remaining</th>
                    <th>Savings %</th>
                    <th>MoM</th>
                    <th>Top category</th>
                  </tr>
                </thead>
                <tbody className="text-theme-text text-sm">
                  {overview.rows.map((row) => (
                    <tr
                      key={row.monthIndex}
                      className={cn(
                        row.isSelected && "analytics-overview-row-selected",
                        row.isCurrent &&
                          !row.isSelected &&
                          "analytics-overview-row-current",
                      )}
                    >
                      <td>
                        <div className="font-semibold text-theme-text">
                          {row.monthLabel}
                        </div>
                        <div className="text-[0.6875rem] text-theme-muted">
                          {row.isSelected
                            ? "Selected"
                            : row.isCurrent
                              ? "Current"
                              : " "}
                        </div>
                      </td>
                      <td className="tabular-nums">
                        {formatAmount(row.income)}
                      </td>
                      <td className="tabular-nums">
                        {formatAmount(row.spending)}
                      </td>
                      <td className="tabular-nums">
                        {formatAmount(row.fixed)}
                      </td>
                      <td className="tabular-nums">
                        {formatAmount(row.variable)}
                      </td>
                      <td className="tabular-nums">
                        <span
                          className={cn(
                            row.remaining < 0 && "text-theme-danger",
                            row.remaining >= 0 && "text-theme-success",
                          )}
                        >
                          {formatAmount(row.remaining)}
                        </span>
                      </td>
                      <td className="tabular-nums">
                        {row.savingsRate.toFixed(1)}%
                      </td>
                      <td
                        className={cn(
                          "tabular-nums",
                          row.deltaFromPrevious != null &&
                            row.deltaFromPrevious > 0
                            ? "text-theme-danger"
                            : row.deltaFromPrevious != null &&
                                row.deltaFromPrevious < 0
                              ? "text-theme-success"
                              : "text-theme-muted",
                        )}
                      >
                        {formatDelta(row.deltaFromPrevious, formatAmount)}
                      </td>
                      <td>
                        <div className="font-medium text-theme-text">
                          {row.topCategoryName}
                        </div>
                        <div className="text-[0.6875rem] text-theme-muted tabular-nums">
                          {formatAmount(row.topCategoryAmount)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="analytics-overview-pulse">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-theme-text">
                  Spending pulse
                </div>
                <div className="text-xs text-theme-muted">
                  Monthly spend highlighted against the current selection.
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-end gap-2">
              {overview.rows.map((row) => {
                const peak = overview.bestSpendRow?.spending ?? 0;
                const height =
                  peak > 0 ? Math.max(12, (row.spending / peak) * 100) : 12;
                return (
                  <div key={row.monthIndex} className="flex-1">
                    <div className="flex h-32 items-end">
                      <div
                        className={cn(
                          "analytics-overview-pulse-bar",
                          row.isSelected &&
                            "analytics-overview-pulse-bar-selected",
                          row.isCurrent &&
                            !row.isSelected &&
                            "analytics-overview-pulse-bar-current",
                        )}
                        style={{ height: `${height}%` }}
                        title={`${row.monthLabel}: ${formatAmount(row.spending)}`}
                      />
                    </div>
                    <div className="mt-2 text-center text-[0.6875rem] text-theme-muted">
                      {row.monthLabel}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-theme-muted">Average spend</span>
                <span className="font-medium tabular-nums text-theme-text">
                  {formatAmount(overview.averageSpend)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-theme-muted">Average savings rate</span>
                <span className="font-medium tabular-nums text-theme-text">
                  {overview.averageSavingsRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-theme-muted">Best spend month</span>
                <span className="font-medium text-theme-text">
                  {overview.bestSpendRow?.monthLabel ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-theme-muted">Best savings month</span>
                <span className="font-medium text-theme-text">
                  {overview.bestSavingsRow?.monthLabel ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
