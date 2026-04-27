/**
 * Financial Timeline Engine
 * ─────────────────────────
 * Pure, framework-agnostic financial computation layer.
 * All income, savings, fixed-expense, and budget calculations live here.
 *
 * RULES
 * - No side effects (no DB writes, no network, no DOM)
 * - No React hooks or UI logic
 * - Identical inputs → identical outputs everywhere
 * - Legacy data formats auto-migrated on read
 */

// ── Type Definitions ────────────────────────────────────────────────────────

/**
 * @typedef {Object} FinanceEngineData
 * @property {Array<{date:string,amount:number,category?:string,categoryId?:number}>} expenses
 * @property {Array<{fixedExpenseId:number,year:number,month:number,amountSnapshot:number,nameSnapshot:string}>} snapshots
 * @property {Array<{id:number,name:string,amount:number,isArchived?:boolean}>} fixedExpenses
 * @property {Object} incomeRules   — yearlyIncomeOverrides
 * @property {Object} savingsRules  — yearlySavingsOverrides
 * @property {number} globalIncome
 * @property {number} globalSavingsRate
 */

/**
 * @typedef {Object} MonthlySummary
 * @property {number} income
 * @property {number} fixedExpensesTotal
 * @property {number} savingsRate
 * @property {number} autoSavings
 * @property {number} remaining
 * @property {number} variableExpenses
 * @property {Array<{id:number|string,name:string,amount:number,isArchived:boolean}>} fixedExpenses
 */

/**
 * @typedef {Object} YearSummary
 * @property {MonthlySummary[]} months
 * @property {Object} totals
 * @property {number} totals.totalIncome
 * @property {number} totals.totalFixed
 * @property {number} totals.totalVariable
 * @property {number} totals.totalSavings
 * @property {number} totals.totalRemaining
 * @property {number} totals.avgSavingsPct
 * @property {number[]} monthlyFixedTotals
 * @property {number[]} monthlyVariableTotals
 * @property {number[]} monthlyTotals
 * @property {number[]} monthlySavings
 * @property {(number|null)[]} monthlySavingsPct
 * @property {FixedRow[]} fixedRows
 */

/**
 * @typedef {Object} FixedRow
 * @property {string} id
 * @property {string} name
 * @property {number[]} amounts  // 12 monthly values
 * @property {boolean} isArchived
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Resolve per-month values for a year from rules + global fallback.
 * Handles legacy {2023: 5000} → auto-expands to 12 months.
 */
function resolveMonthlyValues(year, rules, globalValue) {
  const yearRules = rules?.[year];

  // Legacy format: plain number for the whole year
  if (typeof yearRules === "number") {
    return Array(12).fill(yearRules);
  }

  // New format: nested object { 1: 5000, 2: 5200, ... }
  if (yearRules && typeof yearRules === "object") {
    return Array.from({ length: 12 }, (_, m) => {
      const month = m + 1;
      return month in yearRules ? yearRules[month] : globalValue;
    });
  }

  // No rule for this year — fall back to global
  return Array(12).fill(globalValue);
}

/**
 * Build year-level fixed-expense rows from snapshots.
 * Snapshots are pre-augmented with virtual entries for current/future months
 * so this function just reads them directly.
 */
function buildYearFixedRows(year, snapshots, fixedDefinitions) {
  const rows = {};

  snapshots.forEach((s) => {
    if (s.year !== year) return;
    const m = s.month - 1; // 0-indexed
    const key = String(s.fixedExpenseId);
    if (!rows[key]) {
      rows[key] = { name: s.nameSnapshot, amounts: Array(12).fill(0) };
    }
    rows[key].amounts[m] = s.amountSnapshot;
    rows[key].name = s.nameSnapshot;
  });

  const archivedIds = new Set(
    (fixedDefinitions || [])
      .filter((f) => f.isArchived === true)
      .map((f) => String(f.id)),
  );

  return Object.entries(rows).map(([id, { name, amounts }]) => ({
    id,
    name,
    amounts,
    yearTotal: amounts.reduce((s, v) => s + v, 0),
    isArchived: archivedIds.has(id),
  }));
}

/**
 * Get fixed expenses for a specific month.
 */
function getFixedExpensesForMonth(year, month, snapshots, fixedDefinitions) {
  // month is 0-indexed (0-11)
  const targetMonth = month + 1;
  const monthSnaps = snapshots.filter(
    (s) => s.year === year && s.month === targetMonth,
  );

  const defMap = new Map((fixedDefinitions || []).map((f) => [String(f.id), f]));

  const items = monthSnaps.map((s) => ({
    id: s.fixedExpenseId,
    name: s.nameSnapshot,
    amount: s.amountSnapshot,
    isArchived: defMap.get(String(s.fixedExpenseId))?.isArchived === true,
  }));

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return { total, items };
}

/**
 * Get variable expenses for a specific month.
 */
