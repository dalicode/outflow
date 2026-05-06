import { useMemo, useRef, useEffect } from "react";
import { useSettings } from "../../../context/settingsContext";
import IncomeTrendYearChart from "./IncomeTrendYearChart";
import IncomeTrendMonthPreview from "./IncomeTrendMonthPreview";
import IncomeTrendMonthDrilldown from "./IncomeTrendMonthDrilldown";
import IncomeFlowBar from "../IncomeFlowBar";
import {
  buildYearTrendRows,
} from "../../../utils/analyticsTrendUtils";
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
        />
      ) : (
        <>
          <div className="px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
            <h2
              id="income-trend-heading"
              className="text-sm font-semibold text-theme-text tracking-tight"
            >
              Net Remaining
            </h2>
            <p className="text-xs text-theme-muted mt-0.5">
              Cumulative all-time surplus or deficit, month by month
            </p>
          </div>

          <div className="px-4 pb-2 sm:px-5">
            <IncomeTrendYearChart
              rows={trendRows}
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
              onDismiss={() => onTrendStateChange({ trendMonth: null, trendDrilldown: false })}
            />
          )}
        </>
      )}
    </section>
  );
}
