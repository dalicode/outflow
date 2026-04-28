import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { useSettings } from "../../context/settingsContext";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtCompact(n) {
  if (n == null || isNaN(n)) return "$0";
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function fmtFull(n) {
  if (n == null || isNaN(n)) return "$0.00";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return "0%";
  return `${n.toFixed(1)}%`;
}

function useThemeColors() {
  const { currentTheme } = useSettings();
  return useMemo(() => {
    const p = currentTheme.colors.primary;
    const s = currentTheme.colors.secondary;
    const su = currentTheme.colors.success;
    const d = currentTheme.colors.danger;
    const t = currentTheme.colors.text;
    const m = currentTheme.colors.muted;
    return {
      primary: p,
      secondary: s,
      success: su,
      danger: d,
      text: t,
      muted: m,
      surface: currentTheme.colors.surface,
      background: currentTheme.colors.background,
      grid: currentTheme.colors.border,
      chartPalette: [
        p, s, su, d, t, m,
        "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4",
      ],
    };
  }, [currentTheme]);
}

// ── Month slicing helper ─────────────────────────────────────────────────────

function getMonthCount(year, currentYear, currentMonth) {
  if (year > currentYear) return 0;
  if (year === currentYear) return currentMonth + 1;
  return 12;
}

function sliceMonths(arr, count) {
  return arr.slice(0, count);
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, formatter, colors }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-lg border shadow-lg px-3 py-2 text-xs"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.grid,
        color: colors.text,
      }}
    >
      {label && (
        <div className="font-semibold mb-1" style={{ color: colors.text }}>
          {label}
        </div>
      )}
      {payload.map((entry, i) => {
        const value = formatter ? formatter(entry.value, entry.name) : entry.value;
        const displayValue = Array.isArray(value) ? value[0] : value;
        const displayName = Array.isArray(value) ? value[1] : entry.name;
        return (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="flex-1" style={{ color: colors.muted }}>
              {displayName}
            </span>
            <span className="font-medium" style={{ color: colors.text }}>
              {displayValue}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, subValue, accentColor, colors }) {
  return (
    <div
      className="rounded-xl border p-4 text-center"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.grid,
      }}
    >
      <div className="text-xs font-medium mb-1" style={{ color: colors.muted }}>
        {label}
      </div>
      <div className="text-xl font-bold" style={{ color: accentColor || colors.text }}>
        {value}
      </div>
      {subValue && (
        <div className="text-[0.6875rem] mt-0.5" style={{ color: colors.muted }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

// ── 1. Monthly Spending Trend ────────────────────────────────────────────────

function MonthlyTrendChart({ data, colors, monthCount }) {
  const chartData = useMemo(() => {
    return MONTHS.slice(0, monthCount).map((m, i) => ({
      month: m,
      total: data.monthlyTotals[i] || 0,
      savings: data.monthlyTotalSavings[i] || 0,
    }));
  }, [data, monthCount]);

  const hasData = chartData.some((d) => d.total > 0);
  if (!hasData) return <EmptyState label="No spending data" />;

  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <div className="min-w-[600px] md:min-w-0">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.5} />
            <XAxis dataKey="month" tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.grid }} />
            <YAxis tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickFormatter={fmtCompact} />
            <Tooltip
              content={
                <CustomTooltip
                  colors={colors}
                  formatter={(v, name) => [
                    fmtCompact(v),
                    name === "total" ? "Total Expenses" : "Total Savings",
                  ]}
                />
              }
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", color: colors.text }}
              formatter={(v) => (v === "total" ? "Total Expenses" : "Total Savings")}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={colors.primary}
              strokeWidth={2}
              fill="url(#trendGrad)"
              dot={{ r: 3, fill: colors.primary }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="savings"
              stroke={colors.success}
              strokeWidth={2}
              dot={{ r: 3, fill: colors.success }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── 2. Category Breakdown ────────────────────────────────────────────────────

function CategoryBreakdownChart({ data, colors, monthCount, selectedMonth }) {
  const pieData = useMemo(() => {
    const items = [];
    if (selectedMonth === null) {
      const fixedTotal = sliceMonths(data.monthlyFixedTotals, monthCount).reduce((s, v) => s + (v || 0), 0);
      if (fixedTotal > 0) {
        items.push({ name: "Fixed Expenses", value: fixedTotal });
      }
      (data.variableRows || []).forEach((row) => {
        const total = sliceMonths(row.amounts, monthCount).reduce((s, v) => s + (v || 0), 0);
        if (total > 0) items.push({ name: row.name, value: total });
      });
      const savingsTotal = sliceMonths(data.monthlyTotalSavings, monthCount).reduce((s, v) => s + (v || 0), 0);
      if (savingsTotal > 0) {
        items.push({ name: "Total Savings", value: savingsTotal });
      }
    } else {
      const m = selectedMonth;
      const fixedTotal = data.monthlyFixedTotals[m] || 0;
      if (fixedTotal > 0) {
        items.push({ name: "Fixed Expenses", value: fixedTotal });
      }
      (data.variableRows || []).forEach((row) => {
        const val = row.amounts?.[m] || 0;
        if (val > 0) items.push({ name: row.name, value: val });
      });
      const savingsTotal = data.monthlyTotalSavings[m] || 0;
      if (savingsTotal > 0) {
        items.push({ name: "Total Savings", value: savingsTotal });
      }
    }
    return items;
  }, [data, monthCount, selectedMonth]);

  const emptyLabel = selectedMonth === null ? "No category data" : `No data for ${MONTHS[selectedMonth]}`;
  if (pieData.length === 0) return <EmptyState label={emptyLabel} />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          label={({ name, percent }) =>
            percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
          }
          labelLine={false}
        >
          {pieData.map((_, i) => (
            <Cell key={i} fill={colors.chartPalette[i % colors.chartPalette.length]} />
          ))}
        </Pie>
        <Tooltip
          content={
            <CustomTooltip
              colors={colors}
              formatter={(v, name) => [fmtCompact(v), name]}
            />
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 3. Savings Rate Trend ────────────────────────────────────────────────────

function SavingsRateChart({ data, colors, monthCount }) {
  const chartData = useMemo(() => {
    return MONTHS.slice(0, monthCount).map((m, i) => ({
      month: m,
      rate: data.monthlySavingsPct[i] || 0,
    }));
  }, [data, monthCount]);

  const hasData = chartData.some((d) => d.rate !== 0 && d.rate != null);
  if (!hasData) return <EmptyState label="No savings data" />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.5} />
        <XAxis dataKey="month" tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.grid }} />
        <YAxis tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickFormatter={fmtPct} domain={[0, "auto"]} />
        <Tooltip
          content={
            <CustomTooltip
              colors={colors}
              formatter={(v) => [fmtPct(v), "Savings Rate"]}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke={colors.primary}
          strokeWidth={2}
          dot={{ r: 3, fill: colors.primary }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── 4. Monthly Total Savings ─────────────────────────────────────────────────

function MonthlyTotalSavingsChart({ data, colors, monthCount }) {
  const chartData = useMemo(() => {
    return MONTHS.slice(0, monthCount).map((m, i) => ({
      month: m,
      savings: data.monthlyTotalSavings[i] || 0,
    }));
  }, [data, monthCount]);

  const hasData = chartData.some((d) => d.savings !== 0 && d.savings != null);
  if (!hasData) return <EmptyState label="No savings data" />;

  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <div className="min-w-[600px] md:min-w-0">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.5} />
            <XAxis dataKey="month" tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.grid }} />
            <YAxis tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickFormatter={fmtCompact} />
            <Tooltip
              content={
                <CustomTooltip
                  colors={colors}
                  formatter={(v) => [fmtCompact(v), "Total Savings"]}
                />
              }
            />
            <Bar dataKey="savings" radius={[3, 3, 0, 0]} maxBarSize={32}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.savings >= 0 ? colors.success : colors.danger} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── 5. Income vs. Expenses ───────────────────────────────────────────────────

function IncomeVsExpensesChart({ data, colors, monthCount, selectedMonth }) {
  const chartData = useMemo(() => {
    if (selectedMonth !== null) {
      const m = selectedMonth;
      return [{
        month: MONTHS[m],
        income: data.monthlyIncome[m] || 0,
        expenses: data.monthlyTotals[m] || 0,
      }];
    }
    return MONTHS.slice(0, monthCount).map((m, i) => ({
      month: m,
      income: data.monthlyIncome[i] || 0,
      expenses: data.monthlyTotals[i] || 0,
    }));
  }, [data, monthCount, selectedMonth]);

  const hasData = chartData.some((d) => d.income > 0 || d.expenses > 0);
  if (!hasData) return <EmptyState label="No income/expense data" />;

  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <div className="min-w-[600px] md:min-w-0">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.5} />
            <XAxis dataKey="month" tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.grid }} />
            <YAxis tick={{ fill: colors.muted, fontSize: 12 }} axisLine={{ stroke: colors.grid }} tickFormatter={fmtCompact} />
            <Tooltip
              content={
                <CustomTooltip
                  colors={colors}
                  formatter={(v, name) => [
                    fmtCompact(v),
                    name === "income" ? "Income" : "Expenses",
                  ]}
                />
              }
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", color: colors.text }}
              formatter={(v) => (v === "income" ? "Income" : "Expenses")}
            />
            <Bar dataKey="income" fill={colors.success} radius={[3, 3, 0, 0]} maxBarSize={24} />
            <Bar dataKey="expenses" fill={colors.danger} radius={[3, 3, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Month View: Metric Cards ─────────────────────────────────────────────────

function MonthMetricCards({ data, selectedMonth, colors }) {
  const m = selectedMonth;
  const expenses = data.monthlyTotals[m] || 0;
  const income = data.monthlyIncome[m] || 0;
  const savingsRate = data.monthlySavingsPct[m] || 0;
  const totalSavings = data.monthlyTotalSavings[m] || 0;
  const remaining = data.monthlyRemaining[m] || 0;

  const savingsLabel = totalSavings >= 0 ? "Total Savings" : "Net Loss";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard
        label="Total Expenses"
        value={fmtFull(expenses)}
        accentColor={colors.danger}
        colors={colors}
      />
      <MetricCard
        label="Total Income"
        value={fmtFull(income)}
        accentColor={colors.success}
        colors={colors}
      />
      <MetricCard
        label="Savings Rate"
        value={fmtPct(savingsRate)}
        accentColor={colors.primary}
        colors={colors}
      />
      <MetricCard
        label={savingsLabel}
        value={fmtFull(Math.abs(totalSavings))}
        subValue={remaining !== 0 ? `Remaining: ${fmtCompact(remaining)}` : undefined}
        accentColor={totalSavings >= 0 ? colors.success : colors.danger}
        colors={colors}
      />
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ label }) {
  return (
    <div className="h-[200px] md:h-[260px] flex items-center justify-center">
      <span className="text-xs text-theme-muted">{label}</span>
    </div>
  );
}

// ── Chart Card Wrapper ───────────────────────────────────────────────────────

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl bg-theme-surface shadow-sm p-4">
      <h3 className="text-sm font-semibold text-theme-text mb-3">{title}</h3>
      {children}
    </div>
  );
}

// ── Year View Layout ─────────────────────────────────────────────────────────

function YearView({ data, colors, monthCount }) {
  return (
    <div className="space-y-4">
      {/* Row 1: Monthly Trend (full width) */}
      <ChartCard title="Monthly Spending Trend">
        <MonthlyTrendChart data={data} colors={colors} monthCount={monthCount} />
      </ChartCard>

      {/* Row 2: Breakdown + Savings (2-col on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Category Breakdown">
          <CategoryBreakdownChart data={data} colors={colors} monthCount={monthCount} selectedMonth={null} />
        </ChartCard>
        <ChartCard title="Savings Rate Trend">
          <SavingsRateChart data={data} colors={colors} monthCount={monthCount} />
        </ChartCard>
      </div>

      {/* Row 3: Monthly Total Savings + Income vs. Expenses (2-col on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Monthly Total Savings">
          <MonthlyTotalSavingsChart data={data} colors={colors} monthCount={monthCount} />
        </ChartCard>
        <ChartCard title="Income vs. Expenses">
          <IncomeVsExpensesChart data={data} colors={colors} monthCount={monthCount} selectedMonth={null} />
        </ChartCard>
      </div>
    </div>
  );
}

// ── Month View Layout ────────────────────────────────────────────────────────

function MonthView({ data, colors, selectedMonth }) {
  return (
    <div className="space-y-4">
      {/* Row 1: Metric cards */}
      <MonthMetricCards data={data} selectedMonth={selectedMonth} colors={colors} />

      {/* Row 2: Category Breakdown + Income vs. Expenses (2-col on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title={`${MONTHS[selectedMonth]} Breakdown`}>
          <CategoryBreakdownChart
            data={data}
            colors={colors}
            monthCount={0}
            selectedMonth={selectedMonth}
          />
        </ChartCard>
        <ChartCard title={`${MONTHS[selectedMonth]} Income vs. Expenses`}>
          <IncomeVsExpensesChart
            data={data}
            colors={colors}
            monthCount={0}
            selectedMonth={selectedMonth}
          />
        </ChartCard>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsCharts({ data, year, currentYear, currentMonth, selectedMonth }) {
  const colors = useThemeColors();
  const monthCount = getMonthCount(year, currentYear, currentMonth);

  return (
    <div className="space-y-4 p-4 md:p-5">
      {selectedMonth === null ? (
        <YearView data={data} colors={colors} monthCount={monthCount} />
      ) : (
        <MonthView data={data} colors={colors} selectedMonth={selectedMonth} />
      )}
    </div>
  );
}
