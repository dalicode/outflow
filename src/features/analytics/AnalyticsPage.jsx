import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { StorageService } from "../../services/storageService";
import { useSettings } from "../../context/settingsContext";
import {
  getYearFinancialSummary,
  getYearVariableGrid,
} from "../../utils/financeEngine";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const pct = (n) => (n != null ? `${n.toFixed(1)}%` : "—");

// ── Analytics Data Hook ──────────────────────────────────────────────────────
// ALL calculations delegated to financeEngine.
// This hook only fetches raw data and passes it through.
function useAnalyticsData({ expenses, categories, year }) {
  const now = new Date();
  const [financials, setFinancials] = useState(null);
  const [variableGrid, setVariableGrid] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [
        snapshots,
        fixedDefs,
        globalIncome,
        globalRate,
        incomeRules,
        savingsRules,
        schedules,
      ] = await Promise.all([
        StorageService.getSnapshotsForYear(year),
        StorageService.getFixedExpenses(),
        StorageService.getSetting("monthlyIncome", 0),
        StorageService.getSetting("savingsRate", 0),
        StorageService.getSetting("yearlyIncomeOverrides", {}),
        StorageService.getSetting("yearlySavingsOverrides", {}),
        StorageService.getActiveSchedules(),
      ]);

      const data = {
        expenses,
        snapshots,
        fixedExpenses: fixedDefs,
        incomeRules,
        savingsRules,
        globalIncome,
        globalSavingsRate: globalRate,
        schedules,
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
      yearVariableTotal: financials.totals.totalVariable,
      yearFixedTotal: financials.totals.totalFixed,
      yearTotal: financials.totals.yearTotal,
      yearSavings: financials.totals.totalSavings,
      yearRemaining: financials.totals.totalRemaining,
      yearTotalIncome: financials.totals.totalIncome,
      avgSavingsPct: financials.totals.avgSavingsPct,
      maxPerMonth: variableGrid.maxPerMonth,
    };
  }, [year, financials, variableGrid, monthlyHasData]);
}

// ── Build flat row dataset for TanStack Table ────────────────────────────────
// Zero financial calculations — all values come pre-computed from the engine.
function buildTableRows(data) {
  const rows = [];

  // Fixed Expenses section
  rows.push({
    id: "sec-fixed",
    kind: "section",
    label: "Fixed Expenses",
    section: "fixed",
  });
  if (data.fixedRows.length === 0) {
    rows.push({
      id: "empty-fixed",
      kind: "empty",
      label: `No fixed expenses for ${data.year}.`,
    });
  } else {
    data.fixedRows.forEach((row) => {
      rows.push({
        id: `fixed-${row.id}`,
        kind: "fixed",
        label: row.name,
        amounts: row.amounts,
        yearTotal: row.yearTotal,
        isArchived: row.isArchived,
      });
    });
    rows.push({
      id: "sub-fixed",
      kind: "subtotal",
      label: "Total Fixed",
      amounts: data.monthlyFixedTotals,
      yearTotal: data.yearFixedTotal,
      section: "fixed",
    });
  }

  // Variable Expenses section
  rows.push({
    id: "sec-var",
    kind: "section",
    label: "Variable Expenses",
    section: "variable",
  });
  if (data.variableRows.length === 0) {
    rows.push({
      id: "empty-var",
      kind: "empty",
      label: `No variable expenses for ${data.year}.`,
    });
  } else {
    data.variableRows.forEach((row) => {
      rows.push({
        id: `var-${row.key}`,
        kind: "variable",
        label: row.name,
        amounts: row.amounts,
        yearTotal: row.yearTotal,
        maxPerMonth: data.maxPerMonth,
      });
    });
  }

  // Summary rows
  rows.push({
    id: "sum-total",
    kind: "summary",
    label: "Total Expenses",
    amounts: data.monthlyTotals,
    yearTotal: data.yearTotal,
  });
  rows.push({
    id: "sum-savings",
    kind: "summary",
    label: "Auto Savings",
    amounts: data.monthlySavings,
    yearTotal: data.yearSavings,
    isSavings: true,
  });
  rows.push({
    id: "sum-remaining",
    kind: "summary",
    label: "Remaining Budget",
    amounts: data.monthlyRemaining,
    yearTotal: data.yearRemaining,
    isRemaining: true,
  });
  rows.push({
    id: "sum-total-savings",
    kind: "summary",
    label: "Total Savings",
    amounts: data.monthlyTotalSavings,
    yearTotal: data.yearSavings + data.yearRemaining,
    isTotalSavings: true,
  });
  rows.push({
    id: "sum-pct",
    kind: "summary",
    label: "Savings %",
    amounts: data.monthlySavingsPct,
    yearTotal: data.avgSavingsPct,
    isPct: true,
  });

  return rows;
}

