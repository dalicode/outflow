import { useMemo } from "react";
import { cn } from "../../../utils/cn";
import { buildMonthDrilldownData } from "../../../utils/analyticsTrendUtils";
import IncomeTrendDrilldownHeader from "./IncomeTrendDrilldownHeader";
import IncomeTrendDailyChart from "./IncomeTrendDailyChart";
import IncomeTrendCategoryBreakdown from "./IncomeTrendCategoryBreakdown";
import IncomeTrendPayeeHighlights from "./IncomeTrendPayeeHighlights";
import IncomeTrendExpensePreview from "./IncomeTrendExpensePreview";
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
}: IncomeTrendMonthDrilldownProps) {
  const drilldownData = useMemo(
    () => buildMonthDrilldownData(data, expenses, year, monthIndex),
    [data, expenses, year, monthIndex],
  );

  const hasPayees = drilldownData.payeeBreakdown.length > 0;

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
        <div className="px-4 py-4 sm:px-5 bg-theme-surface">
          <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
            By Category
          </h3>
          <IncomeTrendCategoryBreakdown
            rows={drilldownData.categoryBreakdown}
            formatAmount={formatAmount}
          />
        </div>

        {hasPayees && (
          <div className="px-4 py-4 sm:px-5 bg-theme-surface border-t border-theme-border md:border-t-0">
            <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
              Top Payees
            </h3>
            <IncomeTrendPayeeHighlights
              rows={drilldownData.payeeBreakdown}
              formatAmount={formatAmount}
            />
          </div>
        )}

        <div
          className={cn(
            "px-4 py-4 sm:px-5 bg-theme-surface border-t border-theme-border",
            !hasPayees && "md:col-span-2",
          )}
        >
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
