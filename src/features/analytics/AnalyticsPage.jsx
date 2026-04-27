import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { StorageService } from "../../services/storageService";
import { useSettings } from "../../context/settingsContext";

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

// ── Precompute analytics dataset (unchanged logic) ────────────────────────────
function useAnalyticsData({ expenses, categories, year }) {
  const now = new Date();
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [snapshots, setSnapshots] = useState([]);

  useEffect(() => {
    Promise.all([
      StorageService.getSetting("monthlyIncome", 0),
      StorageService.getFixedExpenses(),
    ]).then(([income, fixed]) => {
      setMonthlyIncome(income);
      setFixedExpenses(fixed);
    });
  }, []);

  useEffect(() => {
    StorageService.getSnapshotsForYear(year).then(setSnapshots);
  }, [year]);

  const activeCategories = useMemo(
    () => categories.filter((c) => !c.isDeleted),
    [categories],
  );
  // catMap is available in parent components if needed

  const yearExpenses = useMemo(
    () => expenses.filter((e) => e.date.startsWith(`${year}-`)),
    [expenses, year],
  );

  const grid = useMemo(() => {
    const g = {};
    yearExpenses.forEach((e) => {
      const key =
        e.categoryId != null
          ? String(e.categoryId)
          : e.category || "Uncategorized";
      const m = parseInt(e.date.slice(5, 7), 10) - 1;
      if (!g[key]) g[key] = Array(12).fill(0);
      g[key][m] += e.amount;
    });
    return g;
  }, [yearExpenses]);

  const variableRows = useMemo(() => {
    const result = [];
    const covered = new Set();
    activeCategories.forEach((cat) => {
      const key = String(cat.id);
      if (grid[key]) {
        result.push({ key, name: cat.name });
        covered.add(key);
      }
    });
    Object.keys(grid).forEach((key) => {
      if (!covered.has(key)) result.push({ key, name: key });
    });
    return result;
  }, [activeCategories, grid]);

  const monthlyVariableTotals = useMemo(
    () =>
      MONTHS.map((_, m) =>
        variableRows.reduce((s, r) => s + (grid[r.key]?.[m] ?? 0), 0),
      ),
    [variableRows, grid],
  );

  const fixedSnapshotGrid = useMemo(() => {
    const map = {};
    snapshots.forEach((s) => {
      const m = s.month - 1;
      if (!map[s.fixedExpenseId]) {
        map[s.fixedExpenseId] = {
          name: s.nameSnapshot,
          amounts: Array(12).fill(0),
        };
      }
      map[s.fixedExpenseId].amounts[m] = s.amountSnapshot;
      map[s.fixedExpenseId].name = s.nameSnapshot;
    });
    return map;
  }, [snapshots]);

  const fixedRows = useMemo(() => {
    const isCurrentYear = year === now.getFullYear();
    const currentMonth = now.getMonth();
    const rows = { ...fixedSnapshotGrid };
    if (isCurrentYear) {
      fixedExpenses.forEach((f) => {
        const key = f.id;
        if (!rows[key])
          rows[key] = { name: f.name, amounts: Array(12).fill(0) };
        for (let m = 0; m <= currentMonth; m++) {
          if (rows[key].amounts[m] === 0) rows[key].amounts[m] = f.amount;
        }
      });
    }
    return Object.entries(rows).map(([id, { name, amounts }]) => ({
      id,
      name,
      amounts,
    }));
  }, [fixedSnapshotGrid, fixedExpenses, year]);

  const monthlyFixedTotals = useMemo(
    () =>
      MONTHS.map((_, m) =>
        fixedRows.reduce((s, r) => s + (r.amounts[m] ?? 0), 0),
      ),
    [fixedRows],
  );

  const monthlyTotals = useMemo(
    () =>
      MONTHS.map((_, m) => monthlyVariableTotals[m] + monthlyFixedTotals[m]),
    [monthlyVariableTotals, monthlyFixedTotals],
  );

  const currentMonth = now.getMonth();
  const isCurrentYear = year === now.getFullYear();
  const isFutureMonth = (m) =>
    year > now.getFullYear() || (isCurrentYear && m > currentMonth);

  const monthlySavings = useMemo(
    () =>
      monthlyTotals.map((spent, m) =>
        isFutureMonth(m) ? null : monthlyIncome - spent,
      ),
    [monthlyTotals, monthlyIncome, isCurrentYear, currentMonth],
  );

  const monthlySavingsPct = useMemo(
    () =>
      monthlySavings.map((s) =>
        s == null ? null : monthlyIncome > 0 ? (s / monthlyIncome) * 100 : 0,
      ),
    [monthlySavings, monthlyIncome],
  );

  const yearVariableTotal = monthlyVariableTotals.reduce((s, v) => s + v, 0);
  const yearFixedTotal = monthlyFixedTotals.reduce((s, v) => s + v, 0);
  const yearTotal = monthlyTotals.reduce((s, v) => s + v, 0);
  const validSavings = monthlySavings.filter((v) => v != null);
  const yearSavings = validSavings.reduce((s, v) => s + v, 0);
  const avgSavingsPct =
    monthlyIncome > 0 && validSavings.length > 0
      ? (yearSavings / (monthlyIncome * validSavings.length)) * 100
      : 0;

  const maxPerMonth = useMemo(
    () =>
      MONTHS.map((_, m) =>
        Math.max(0, ...variableRows.map((r) => grid[r.key]?.[m] ?? 0)),
      ),
    [variableRows, grid],
  );

  return {
    year,
    monthlyIncome,
    variableRows,
    grid,
    fixedRows,
    monthlyFixedTotals,
    monthlyVariableTotals,
    monthlyTotals,
    monthlySavings,
    monthlySavingsPct,
    yearVariableTotal,
    yearFixedTotal,
    yearTotal,
    yearSavings,
    avgSavingsPct,
    maxPerMonth,
  };
}

