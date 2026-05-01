import { useSettings } from "../../context/settingsContext";
import { useViewportWidth } from "../../hooks/useViewportWidth";
import { useMaxVisible } from "../../hooks/useMaxVisible";
import { useAnalytics } from "../../hooks/useAnalytics";
import AnalyticsCharts from "./AnalyticsCharts";
import YearStrip from "./YearStrip";
import MonthStrip from "./MonthStrip";
import SummaryCard from "./SummaryCard";
import type { Expense, Category } from "../../types";
import "./analytics.css";

interface AnalyticsPageProps {
  expenses: Expense[];
  categories: Category[];
}

export default function AnalyticsPage({
  expenses,
  categories,
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
  } = useAnalytics({ expenses, categories, formatAmount });

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
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

      {/* Summary strip */}
      <div className="flex md:grid md:grid-cols-4 gap-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      {/* Content */}
      <div className="rounded-xl bg-theme-surface shadow-sm overflow-hidden">
        <AnalyticsCharts
          data={data}
          year={year}
          currentYear={currentYear}
          currentMonth={currentMonth}
          selectedMonth={selectedMonth}
        />
      </div>
    </main>
  );
}
