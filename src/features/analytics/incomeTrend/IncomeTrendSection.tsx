import { useMemo, useRef, useEffect } from "react";
import { useSettings } from "../../../context/settingsContext";
import IncomeTrendYearChart from "./IncomeTrendYearChart";
import IncomeTrendMonthPreview from "./IncomeTrendMonthPreview";
import IncomeTrendMonthDrilldown from "./IncomeTrendMonthDrilldown";
import IncomeTrendExpensePreview from "./IncomeTrendExpensePreview";
import IncomeFlowBar from "../IncomeFlowBar";
import AnalyticsCharts from "../AnalyticsCharts";
import { buildYearTrendRows } from "../../../utils/analyticsTrendUtils";
import { useThemeColors } from "../AnalyticsCharts";
import type { AnalyticsData, Expense, Category, Payee } from "../../../types";

interface IncomeTrendSectionProps {
  data: AnalyticsData;
  expenses: Expense[];
  categories: Category[];
  payees: Payee[];
  year: number;
  currentYear: number;
  currentMonth: number;
  priorYearsData: AnalyticsData[];
  trendMonth: number | null;
  trendDrilldown: boolean;
  onTrendStateChange: (patch: {
    trendMonth?: number | null;
    trendDrilldown?: boolean;
  }) => void;
  yearTotalIncome: number;
  yearFixedTotal: number;
  yearVariableTotal: number;
  yearSavings: number;
  yearRemaining: number;
  monthlyIncome: number[];
  monthlyFixed: number[];
  monthlyVariable: number[];
  monthlySavings: (number | null)[];
  monthlyRemaining: (number | null)[];
  monthCount: number;
  isCurrentYear: boolean;
  multiYearData: AnalyticsData[];
}

