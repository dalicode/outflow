import { useMemo, useState } from "react";
import { buildMonthDrilldownData } from "../../../utils/analyticsTrendUtils";
import IncomeTrendDrilldownHeader from "./IncomeTrendDrilldownHeader";
import IncomeTrendDailyChart from "./IncomeTrendDailyChart";
import IncomeTrendExpensePreview from "./IncomeTrendExpensePreview";
import YearOverYearChart from "../YearOverYearChart";
import {
  RankedCategoryViz,
  RankedPayeeViz,
  RankedCategoryTable,
  RankedPayeeTable,
  ViewToggle,
} from "../AnalyticsCharts";
import type { AnalyticsData, Expense, Category, Payee } from "../../../types";
import type { ThemeColors } from "../AnalyticsCharts";

interface IncomeTrendMonthDrilldownProps {
  data: AnalyticsData;
  expenses: Expense[];
  categories: Category[];
  payees: Payee[];
  year: number;
  monthIndex: number;
  cumulativeRemaining: number;
  colors: ThemeColors;
  formatAmount: (n: number) => string;
  formatDate: (iso: string) => string;
  onBack: () => void;
  multiYearData: AnalyticsData[];
}

export default function IncomeTrendMonthDrilldown({
  data,
  expenses,
  categories,
  payees,
  year,
  monthIndex,
  cumulativeRemaining,
  colors,
  formatAmount,
  formatDate,
  onBack,
  multiYearData,
}: IncomeTrendMonthDrilldownProps) {
  const drilldownData = useMemo(
    () => buildMonthDrilldownData(data, expenses, year, monthIndex),
    [data, expenses, year, monthIndex],
  );

  const [catViz, setCatViz] = useState(true);
  const [payeeViz, setPayeeViz] = useState(true);

  return (
    <div className="motion-fade-up" data-testid="income-trend-drilldown">
      <IncomeTrendDrilldownHeader
        monthLabel={drilldownData.monthLabel}
        year={year}
        income={drilldownData.income}
        expenses={drilldownData.expenses}
        saved={drilldownData.saved}
        savingsRate={drilldownData.savingsRate}
        cumulativeRemaining={cumulativeRemaining}
        colors={colors}
        formatAmount={formatAmount}
        onBack={onBack}
      />

      <div className="px-4 pt-4 pb-2 sm:px-5">
        <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
          Daily Spending
        </h3>
        <IncomeTrendDailyChart
          rows={drilldownData.dailyRows}
          colors={colors}
          formatAmount={formatAmount}
          monthLabel={drilldownData.monthLabel}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-px md:bg-theme-border">
        {/* Category Movement */}
        <div className="px-4 py-4 sm:px-5 bg-theme-surface">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
              Category Movement
            </h3>
            <ViewToggle isViz={catViz} onToggle={() => setCatViz((v) => !v)} />
          </div>
          {catViz ? (
            <RankedCategoryViz
              data={data}
              focusMonth={monthIndex}
              colors={colors}
              formatAmount={formatAmount}
            />
          ) : (
            <RankedCategoryTable
              data={data}
              focusMonth={monthIndex}
              focusLabel={drilldownData.monthLabel}
            />
          )}
        </div>

        {/* Payee Concentration */}
        <div className="px-4 py-4 sm:px-5 bg-theme-surface border-t border-theme-border md:border-t-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
              Payee Concentration
            </h3>
            <ViewToggle
              isViz={payeeViz}
              onToggle={() => setPayeeViz((v) => !v)}
            />
          </div>
          {payeeViz ? (
            <RankedPayeeViz
              data={data}
              focusMonth={monthIndex}
              colors={colors}
              formatAmount={formatAmount}
            />
          ) : (
            <RankedPayeeTable
              data={data}
              focusMonth={monthIndex}
              focusLabel={drilldownData.monthLabel}
            />
          )}
        </div>
      </div>
      {/* YoY + Top Expenses — side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-px md:bg-theme-border border-t border-theme-border">
        {/* Year over Year */}
        <div className="px-4 py-4 sm:px-5 bg-theme-surface">
          <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
            Year over Year
          </h3>
          <YearOverYearChart
            multiYearData={multiYearData}
            selectedMonth={monthIndex}
            colors={colors}
            monthLabel={drilldownData.monthLabel}
          />
        </div>

        {/* Top Expenses */}
        <div className="px-4 py-4 sm:px-5 bg-theme-surface border-t border-theme-border md:border-t-0">
          <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
            Top Expenses
          </h3>
          <IncomeTrendExpensePreview
            expenses={drilldownData.expensePreview}
            categories={categories}
            payees={payees}
            formatAmount={formatAmount}
            formatDate={formatDate}
          />
        </div>
      </div>
    </div>
  );
}
