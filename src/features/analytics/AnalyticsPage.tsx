import { useState, useCallback, useMemo } from "react";
import { useSettings } from "../../context/settingsContext";
import { useViewportWidth } from "../../hooks/useViewportWidth";
import { useMaxVisible } from "../../hooks/useMaxVisible";
import { useAnalytics } from "../../hooks/useAnalytics";
import type { AnalyticsSessionState } from "../../hooks/useAnalytics";
import IncomeTrendSection from "./incomeTrend/IncomeTrendSection";
import YearStrip from "./YearStrip";
import type { AllTimeRow } from "../../utils/analyticsTrendUtils";
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
    currentYear,
    currentMonth,
    data,
    multiYearData,
    trendMonth,
    trendDrilldown,
  } = useAnalytics({
    expenses,
    categories,
    sessionState,
    onSessionStateChange,
  });

  // year and isCurrentYear are always fixed — the strip only pans the brush
  const year = currentYear;
  const priorYearsData = multiYearData.filter((d) => d.year < year);
  const isCurrentYear = true;
  const monthCount = currentMonth + 1;

  // Only show years that have loaded data
  const availableYears = useMemo(
    () => multiYearData.filter((d) => !d.loading).map((d) => d.year),
    [multiYearData],
  );

  // Brush window state lifted here so YearStrip can reflect active years
  const [brushWindow, setBrushWindow] = useState<AllTimeRow[] | null>(null);
  // Track the year the strip is currently positioned at (for chevron step back/forward)
  const [stripYear, setStripYear] = useState(currentYear);
  // Year to pan the brush to
  const [panToYear, setPanToYear] = useState<number | null>(null);
  const [panToYearVersion, setPanToYearVersion] = useState(0);

  // Derive which years are currently in the brush window
  const activeYears = brushWindow
    ? new Set(brushWindow.map((r) => r.year))
    : new Set([stripYear]);

  const handleYearPan = useCallback((y: number) => {
    setStripYear(y);
    setPanToYear(y);
    setPanToYearVersion((v) => v + 1);
  }, []);

  const handleBrushWindowChange = useCallback((window: AllTimeRow[]) => {
    setBrushWindow(window.length > 0 ? window : null);
    setPanToYear(null);
  }, []);

  return (
    <main
      className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6"
      data-testid="analytics-page"
    >
      <h1 className="text-2xl font-bold text-theme-text tracking-tight">
        Analytics
      </h1>

      <div className="space-y-6 max-w-6xl mx-auto">
        <YearStrip
          year={stripYear}
          currentYear={currentYear}
          maxVisible={maxVisible}
          availableYears={availableYears}
          onYearChange={handleYearPan}
          activeYears={activeYears}
        />

        <IncomeTrendSection
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
          onTrendStateChange={(patch) => onSessionStateChange?.({ ...patch })}
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
          panToYear={panToYear}
          panToYearVersion={panToYearVersion}
          onBrushWindowChange={handleBrushWindowChange}
        />
      </div>
    </main>
  );
}