// ── Gradient helper for savings rows ─────────────────────────────────────────
// Maps savings ratio to a theme-aware red→green gradient using CSS color-mix().
// ≤ 0% = theme danger, ≥ (savingsRate × 1.5) = theme success,
// with perceptible 5% steps in between.
function getSavingsGradientColor(ratioPct, savingsRate) {
  if (ratioPct <= 0) return "var(--theme-danger)";
  const upperBound = savingsRate * 1.5;
  if (ratioPct >= upperBound) return "var(--theme-success)";
  // Quantize to nearest 5% for visible steps
  const stepped = Math.round((ratioPct / upperBound) * 20) / 20;
  const normalized = Math.max(0, Math.min(1, stepped));
  const dangerPct = Math.round((1 - normalized) * 100);
  const successPct = Math.round(normalized * 100);
  return `color-mix(in hsl, var(--theme-danger) ${dangerPct}%, var(--theme-success) ${successPct}%)`;
}

// ── Analytics Grid Component ─────────────────────────────────────────────────
export default function AnalyticsPage({ expenses, categories }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const { formatAmount, getNumberColorClass } = useSettings();
  const fmt = (n) => (n != null && n !== 0 ? formatAmount(n) : "—");

  const data = useAnalyticsData({ expenses, categories, year });

  const tableRows = useMemo(() => buildTableRows(data), [data]);

  const navigate = useNavigate();
  const goToMonth = (m) => navigate(`/?month=${m}&year=${year}`);

  // TanStack Table column definitions
  const columns = useMemo(() => {
    const monthCols = MONTHS.map((m, i) => ({
      accessorFn: (row) => row.amounts?.[i],
      id: `m${i}`,
      header: m,
      meta: { monthIndex: i },
    }));

    return [
      {
        accessorKey: "label",
        id: "label",
        header: "Category",
        meta: { isSticky: true },
      },
      ...monthCols,
      {
        accessorFn: (row) => row.yearTotal,
        id: "yearTotal",
        header: "Year Total",
        meta: { isYearTotal: true },
      },
    ];
  }, []);

  const table = useReactTable({
    data: tableRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const headerGroups = table.getHeaderGroups();
  const rowModel = table.getRowModel();

  // Styling helpers keyed by row.kind
  const kindStyles = {
    section: "",
    empty: "italic text-theme-muted/70",
    fixed: "",
    variable: "",
    subtotal: "",
    summary: "bg-theme-background",
  };

  const sectionBg = {
    fixed: "bg-orange-500/10",
    variable: "bg-blue-500/10",
  };
  const subtotalBg = {
    fixed: "bg-orange-500/15",
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="rounded-theme-large shadow-sm border border-theme-border bg-theme-surface overflow-hidden">
        {/* Year nav */}
        <div className="flex items-center justify-center gap-4 px-4 py-3 border-b border-theme-border">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="p-2 rounded-theme-small hover:bg-theme-background text-theme-muted hover:text-theme-text transition-colors"
          >
            &#8592;
          </button>
          <span className="text-lg font-semibold text-theme-text">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="p-2 rounded-theme-small hover:bg-theme-background text-theme-muted hover:text-theme-text transition-colors"
          >
            &#8594;
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs table-fixed border-collapse">
            <thead>
              {headerGroups.map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-theme-border"
                >
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta;
                    const isSticky = meta?.isSticky;
                    const isYearTotal = meta?.isYearTotal;
                    const baseTh =
                      "px-3 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wide whitespace-nowrap";
                    return (
                      <th
                        key={header.id}
                        className={`${baseTh} ${isSticky ? "sticky left-0 bg-theme-surface text-left z-10" : "text-center"} ${isYearTotal ? "bg-theme-primary/10 text-theme-primary" : ""} ${meta?.monthIndex != null ? "cursor-pointer hover:text-theme-primary hover:bg-theme-primary/5 transition-colors" : ""}`}
                        onClick={
                          meta?.monthIndex != null
                            ? () => goToMonth(meta.monthIndex)
                            : undefined
                        }
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {rowModel.rows.map((row) => {
                const kind = row.original.kind;
                const isArchived = row.original.isArchived;
                const baseTr = `border-b border-theme-border ${kindStyles[kind] || ""} ${isArchived ? "italic text-theme-muted/70" : ""}`;

                if (kind === "section") {
                  const secBg =
                    sectionBg[row.original.section] || "bg-theme-primary/5";
                  return (
                    <tr key={row.id} className={`${baseTr} ${secBg}`}>
                      {row.getVisibleCells().map((cell, cellIndex) => {
                        const colMeta = cell.column.columnDef.meta;
                        const isSticky = colMeta?.isSticky;
                        return (
                          <td
                            key={cell.id}
                            className={`px-3 py-1.5 text-xs font-semibold text-theme-muted uppercase tracking-wide whitespace-nowrap ${isSticky ? "sticky left-0 bg-theme-surface z-10" : ""}`}
                          >
                            {cellIndex === 0 ? row.original.label : ""}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }

                if (kind === "empty") {
                  return (
                    <tr key={row.id} className={baseTr}>
                      {row.getVisibleCells().map((cell, cellIndex) => {
                        const colMeta = cell.column.columnDef.meta;
                        const isSticky = colMeta?.isSticky;
                        return (
                          <td
                            key={cell.id}
                            className={`px-3 py-2 text-xs text-theme-muted italic whitespace-nowrap ${isSticky ? "sticky left-0 bg-theme-surface z-10" : ""}`}
                          >
                            {cellIndex === 0 ? row.original.label : ""}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }

                const rowBg =
                  kind === "subtotal" && row.original.section === "fixed"
                    ? "bg-orange-500/15"
                    : kind === "summary"
                      ? "bg-theme-background"
                      : "";

                return (
                  <tr
                    key={row.id}
                    className={`${baseTr} ${rowBg} transition-colors`}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const colMeta = cell.column.columnDef.meta;
                      const isSticky = colMeta?.isSticky;
                      const isYearTotal = colMeta?.isYearTotal;
                      const monthIndex = colMeta?.monthIndex;

                      let cellContent = flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      );

                      // Custom rendering for month / year-total cells
                      if (monthIndex != null) {
                        const val = row.original.amounts?.[monthIndex];

                        // Summary rows: show "—" if no variable expenses for this month
                        if (kind === "summary" && !data.monthlyHasData[monthIndex]) {
                          cellContent = (
                            <span className="text-theme-muted">—</span>
                          );
                        } else {
                          let cls =
                            val == null
                              ? "text-theme-muted"
                              : getNumberColorClass(val);
                          if (kind === "fixed")
                            cls =
                              val == null
                                ? "text-theme-muted"
                                : getNumberColorClass(val);
                          if (kind === "variable") {
                            cls =
                              val == null
                                ? "text-theme-muted"
                                : getNumberColorClass(val);
                          }
                          if (kind === "summary") {
                            if (row.original.id === "sum-remaining") {
                              cls =
                                val > 0
                                  ? "text-theme-success font-semibold"
                                  : val < 0
                                    ? "text-theme-danger font-semibold"
                                    : "text-theme-text font-semibold";
                            } else if (
                              row.original.id === "sum-total-savings" ||
                              row.original.id === "sum-pct"
                            ) {
                              cls = "font-semibold";
                            } else {
                              cls = "text-theme-primary font-semibold";
                            }
                          }
                          if (kind === "subtotal")
                            cls = "text-theme-primary font-semibold";

                          // Gradient color for Total Savings & Savings % rows
                          let gradientStyle;
                          if (kind === "summary") {
                            if (row.original.id === "sum-total-savings") {
                              const income = data.monthlyIncome[monthIndex];
                              const ratio = income > 0 ? ((val || 0) / income) * 100 : 0;
                              const rate = data.monthlySavingsRates[monthIndex];
                              gradientStyle = { color: getSavingsGradientColor(ratio, rate) };
                            } else if (row.original.id === "sum-pct") {
                              const rate = data.monthlySavingsRates[monthIndex];
                              gradientStyle = { color: getSavingsGradientColor(val || 0, rate) };
                            }
                          }

                          cellContent = (
                            <span className={cls} style={gradientStyle}>
                              {val == null
                                ? "—"
                                : row.original.isPct
                                  ? pct(val)
                                  : fmt(val)}
                            </span>
                          );
                        }
                      }

                      if (isYearTotal) {
                        const yt = row.original.yearTotal;
                        const hasAnyData = data.monthlyHasData.some(Boolean);

                        if (kind === "summary" && !hasAnyData) {
                          cellContent = (
                            <span className="text-theme-muted">—</span>
                          );
                        } else {
                          let cls =
                            row.original.id === "sum-remaining"
                              ? yt > 0
                                ? "font-semibold text-theme-success"
                                : yt < 0
                                  ? "font-semibold text-theme-danger"
                                  : "font-semibold text-theme-text"
                              : row.original.id === "sum-total-savings" || row.original.id === "sum-pct"
                                ? "font-semibold"
                                : "font-semibold text-theme-primary";

                          // Gradient color for year total of Total Savings & Savings %
                          let gradientStyle;
                          if (row.original.id === "sum-total-savings") {
                            const ratio = data.yearTotalIncome > 0 ? (yt / data.yearTotalIncome) * 100 : 0;
                            const avgRate = data.monthlySavingsRates.reduce((s, r) => s + r, 0) / 12;
                            gradientStyle = { color: getSavingsGradientColor(ratio, avgRate) };
                          } else if (row.original.id === "sum-pct") {
                            const avgRate = data.monthlySavingsRates.reduce((s, r) => s + r, 0) / 12;
                            gradientStyle = { color: getSavingsGradientColor(yt, avgRate) };
                          }

                          cellContent = (
                            <span className={cls} style={gradientStyle}>
                              {row.original.isPct
                                ? pct(yt)
                                : fmt(yt)}
                            </span>
                          );
                        }
                      }

                      if (isSticky) {
                        cellContent = (
                          <span
                            className={`text-xs font-medium ${isArchived ? "text-theme-muted" : "text-theme-text"}`}
                          >
                            {row.original.label}
                            {isArchived && (
                              <span className="ml-1 text-[0.625rem] text-theme-muted/60">
                                (Archived)
                              </span>
                            )}
                          </span>
                        );
                      }

                      return (
                        <td
                          key={cell.id}
                          className={`px-3 py-2 text-xs whitespace-nowrap ${isSticky ? "sticky left-0 bg-theme-surface z-10" : "text-right"} ${isYearTotal ? "bg-theme-primary/10" : ""}`}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
