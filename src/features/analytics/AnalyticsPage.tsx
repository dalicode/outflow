import { useState, useMemo, useEffect } from "react";

import { StorageService } from "../../services/storageService";
import { useSettings } from "../../context/settingsContext";
import {
  getYearFinancialSummary,
  getYearVariableGrid,
} from "../../utils/financeEngine";
import { cn } from "../../utils/cn";
import Strip from "../../components/ui/Strip";
import { useViewportWidth } from "../../hooks/useViewportWidth";
import { useMaxVisible } from "../../hooks/useMaxVisible";
import AnalyticsCharts from "./AnalyticsCharts";
import type {
  AnalyticsData,
  Expense,
  Category,
  YearSummary,
  VariableGridResult,
} from "../../types";
import "./analytics.css";

interface UseAnalyticsDataParams {
  expenses: Expense[];
  categories: Category[];
  year: number;
}

function useAnalyticsData({
  expenses,
  categories,
  year,
}: UseAnalyticsDataParams): AnalyticsData {
  const now = new Date();
  const [financials, setFinancials] = useState<YearSummary | null>(null);
  const [variableGrid, setVariableGrid] = useState<VariableGridResult | null>(
    null,
  );

  useEffect(() => {
    const load = async () => {
      const [
        snapshots,
        fixedDefs,
        globalIncome,
        globalRate,
        schedules,
        incomeSnaps,
        savingsSnaps,
      ] = await Promise.all([
        StorageService.getSnapshotsForYear(year),
        StorageService.getFixedExpenses(),
        StorageService.getSetting("monthlyIncome", 0),
        StorageService.getSetting("savingsRate", 0),
        StorageService.getActiveSchedules(),
        StorageService.getIncomeSnapshotsForYear(year),
        StorageService.getSavingsSnapshotsForYear(year),
      ]);

      const data: import("../../types").FinanceEngineData = {
        expenses,
        snapshots,
        fixedExpenses: fixedDefs,
        globalIncome: (globalIncome as number | null) ?? 0,
        globalSavingsRate: (globalRate as number | null) ?? 0,
        schedules,
        incomeSnapshots: incomeSnaps,
        savingsSnapshots: savingsSnaps,
      };

      const fin = getYearFinancialSummary(year, data, {
        currentYear: now.getFullYear(),
        currentMonth: now.getMonth(),
      });
      setFinancials(fin);

      const vGrid = getYearVariableGrid(year, expenses, categories);
      setVariableGrid(vGrid);
    };
    load();
  }, [year, expenses, categories]);

  const monthlyHasData = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const monthStr = String(m + 1).padStart(2, "0");
      return expenses.some((e) => e.date?.startsWith(`${year}-${monthStr}`));
    });
  }, [year, expenses]);

  return useMemo(() => {
    if (!financials || !variableGrid) {
      return {
        year,
        monthlyIncome: Array(12).fill(0),
        variableRows: [],
        grid: {},
        fixedRows: [],
        monthlyFixedTotals: Array(12).fill(0),
        monthlyVariableTotals: Array(12).fill(0),
        monthlyTotals: Array(12).fill(0),
        monthlySavings: Array(12).fill(null),
        monthlyRemaining: Array(12).fill(null),
        monthlyTotalSavings: Array(12).fill(null),
        monthlySavingsRates: Array(12).fill(0),
        monthlySavingsPct: Array(12).fill(null),
        monthlyHasData,
        yearVariableTotal: 0,
        yearFixedTotal: 0,
        yearTotal: 0,
        yearSavings: 0,
        yearRemaining: 0,
        yearTotalIncome: 0,
        avgSavingsPct: 0,
        maxPerMonth: Array(12).fill(0),
      };
    }

    const isCurrentYear = year === now.getFullYear();
    const currentMonthIdx = now.getMonth();

    // For current year, only count months up to and including current month
    const monthsToCount = isCurrentYear
      ? financials.months.slice(0, currentMonthIdx + 1)
      : financials.months;

    const yearTotalIncome = monthsToCount.reduce((s, m) => s + m.income, 0);
    const yearFixedTotal = monthsToCount.reduce(
      (s, m) => s + m.fixedExpensesTotal,
      0,
    );
    const yearSavings = monthsToCount.reduce((s, m) => s + m.autoSavings, 0);
    const yearRemaining = monthsToCount.reduce((s, m) => s + m.remaining, 0);
    const yearVariableTotal = monthsToCount.reduce(
      (s, m) => s + m.variableExpenses,
      0,
    );

    return {
      year,
      monthlyIncome: financials.months.map((m) => m.income),
      variableRows: variableGrid.variableRows,
      grid: variableGrid.grid,
      fixedRows: financials.fixedRows,
      monthlyFixedTotals: financials.monthlyFixedTotals,
      monthlyVariableTotals: financials.monthlyVariableTotals,
      monthlyTotals: financials.monthlyTotals,
      monthlySavings: financials.monthlySavings,
      monthlyRemaining: financials.monthlyRemaining,
      monthlyTotalSavings: financials.monthlyTotalSavings,
      monthlySavingsRates: financials.monthlySavingsRates,
      monthlySavingsPct: financials.monthlySavingsPct,
      monthlyHasData,
      yearVariableTotal,
      yearFixedTotal,
      yearTotal: yearFixedTotal + yearVariableTotal,
      yearSavings,
      yearRemaining,
      yearTotalIncome,
      avgSavingsPct: financials.totals.avgSavingsPct,
      maxPerMonth: variableGrid.maxPerMonth,
    };
  }, [year, financials, variableGrid, monthlyHasData]);
}

