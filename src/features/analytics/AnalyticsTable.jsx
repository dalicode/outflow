import React, { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const pct = (n) => (n != null ? `${n.toFixed(1)}%` : "—");

function buildTableRows(data) {
  const rows = [];

  rows.push({ id: "sec-fixed", kind: "section", label: "Fixed Expenses", section: "fixed" });
  if (data.fixedRows.length === 0) {
    rows.push({ id: "empty-fixed", kind: "empty", label: `No fixed expenses for ${data.year}.` });
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

  rows.push({ id: "sec-var", kind: "section", label: "Variable Expenses", section: "variable" });
  if (data.variableRows.length === 0) {
    rows.push({ id: "empty-var", kind: "empty", label: `No variable expenses for ${data.year}.` });
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

  rows.push({ id: "sum-total", kind: "summary", label: "Total Expenses", amounts: data.monthlyTotals, yearTotal: data.yearTotal });
  rows.push({ id: "sum-savings", kind: "summary", label: "Auto Savings", amounts: data.monthlySavings, yearTotal: data.yearSavings, isSavings: true });
  rows.push({ id: "sum-remaining", kind: "summary", label: "Remaining Budget", amounts: data.monthlyRemaining, yearTotal: data.yearRemaining, isRemaining: true });
  rows.push({ id: "sum-total-savings", kind: "summary", label: "Total Savings", amounts: data.monthlyTotalSavings, yearTotal: data.yearSavings + data.yearRemaining, isTotalSavings: true });
  rows.push({ id: "sum-pct", kind: "summary", label: "Savings %", amounts: data.monthlySavingsPct, yearTotal: data.avgSavingsPct, isPct: true });

  return rows;
}

function getSavingsGradientColor(ratioPct, savingsRate) {
  if (ratioPct <= 0) return "var(--theme-danger)";
  const upperBound = savingsRate * 1.5;
  if (ratioPct >= upperBound) return "var(--theme-success)";
  const stepped = Math.round((ratioPct / upperBound) * 20) / 20;
  const normalized = Math.max(0, Math.min(1, stepped));
  const dangerPct = Math.round((1 - normalized) * 100);
  const successPct = Math.round(normalized * 100);
  return `color-mix(in hsl, var(--theme-danger) ${dangerPct}%, var(--theme-success) ${successPct}%)`;
}

export default function AnalyticsTable({ data, year, goToMonth, formatAmount, getNumberColorClass }) {
  const fmt = (n) => (n != null && n !== 0 ? formatAmount(n) : "—");
  const tableRows = useMemo(() => buildTableRows(data), [data]);

  const columns = useMemo(() => {
    const monthCols = MONTHS.map((m, i) => ({
      accessorFn: (row) => row.amounts?.[i],
      id: `m${i}`,
      header: m,
      meta: { monthIndex: i },
    }));

    return [
      { accessorKey: "label", id: "label", header: "Category", meta: { isSticky: true } },
      ...monthCols,
      { accessorFn: (row) => row.yearTotal, id: "yearTotal", header: "Year Total", meta: { isYearTotal: true } },
    ];
  }, []);

  const table = useReactTable({
    data: tableRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const headerGroups = table.getHeaderGroups();
  const rowModel = table.getRowModel();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead className="sticky top-0 z-20">
          {headerGroups.map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                const isSticky = meta?.isSticky;
                const isYearTotal = meta?.isYearTotal;
                const isMonth = meta?.monthIndex != null;

                return (
                  <th
                    key={header.id}
                    className={`
                      px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap
                      backdrop-blur-md bg-theme-surface/95
                      border-b border-theme-border
                      transition-colors duration-150
                      ${isSticky ? "sticky left-0 z-30 text-left border-r border-theme-border" : "text-center"}
                      ${isYearTotal ? "bg-theme-primary/[0.04] text-theme-primary" : "text-theme-muted"}
                      ${isMonth ? "cursor-pointer hover:text-theme-primary" : ""}
                    `}
                    onClick={isMonth ? () => goToMonth(meta.monthIndex) : undefined}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
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

            if (kind === "section") {
              const isFixed = row.original.section === "fixed";
              return (
                <tr key={row.id} className={isFixed ? "bg-theme-muted/[0.03]" : ""}>
                  {row.getVisibleCells().map((cell, cellIndex) => {
                    const colMeta = cell.column.columnDef.meta;
                    const isSticky = colMeta?.isSticky;
                    return (
                      <td
                        key={cell.id}
                        className={`
                          px-3 py-2 text-xs font-semibold uppercase tracking-wider text-theme-muted whitespace-nowrap
                          border-b border-theme-muted/10
                          ${isSticky ? "sticky left-0 bg-theme-surface z-10 border-r border-theme-border" : ""}
                        `}
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
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell, cellIndex) => {
                    const colMeta = cell.column.columnDef.meta;
                    const isSticky = colMeta?.isSticky;
                    return (
                      <td
                        key={cell.id}
                        className={`
                          px-3 py-2.5 text-sm text-theme-muted italic whitespace-nowrap
                          border-b border-theme-muted/10
                          ${isSticky ? "sticky left-0 bg-theme-surface z-10 border-r border-theme-border" : ""}
                        `}
                      >
                        {cellIndex === 0 ? row.original.label : ""}
                      </td>
                    );
                  })}
                </tr>
              );
            }

            const isSubtotalFixed = kind === "subtotal" && row.original.section === "fixed";
            const isSummary = kind === "summary";
            const rowBg = isSubtotalFixed
              ? "bg-theme-muted/[0.03]"
              : isSummary
                ? "bg-theme-primary/[0.03]"
                : "";

            return (
              <tr
                key={row.id}
                className={`
                  border-b border-theme-muted/10
                  transition-colors duration-150
                  hover:bg-theme-primary/[0.03]
                  ${rowBg}
                  ${isArchived ? "italic text-theme-muted/70" : ""}
                `}
              >
                {row.getVisibleCells().map((cell) => {
                  const colMeta = cell.column.columnDef.meta;
                  const isSticky = colMeta?.isSticky;
                  const isYearTotal = colMeta?.isYearTotal;
                  const monthIndex = colMeta?.monthIndex;

                  let cellContent = flexRender(cell.column.columnDef.cell, cell.getContext());

                  if (monthIndex != null) {
                    const val = row.original.amounts?.[monthIndex];

                    if (kind === "summary" && !data.monthlyHasData[monthIndex]) {
                      cellContent = <span className="text-theme-muted/50">—</span>;
                    } else {
                      let cls = val == null ? "text-theme-muted/50" : getNumberColorClass(val);
                      if (kind === "fixed") cls = val == null ? "text-theme-muted/50" : getNumberColorClass(val);
                      if (kind === "variable") cls = val == null ? "text-theme-muted/50" : getNumberColorClass(val);
                      if (kind === "summary") {
                        if (row.original.id === "sum-remaining") {
                          cls = val > 0 ? "text-theme-success font-semibold" : val < 0 ? "text-theme-danger font-semibold" : "text-theme-text font-semibold";
                        } else if (row.original.id === "sum-total-savings" || row.original.id === "sum-pct") {
                          cls = "font-semibold";
                        } else {
                          cls = "text-theme-primary font-semibold";
                        }
                      }
                      if (kind === "subtotal") cls = "text-theme-primary font-semibold";

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
                          {val == null ? "—" : row.original.isPct ? pct(val) : fmt(val)}
                        </span>
                      );
                    }
                  }

                  if (isYearTotal) {
                    const yt = row.original.yearTotal;
                    const hasAnyData = data.monthlyHasData.some(Boolean);

                    if (kind === "summary" && !hasAnyData) {
                      cellContent = <span className="text-theme-muted/50">—</span>;
                    } else {
                      let cls = row.original.id === "sum-remaining"
                        ? yt > 0 ? "font-semibold text-theme-success" : yt < 0 ? "font-semibold text-theme-danger" : "font-semibold text-theme-text"
                        : row.original.id === "sum-total-savings" || row.original.id === "sum-pct"
                          ? "font-semibold"
                          : "font-semibold text-theme-primary";

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
                          {row.original.isPct ? pct(yt) : fmt(yt)}
                        </span>
                      );
                    }
                  }

                  if (isSticky) {
                    cellContent = (
                      <span className={`text-sm font-medium ${isArchived ? "text-theme-muted" : "text-theme-text"}`}>
                        {row.original.label}
                        {isArchived && <span className="ml-1.5 text-xs text-theme-muted/60">(Archived)</span>}
                      </span>
                    );
                  }

                  return (
                    <td
                      key={cell.id}
                      className={`
                        px-3 py-2.5 whitespace-nowrap text-sm tabular-nums
                        border-b border-theme-muted/10
                        transition-colors duration-150
                        ${isSticky ? "sticky left-0 bg-theme-surface z-10 border-r border-theme-border text-left" : "text-right"}
                        ${isYearTotal ? "bg-theme-primary/[0.03] font-semibold" : ""}
                      `}
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
  );
}