// ── Build flat row dataset for TanStack Table ────────────────────────────────
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
      const total = row.amounts.reduce((s, v) => s + v, 0);
      rows.push({
        id: `fixed-${row.id}`,
        kind: "fixed",
        label: row.name,
        amounts: row.amounts,
        yearTotal: total,
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
      const vals = data.grid[row.key] ?? Array(12).fill(0);
      const total = vals.reduce((s, v) => s + v, 0);
      rows.push({
        id: `var-${row.key}`,
        kind: "variable",
        label: row.name,
        amounts: vals,
        yearTotal: total,
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
    label: "Total Savings",
    amounts: data.monthlySavings,
    yearTotal: data.yearSavings,
    isSavings: true,
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
                const baseTr = `border-b border-theme-border ${kindStyles[kind] || ""}`;

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
                        let cls =
                          val == null
                            ? "text-theme-muted/50"
                            : getNumberColorClass(val);
                        if (kind === "fixed")
                          cls =
                            val == null
                              ? "text-theme-muted/50"
                              : getNumberColorClass(val);
                        if (kind === "variable") {
                          cls =
                            val == null
                              ? "text-theme-muted/50"
                              : getNumberColorClass(val);
                        }
                        if (kind === "summary") {
                          cls = "text-theme-primary font-semibold";
                        }
                        if (kind === "subtotal")
                          cls = "text-theme-primary font-semibold";
                        cellContent = (
                          <span className={cls}>
                            {val == null
                              ? "—"
                              : row.original.isPct
                                ? pct(val)
                                : fmt(val)}
                          </span>
                        );
                      }

                      if (isYearTotal) {
                        let cls = "font-semibold text-theme-primary";
                        cellContent = (
                          <span className={cls}>
                            {row.original.isPct
                              ? pct(row.original.yearTotal)
                              : fmt(row.original.yearTotal)}
                          </span>
                        );
                      }

                      if (isSticky) {
                        cellContent = (
                          <span className="text-xs font-medium text-theme-text">
                            {row.original.label}
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
