import { useState, useEffect, useMemo } from "react";

import { StorageService } from "../../services/storageService";
import { useSettings } from "../../context/settingsContext";
import {
  getYearFinancialSummary,
  getYearVariableGrid,
} from "../../utils/financeEngine";
import { cn } from "../../utils/cn";
import AnalyticsCharts from "./AnalyticsCharts";
import type { AnalyticsData, Expense, Category, YearSummary, VariableGridResult } from "../../types";
import "./analytics.css";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface UseAnalyticsDataParams {
  expenses: Expense[];
  categories: Category[];
  year: number;
}

function useAnalyticsData({ expenses, categories, year }: UseAnalyticsDataParams): AnalyticsData {
  const now = new Date();
  const [financials, setFinancials] = useState<YearSummary | null>(null);
  const [variableGrid, setVariableGrid] = useState<VariableGridResult | null>(null);

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
    const yearFixedTotal = monthsToCount.reduce((s, m) => s + m.fixedExpensesTotal, 0);
    const yearSavings = monthsToCount.reduce((s, m) => s + m.autoSavings, 0);
    const yearRemaining = monthsToCount.reduce((s, m) => s + m.remaining, 0);
    const yearVariableTotal = monthsToCount.reduce((s, m) => s + m.variableExpenses, 0);

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
      <div className={`text-xl md:text-2xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="text-sm text-theme-muted mt-1 font-medium">{label}</div>
    </div>
  );
}

interface AnalyticsPageProps {
  expenses: Expense[];
  categories: Category[];
}

export default function AnalyticsPage({ expenses, categories }: AnalyticsPageProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const { formatAmount } = useSettings();

  const data = useAnalyticsData({ expenses, categories, year });



  const canGoForward = year < currentYear;
  const monthCount = year === currentYear ? currentMonth + 1 : year < currentYear ? 12 : 0;
  const visibleMonths = MONTHS.slice(0, monthCount);

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    setSelectedMonth(null);
  };

  const yearStrip = useMemo(() => {
    const years = [];
    for (let i = -3; i <= 1; i++) {
      years.push(year + i);
    }
    return years;
  }, [year]);

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
      tone: data.yearRemaining >= 0 ? ("success" as const) : ("danger" as const),
    },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-theme-text tracking-tight">Analytics</h1>

        <div className="year-strip-scroll">
          <button
            onClick={() => handleYearChange(year - 1)}
            className="year-nav-btn"
            aria-label="Previous year"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

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
                aria-label={String(y)}
                aria-current={isSelected ? "date" : undefined}
              >
                {y}
              </button>
            );
          })}

          <button
            onClick={() => canGoForward && handleYearChange(year + 1)}
            disabled={!canGoForward}
            className={cn("year-nav-btn", !canGoForward && "opacity-40 cursor-not-allowed")}
            aria-label="Next year"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
          onClick={() => setSelectedMonth(null)}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
            selectedMonth === null
              ? "bg-theme-primary text-white"
              : "bg-theme-surface text-theme-muted hover:text-theme-text shadow-sm"
          )}
        >
          Year
        </button>
        {visibleMonths.map((m, i) => (
          <button
            key={m}
            onClick={() => setSelectedMonth(i)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
              selectedMonth === i
                ? "bg-theme-primary text-white"
                : "bg-theme-surface text-theme-muted hover:text-theme-text shadow-sm"
            )}
          >
            {m}
          </button>
        ))}
      </div>

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