export default function IncomeTrendSection({
  data,
  expenses,
  categories,
  payees,
  year,
  currentYear,
  currentMonth,
  priorYearsData,
  trendMonth,
  trendDrilldown,
  onTrendStateChange,
  yearTotalIncome,
  yearFixedTotal,
  yearVariableTotal,
  yearSavings,
  yearRemaining,
  monthlyIncome,
  monthlyFixed,
  monthlyVariable,
  monthlySavings,
  monthlyRemaining,
  monthCount,
  isCurrentYear,
  multiYearData,
}: IncomeTrendSectionProps) {
  const { formatAmount, formatDate } = useSettings();
  const colors = useThemeColors();

  const trendRows = useMemo(
    () =>
      buildYearTrendRows(
        data,
        expenses,
        year,
        currentYear,
        currentMonth,
        priorYearsData,
      ),
    [data, expenses, year, currentYear, currentMonth, priorYearsData],
  );

  // Build prior year rows for YTD comparison (last year, same months)
  const priorYearRows = useMemo(() => {
    const priorData = priorYearsData[priorYearsData.length - 1];
    if (!priorData || priorData.loading) return null;
    const priorYear = year - 1;
    // For current year: only show prior year up to the same month (apples-to-apples)
    // For past years: show all 12 months of the prior year
    const priorCurrentMonth = isCurrentYear ? currentMonth : 11;
    return buildYearTrendRows(
      priorData,
      expenses.filter((e) => e.date?.startsWith(`${priorYear}-`)),
      priorYear,
      priorYear, // treat prior year as its own "current year" so all months show
      priorCurrentMonth,
      priorYearsData.slice(0, -1), // prior years before the comparison year
    );
  }, [priorYearsData, year, isCurrentYear, currentMonth, expenses]);

  const ytdSaved = useMemo(
    () => trendRows.reduce((sum, r) => sum + r.saved, 0),
    [trendRows],
  );

  const priorYtdSaved = useMemo(
    () => priorYearRows?.reduce((sum, r) => sum + r.saved, 0) ?? null,
    [priorYearRows],
  );

  const ytdDelta = priorYtdSaved != null ? ytdSaved - priorYtdSaved : null;
  const ytdDeltaPct =
    ytdDelta != null && priorYtdSaved !== 0 && priorYtdSaved != null
      ? (ytdDelta / Math.abs(priorYtdSaved)) * 100
      : null;

  const yearTopExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.date?.startsWith(`${year}-`))
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
      .slice(0, 20);
  }, [expenses, year]);

  // Spending spikes: months above average + the category that drove the biggest jump
  const spendingSpikes = useMemo(() => {
    const monthTotals = trendRows.map((r) => r.expenses);
    if (monthTotals.length < 2) return [];
    const avg = monthTotals.reduce((s, v) => s + v, 0) / monthTotals.length;
    if (avg === 0) return [];

    return trendRows
      .filter((r) => r.expenses > avg * 1.1) // at least 10% above average
      .map((r) => {
        const m = r.monthIndex;
        // Find the category with the biggest MoM jump this month
        const topCat = (data.variableRows ?? [])
          .map((row) => {
            const thisMonth = row.amounts[m] ?? 0;
            const prevMonth = m > 0 ? (row.amounts[m - 1] ?? 0) : 0;
            return { name: row.name, amount: thisMonth, delta: thisMonth - prevMonth };
          })
          .filter((c) => c.amount > 0)
          .sort((a, b) => b.delta - a.delta)[0] ?? null;

        return {
          monthLabel: r.monthLabel,
          expenses: r.expenses,
          aboveAvgPct: ((r.expenses - avg) / avg) * 100,
          topCat,
        };
      })
      .sort((a, b) => b.aboveAvgPct - a.aboveAvgPct)
      .slice(0, 5);
  }, [trendRows, data.variableRows]);

  const prevCumulativeRemaining =
    trendMonth !== null && trendMonth > 0
      ? (trendRows[trendMonth - 1]?.cumulativeRemaining ?? null)
      : null;

  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (trendMonth !== null && !trendDrilldown && previewRef.current) {
      previewRef.current.focus();
    }
  }, [trendMonth, trendDrilldown]);

  return (
    <section
      className="rounded-theme-large bg-theme-surface shadow-sm overflow-hidden"
      data-testid="income-trend-section"
      aria-labelledby="income-trend-heading"
    >
      {data.loading ? (
        <div className="px-4 py-8 sm:px-5 flex items-center justify-center">
          <span className="text-xs text-theme-muted">Loading…</span>
        </div>
      ) : trendDrilldown && trendMonth !== null && trendRows[trendMonth] ? (
        <IncomeTrendMonthDrilldown
          data={data}
          expenses={expenses}
          categories={categories}
          payees={payees}
          year={year}
          monthIndex={trendMonth}
          cumulativeRemaining={trendRows[trendMonth].cumulativeRemaining}
          colors={colors}
          formatAmount={formatAmount}
          formatDate={formatDate}
          onBack={() => onTrendStateChange({ trendDrilldown: false })}
          multiYearData={multiYearData}
        />
      ) : (
        <>
          <div className="px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
            <h2
              id="income-trend-heading"
              className="text-sm font-semibold text-theme-text tracking-tight"
            >
              Savings & Cash Flow
            </h2>
            <p className="text-xs text-theme-muted mt-0.5">
              Monthly savings vs last year · cumulative surplus or deficit over time
            </p>

            {/* YTD savings delta stat */}
            <div className="flex items-baseline gap-3 mt-3 flex-wrap">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-theme-muted">YTD Saved</span>
                <span
                  className="text-base font-bold tabular-nums"
                  style={{ color: ytdSaved >= 0 ? colors.success : colors.danger }}
                >
                  {formatAmount(ytdSaved)}
                </span>
              </div>
              {ytdDelta != null && (
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: ytdDelta >= 0 ? colors.success : colors.danger }}
                  >
                    {ytdDelta >= 0 ? "↑" : "↓"} {formatAmount(Math.abs(ytdDelta))}
                  </span>
                  <span className="text-xs text-theme-muted">
                    vs {year - 1}
                  </span>
                  {ytdDeltaPct != null && (
                    <span
                      className="text-xs font-medium tabular-nums"
                      style={{ color: ytdDelta >= 0 ? colors.success : colors.danger }}
                    >
                      ({ytdDelta >= 0 ? "+" : ""}{ytdDeltaPct.toFixed(1)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="px-4 pb-2 sm:px-5">
            <IncomeTrendYearChart
              rows={trendRows}
              priorRows={priorYearRows}
              priorYear={year - 1}
              selectedMonth={trendMonth}
              onSelectMonth={(m) => onTrendStateChange({ trendMonth: m })}
              colors={colors}
              formatAmount={formatAmount}
            />
          </div>

          <div className="px-4 pb-4 sm:px-5 border-t border-theme-border pt-4">
            <IncomeFlowBar
              yearIncome={yearTotalIncome}
              yearFixed={yearFixedTotal}
              yearVariable={yearVariableTotal}
              yearSavings={yearSavings}
              yearRemaining={yearRemaining}
              monthlyIncome={monthlyIncome}
              monthlyFixed={monthlyFixed}
              monthlyVariable={monthlyVariable}
              monthlySavings={monthlySavings}
              monthlyRemaining={monthlyRemaining}
              selectedMonth={trendMonth}
              monthCount={monthCount}
              isCurrentYear={isCurrentYear}
              year={year}
              formatAmount={formatAmount}
            />
          </div>

          {/* Month preview — only when a dot is selected */}
          {trendMonth !== null && trendRows[trendMonth] && (
            <IncomeTrendMonthPreview
              ref={previewRef}
              row={trendRows[trendMonth]}
              prevCumulativeRemaining={
                trendMonth > 0
                  ? (trendRows[trendMonth - 1]?.cumulativeRemaining ?? null)
                  : null
              }
              colors={colors}
              formatAmount={formatAmount}
              onViewMonth={() => onTrendStateChange({ trendDrilldown: true })}
              onDismiss={() =>
                onTrendStateChange({ trendMonth: null, trendDrilldown: false })
              }
            />
          )}

          {/* Year charts — always visible */}
          <div className="border-t border-theme-border">
            <AnalyticsCharts
              data={data}
              multiYearData={multiYearData}
              year={year}
              currentYear={currentYear}
              currentMonth={currentMonth}
              selectedMonth={null}
            />
          </div>

          {/* Year top expenses + spending spikes — two column layout */}
          <div className="px-4 py-4 sm:px-5 border-t border-theme-border grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Expenses */}
            <div>
              <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
                Top Expenses
              </h3>
              <IncomeTrendExpensePreview
                expenses={yearTopExpenses}
                categories={categories}
                payees={payees}
                formatAmount={formatAmount}
                formatDate={formatDate}
              />
            </div>

            {/* Spending Spikes */}
            <div>
              <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
                Spending Spikes
              </h3>
              {spendingSpikes.length === 0 ? (
                <p className="text-xs text-theme-muted py-2 text-center">
                  No unusual months this year
                </p>
              ) : (
                <ul className="divide-y divide-theme-border">
                  {spendingSpikes.map((spike) => (
                    <li key={spike.monthLabel} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-theme-text truncate">
                          {spike.monthLabel}
                          {spike.topCat && (
                            <span className="text-theme-muted font-normal"> · ↑ {spike.topCat.name}</span>
                          )}
                        </div>
                        <div className="text-xs text-theme-muted truncate">
                          +{spike.aboveAvgPct.toFixed(0)}% above avg
                          {spike.topCat && spike.topCat.delta > 0 && (
                            <span className="text-theme-danger"> · +{formatAmount(spike.topCat.delta)}</span>
                          )}
                          {spike.topCat && spike.topCat.delta === spike.topCat.amount && (
                            <span> · new</span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums shrink-0 text-theme-danger">
                        {spike.topCat ? formatAmount(spike.topCat.amount) : formatAmount(spike.expenses)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