function getVariableExpensesForMonth(year, month, expenses) {
  const monthStr = String(month + 1).padStart(2, "0");
  const prefix = `${year}-${monthStr}`;
  return (expenses || [])
    .filter((e) => e.date && e.date.startsWith(prefix))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute the financial summary for a single month.
 * @param {number} year
 * @param {number} month  — 0-indexed (0-11)
 * @param {FinanceEngineData} data
 * @returns {MonthlySummary}
 */
export function getMonthlyFinancialSummary(year, month, data) {
  const {
    expenses,
    snapshots,
    fixedExpenses,
    incomeRules,
    savingsRules,
    globalIncome,
    globalSavingsRate,
  } = data;

  const incomeValues = resolveMonthlyValues(year, incomeRules, globalIncome);
  const savingsRateValues = resolveMonthlyValues(year, savingsRules, globalSavingsRate);

  const income = incomeValues[month] || 0;
  const savingsRate = savingsRateValues[month] || 0;

  const fixedResult = getFixedExpensesForMonth(year, month, snapshots, fixedExpenses);
  const fixedExpensesTotal = fixedResult.total;

  const variableExpenses = getVariableExpensesForMonth(year, month, expenses);

  const autoSavings = Math.max(0, income * (savingsRate / 100));
  const remaining = income - fixedExpensesTotal - autoSavings - variableExpenses;

  return {
    income,
    fixedExpensesTotal,
    savingsRate,
    autoSavings,
    remaining,
    variableExpenses,
    fixedExpenses: fixedResult.items,
  };
}

/**
 * Compute the full financial summary for a year.
 * @param {number} year
 * @param {FinanceEngineData} data
 * @param {Object} opts
 * @param {boolean} [opts.isCurrentYear]  — fill active defs for current year
 * @param {number} [opts.currentMonth]    — 0-indexed, used with isCurrentYear
 * @returns {YearSummary}
 */
export function getYearFinancialSummary(year, data, opts = {}) {
  const { currentYear, currentMonth = 11 } = opts;
  const nowYear = currentYear ?? new Date().getFullYear();
  const nowMonth = currentMonth;

  // ── Augment snapshots with virtual entries for current/future months ──
  // Active fixed expenses are projected forward so Analytics shows them
  // in future months (both within current year and in future years).
  const augmentedSnapshots = [...data.snapshots];
  if (year >= nowYear) {
    for (let m = 0; m < 12; m++) {
      // Past months in current year already have real snapshots
      if (year === nowYear && m < nowMonth) continue;
      const month = m + 1;
      const existingIds = new Set(
        data.snapshots
          .filter((s) => s.year === year && s.month === month)
          .map((s) => String(s.fixedExpenseId)),
      );
      (data.fixedExpenses || []).forEach((f) => {
        if (f.isArchived === true) return;
        if (!existingIds.has(String(f.id))) {
          augmentedSnapshots.push({
            fixedExpenseId: f.id,
            year,
            month,
            amountSnapshot: f.amount,
            nameSnapshot: f.name,
          });
        }
      });
    }
  }

  const augmentedData = { ...data, snapshots: augmentedSnapshots };

  // 1. Build 12 monthly summaries using augmented snapshots
  const months = [];
  for (let m = 0; m < 12; m++) {
    months.push(getMonthlyFinancialSummary(year, m, augmentedData));
  }

  // 2. Build year-level fixed rows using augmented snapshots
  const fixedRows = buildYearFixedRows(year, augmentedSnapshots, data.fixedExpenses);

  // 3. Derived arrays
  const monthlyFixedTotals = months.map((m) => m.fixedExpensesTotal);
  const monthlyVariableTotals = months.map((m) => m.variableExpenses);
  const monthlyTotals = months.map((m) => m.fixedExpensesTotal + m.variableExpenses);
  const monthlySavings = months.map((m) => m.autoSavings);
  const monthlyRemaining = months.map((m) => m.remaining);
  const monthlyTotalSavings = months.map((m) => m.autoSavings + m.remaining);
  const monthlySavingsRates = months.map((m) => m.savingsRate);

  // Savings % includes both auto savings and remaining budget
  const monthlySavingsPct = months.map((m) =>
    m.income > 0 ? ((m.autoSavings + m.remaining) / m.income) * 100 : null,
  );

  // 4. Totals
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalFixed = months.reduce((s, m) => s + m.fixedExpensesTotal, 0);
  const totalVariable = months.reduce((s, m) => s + m.variableExpenses, 0);
  const totalSavings = months.reduce((s, m) => s + m.autoSavings, 0);
  const totalRemaining = months.reduce((s, m) => s + m.remaining, 0);
  const totalSavingsWithRemaining = totalSavings + totalRemaining;

  const validMonths = months.filter((m) => m.income > 0);
  const avgSavingsPct =
    validMonths.length > 0
      ? (totalSavingsWithRemaining / validMonths.reduce((s, m) => s + m.income, 0)) * 100
      : 0;

  const yearTotal = totalFixed + totalVariable;

  return {
    months,
    fixedRows,
    monthlyFixedTotals,
    monthlyVariableTotals,
    monthlyTotals,
    monthlySavings,
    monthlyRemaining,
    monthlyTotalSavings,
    monthlySavingsRates,
    monthlySavingsPct,
    totals: {
      totalIncome,
      totalFixed,
      totalVariable,
      totalSavings,
      totalRemaining,
      totalSavingsWithRemaining,
      yearTotal,
      avgSavingsPct,
    },
  };
}

/**
 * Build the variable expense category grid for a year.
 * Groups expenses by category and returns monthly breakdowns.
 *
 * @param {number} year
 * @param {Array} expenses
 * @param {Array} categories
 * @returns {Object}
 *   grid: { [categoryKey]: number[12] }
 *   variableRows: Array<{key,name,yearTotal,amounts}>
 *   monthlyVariableTotals: number[12]
 *   maxPerMonth: number[12]
 *   yearVariableTotal: number
 */
export function getYearVariableGrid(year, expenses, categories) {
  const activeCategories = (categories || []).filter((c) => !c.isDeleted);

  const yearExpenses = (expenses || []).filter((e) => e.date && e.date.startsWith(`${year}-`));

  const grid = {};
  yearExpenses.forEach((e) => {
    const key = e.categoryId != null ? String(e.categoryId) : e.category || "Uncategorized";
    const m = parseInt(e.date.slice(5, 7), 10) - 1;
    if (!grid[key]) grid[key] = Array(12).fill(0);
    grid[key][m] += e.amount || 0;
  });

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

  const variableRows = result.map((row) => {
    const amounts = grid[row.key] || Array(12).fill(0);
    return {
      key: row.key,
      name: row.name,
      amounts,
      yearTotal: amounts.reduce((s, v) => s + v, 0),
    };
  });

  const monthlyVariableTotals = Array.from({ length: 12 }, (_, m) =>
    variableRows.reduce((s, r) => s + (r.amounts[m] || 0), 0),
  );

  const maxPerMonth = Array.from({ length: 12 }, (_, m) =>
    Math.max(0, ...variableRows.map((r) => r.amounts[m] || 0)),
  );

  const yearVariableTotal = monthlyVariableTotals.reduce((s, v) => s + v, 0);

  return { grid, variableRows, monthlyVariableTotals, maxPerMonth, yearVariableTotal };
}

/**
 * Generate a backfill preview timeline from modal form state.
 * Returns a 12-month financial grid for live preview.
 *
 * @param {Array<{name:string,amount:number,startMonth:number,endMonth:number}>} items
 * @param {{amount:number,startMonth:number,endMonth:number}} incomeConfig
 * @param {{rate:number,startMonth:number,endMonth:number}} savingsConfig
 * @returns {Array<{month:number,income:number,fixedTotal:number,fixedItems:Array,savingsRate:number,autoSavings:number,remaining:number}>}
 */
export function getBackfillPreviewTimeline(items, incomeConfig, savingsConfig) {
  const safeItems = items
    .filter((i) => i.name.trim() && !isNaN(parseFloat(i.amount)))
    .map((i) => ({
      name: i.name.trim(),
      amount: parseFloat(i.amount) || 0,
      startMonth: Math.max(1, Math.min(12, i.startMonth || 1)),
      endMonth: Math.max(1, Math.min(12, i.endMonth || 12)),
    }));

  const incomeAmt = parseFloat(incomeConfig?.amount) || 0;
  const incomeSm = Math.max(1, Math.min(12, incomeConfig?.startMonth || 1));
  const incomeEm = Math.max(1, Math.min(12, incomeConfig?.endMonth || 12));

  const savingsRate = parseFloat(savingsConfig?.rate) || 0;
  const savingsSm = Math.max(1, Math.min(12, savingsConfig?.startMonth || 1));
  const savingsEm = Math.max(1, Math.min(12, savingsConfig?.endMonth || 12));

  return Array.from({ length: 12 }, (_, m) => {
    const month = m + 1;

    const fixedItems = safeItems
      .filter((i) => month >= i.startMonth && month <= i.endMonth)
      .map((i) => ({ name: i.name, amount: i.amount }));

    const fixedTotal = fixedItems.reduce((s, i) => s + i.amount, 0);

    const income = month >= incomeSm && month <= incomeEm ? incomeAmt : 0;
    const rate = month >= savingsSm && month <= savingsEm ? savingsRate : 0;

    const autoSavings = Math.max(0, income * (rate / 100));
    const remaining = income - fixedTotal - autoSavings;

    return {
      month,
      income,
      fixedTotal,
      fixedItems,
      savingsRate: rate,
      autoSavings,
      remaining,
    };
  });
}

/**
 * Export month names for consumers.
 */
export { MONTHS };