interface SummaryCardProps {
  label: string;
  value: string;
  tone: "success" | "danger" | "neutral";
}

const SummaryCard = ({ label, value, tone }: SummaryCardProps) => {
  const toneClass =
    tone === "success"
      ? "text-theme-success"
      : tone === "danger"
        ? "text-theme-danger"
        : "text-theme-text";

  return (
    <div className="summary-card">
      <div
        className={`text-xl md:text-2xl font-bold tabular-nums ${toneClass}`}
      >
        {value}
      </div>
      <div className="text-sm text-theme-muted mt-1 font-medium">{label}</div>
    </div>
  );
};

interface AnalyticsPageProps {
  expenses: Expense[];
  categories: Category[];
}

export default function AnalyticsPage({
  expenses,
  categories,
}: AnalyticsPageProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const viewportWidth = useViewportWidth();
  const maxVisible = useMaxVisible(viewportWidth);
  const { formatAmount } = useSettings();

  const data = useAnalyticsData({ expenses, categories, year });

  const canGoForward = year < currentYear;
  const lastMonth = year === currentYear ? currentMonth : year < currentYear ? 11 : -1;
  const availableMonths = useMemo(
    () => (lastMonth >= 0 ? Array.from({ length: lastMonth + 1 }, (_, i) => i) : []),
    [lastMonth],
  );

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    setSelectedMonth(null);
  };

  const prevMonth = () => {
    if (selectedMonth === null) {
      if (lastMonth >= 0) setSelectedMonth(0);
    } else if (selectedMonth > 0) {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === null) {
      if (lastMonth >= 0) setSelectedMonth(0);
    } else if (lastMonth >= 0 && selectedMonth < lastMonth) {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const canPrevMonth = selectedMonth === null ? lastMonth >= 0 : selectedMonth > 0;
  const canNextMonth = selectedMonth === null
    ? lastMonth >= 0
    : lastMonth >= 0 && selectedMonth < lastMonth;

  const yearStrip = useMemo(() => {
    const years = [];
    for (let i = -50; i <= 1; i++) {
      years.push(year + i);
    }
    return years;
  }, [year]);

  const monthScrollSelector = `[data-month="${selectedMonth ?? (year === currentYear ? currentMonth : 0)}"]`;

  const summaryCards = [
    {
      label: "Total Income",
      value: formatAmount(data.yearTotalIncome),
      tone: "success" as const,
    },
    {
      label: "Total Fixed",
      value: formatAmount(data.yearFixedTotal),
      tone: "danger" as const,
    },
    {
      label: "Total Savings",
      value: formatAmount(data.yearSavings),
      tone: data.yearSavings >= 0 ? ("success" as const) : ("danger" as const),
    },
    {
      label: "Total Remaining",
      value: formatAmount(data.yearRemaining),
      tone:
        data.yearRemaining >= 0 ? ("success" as const) : ("danger" as const),
    },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-theme-text tracking-tight">
        Analytics
      </h1>

      {/* Year strip */}
      <Strip
        maxVisible={Math.min(maxVisible, 5)}
        scrollClass="year-strip-scroll"
        scrollSelector="[data-selected='true']"
        navLeft={
          <>
            <button
              onClick={() => handleYearChange(year - 3)}
              className="year-nav-btn"
              aria-label="Previous 3 years"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 19l-7-7 7-7M11 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => handleYearChange(year - 1)}
              className="year-nav-btn"
              aria-label="Previous year"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </>
        }
        navRight={
          <>
            <button
              onClick={() => canGoForward && handleYearChange(year + 1)}
              disabled={!canGoForward}
              className={cn("year-nav-btn", !canGoForward && "opacity-40 cursor-not-allowed")}
              aria-label="Next year"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => year !== currentYear && handleYearChange(currentYear)}
              disabled={year === currentYear}
              className={cn("year-nav-btn", year === currentYear && "opacity-40 cursor-not-allowed")}
              aria-label="Go to current year"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
              </svg>
            </button>
          </>
        }
      >
        {yearStrip.map((y) => {
          const isSelected = y === year;
          const isFuture = y > currentYear;
          const isCurrent = y === currentYear;
          return (
            <button
              key={y}
              onClick={() => !isFuture && handleYearChange(y)}
              disabled={isFuture}
              className={cn(
                "year-pill",
                isSelected && "year-pill-selected",
                !isSelected && isCurrent && "year-pill-current",
              )}
              data-selected={isSelected || undefined}
              aria-label={String(y)}
              aria-current={isSelected ? "date" : undefined}
            >
              {y}
            </button>
          );
        })}
      </Strip>

      {/* Month strip */}
      <Strip
        maxVisible={maxVisible}
        scrollClass="month-strip-scroll"
        scrollSelector={monthScrollSelector}
        align="end"
        navLeft={
          <button
            onClick={prevMonth}
            className={cn("month-nav-btn", !canPrevMonth && "opacity-40 cursor-not-allowed")}
            disabled={!canPrevMonth}
            aria-label="Previous month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        beforeScroll={
          <div className="month-strip-item" data-month="yr">
            <span className="year-label">{year}</span>
            <button
              onClick={() => setSelectedMonth(null)}
              className={cn("month-pill", selectedMonth === null && "month-pill-selected")}
              aria-label="Year overview"
            >
              Yr
            </button>
          </div>
        }
        navRight={
          <button
            onClick={nextMonth}
            className={cn("month-nav-btn", !canNextMonth && "opacity-40 cursor-not-allowed")}
            disabled={!canNextMonth}
            aria-label="Next month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        }
      >
        {availableMonths.map((monthIdx) => {
          const isSelected = selectedMonth === monthIdx;
          const isRealCurrent = year === currentYear && monthIdx === currentMonth;
          const monthName = new Date(year, monthIdx).toLocaleString("default", { month: "short" });
          return (
            <div key={monthIdx} className="month-strip-item" data-month={monthIdx}>
              <span className="year-label invisible">{year}</span>
              <button
                onClick={() => setSelectedMonth(monthIdx)}
                className={cn(
                  "month-pill",
                  isSelected && "month-pill-selected",
                  !isSelected && isRealCurrent && "month-pill-current",
                )}
                aria-label={`${monthName} ${year}`}
                aria-current={isSelected ? "date" : undefined}
              >
                {monthName}
              </button>
            </div>
          );
        })}
      </Strip>

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
