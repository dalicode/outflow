import { useSettings } from "../../context/settingsContext";
import { useViewportWidth } from "../../hooks/useViewportWidth";
import { useMaxVisible } from "../../hooks/useMaxVisible";
import { useAnalytics } from "../../hooks/useAnalytics";
import type { AnalyticsSessionState } from "../../hooks/useAnalytics";
import AnalyticsCharts from "./AnalyticsCharts";
import AnalyticsOverviewSection from "./AnalyticsOverviewSection";
import IncomeTrendSection from "./incomeTrend/IncomeTrendSection";
import YearStrip from "./YearStrip";
import MonthStrip from "./MonthStrip";
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
    selectedMonth,
    setSelectedMonth,
    handleYearChange,
    currentYear,
    currentMonth,
    availableMonths,
    prevMonth,
    nextMonth,
    jumpBackMonths,
    jumpToCurrentMonth,
    isAtCurrentMonth,
    canPrevMonth,
    canNextMonth,
    summaryCards,
    data,
    multiYearData,
    trendMonth,
    trendDrilldown,
  } = useAnalytics({ expenses, categories, formatAmount, sessionState, onSessionStateChange });
  const contentMotionKey = `${year}-${selectedMonth ?? "all"}`;
  const priorYearsData = multiYearData.filter((d) => d.year < year);

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

      {/* Month strip */}
      <MonthStrip
        year={year}
        currentYear={currentYear}
        currentMonth={currentMonth}
        selectedMonth={selectedMonth}
        maxVisible={maxVisible}
        availableMonths={availableMonths}
        onSelectMonth={setSelectedMonth}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onJumpBack={jumpBackMonths}
        onJumpForward={jumpToCurrentMonth}
        canPrevMonth={canPrevMonth}
        canNextMonth={canNextMonth}
        isAtCurrentMonth={isAtCurrentMonth}
      />

      <AnalyticsOverviewSection
        data={data}
        year={year}
        currentYear={currentYear}
        currentMonth={currentMonth}
        selectedMonth={selectedMonth}
        summaryCards={summaryCards}
        formatAmount={formatAmount}
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
        trendMonth={trendMonth}
        trendDrilldown={trendDrilldown}
        onTrendStateChange={(patch) =>
          onSessionStateChange?.({ ...patch })
        }
      />

      {/* Content */}
      <div
        key={`charts-${contentMotionKey}`}
        className="motion-fade-up rounded-theme-large bg-theme-surface shadow-sm overflow-hidden"
      >
        <AnalyticsCharts
          data={data}
          multiYearData={multiYearData}
          year={year}
          currentYear={currentYear}
          currentMonth={currentMonth}
          selectedMonth={selectedMonth}
        />
      </div>
    </main>
  );
}
