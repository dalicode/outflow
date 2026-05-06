import { useSettings } from "../../context/settingsContext";
import { useViewportWidth } from "../../hooks/useViewportWidth";
import { useMaxVisible } from "../../hooks/useMaxVisible";
import { useAnalytics } from "../../hooks/useAnalytics";
import type { AnalyticsSessionState } from "../../hooks/useAnalytics";
import IncomeTrendSection from "./incomeTrend/IncomeTrendSection";
import YearStrip from "./YearStrip";
import type { Expense, Category, Payee } from "../../types";
import "./analytics.css";

interface AnalyticsPageProps {
  expenses: Expense[];
  categories: Category[];
  payees: Payee[];
  sessionState?: AnalyticsSessionState;
  onSessionStateChange?: (patch: Partial<AnalyticsSessionState>) => void;
}

export default function AnalyticsPage({
  expenses,
  categories,
  payees,
  sessionState,
  onSessionStateChange,
}: AnalyticsPageProps) {
  const viewportWidth = useViewportWidth();
  const maxVisible = useMaxVisible(viewportWidth);
  const { formatAmount } = useSettings();

  const {
    year,
    handleYearChange,
    currentYear,
    currentMonth,
    data,
    multiYearData,
    trendMonth,
    trendDrilldown,
  } = useAnalytics({ expenses, categories, sessionState, onSessionStateChange });
  const priorYearsData = multiYearData.filter((d) => d.year < year);
  const isCurrentYear = year === currentYear;
  const monthCount = isCurrentYear ? currentMonth + 1 : 12;

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6" data-testid="analytics-page">
      {/* Header */}
      <h1 className="text-2xl font-bold text-theme-text tracking-tight">
        Analytics
      </h1>

      {/* Year strip */}
      <YearStrip
        year={year}
        currentYear={currentYear}
        maxVisible={maxVisible}
        onYearChange={handleYearChange}
      />

      <IncomeTrendSection
        key={`income-trend-${year}`}
        data={data}
        expenses={expenses}
        categories={categories}
        payees={payees}
        year={year}
        currentYear={currentYear}
        currentMonth={currentMonth}
        priorYearsData={priorYearsData}
        multiYearData={multiYearData}
        trendMonth={trendMonth}
        trendDrilldown={trendDrilldown}
        onTrendStateChange={(patch) =>
          onSessionStateChange?.({ ...patch })
        }
        yearTotalIncome={data.yearTotalIncome}
        yearFixedTotal={data.yearFixedTotal}
        yearVariableTotal={data.yearVariableTotal}
        yearSavings={data.yearSavings}
        yearRemaining={data.yearRemaining}
        monthlyIncome={data.monthlyIncome}
        monthlyFixed={data.monthlyFixedTotals}
        monthlyVariable={data.monthlyVariableTotals}
        monthlySavings={data.monthlySavings}
        monthlyRemaining={data.monthlyRemaining}
        monthCount={monthCount}
        isCurrentYear={isCurrentYear}
      />
    </main>
  );
}
