# Requirements: Analytics Page Restructure + IncomeFlowBar

## Feature 1: Analytics Page Restructure

### Requirement 1.1 — Remove MonthStrip

**User story**: As a user, I want the analytics page to use the Net Remaining chart as the month selector, so the UI is less cluttered and navigation is more intuitive.

**Acceptance criteria**:

1. `MonthStrip` is no longer rendered anywhere on the analytics page.
2. `MonthStrip.tsx` is deleted from the codebase.
3. All MonthStrip-related props and callbacks are removed from `useAnalytics` and `AnalyticsPage`.

---

### Requirement 1.2 — Unified month selection via trendMonth

**User story**: As a user, I want clicking a dot on the Net Remaining chart to select that month across the entire analytics page, so I don't need a separate strip to navigate months.

**Acceptance criteria**:

1. `trendMonth` is the single source of truth for which month is selected.
2. `AnalyticsCharts` receives `trendMonth` as its `selectedMonth` prop — there is no separate `selectedMonth` state.
3. When `trendMonth` is `null`, `AnalyticsCharts` renders `YearView`.
4. When `trendMonth` is a valid month index, `AnalyticsCharts` renders `MonthView` for that month.
5. `AnalyticsSessionState` no longer contains a `selectedMonth` field.

---

### Requirement 1.3 — Remove AnalyticsOverviewSection

**User story**: As a user, I want the analytics page to be focused and uncluttered, with the IncomeFlowBar replacing the old summary grid.

**Acceptance criteria**:

1. `AnalyticsOverviewSection` is no longer rendered on the analytics page.
2. The 4-chip summary grid (YTD Income / YTD Fixed / YTD Savings / YTD Expenses) is removed.
3. The `analytics-overview-band` content (trend headline, insight chips, month-to-month table, spending pulse) is removed.

---

### Requirement 1.4 — Unified trend card layout

**User story**: As a user, I want the net remaining chart, income flow bar, and month preview/drilldown to be presented as a single cohesive card, so the analytics page feels organised.

**Acceptance criteria**:

1. `IncomeTrendYearChart` renders at the top of the `IncomeTrendSection` card (after the heading).
2. `IncomeFlowBar` renders **below the chart**, not above it.
3. When `trendMonth` is set and `trendDrilldown` is false, `IncomeTrendMonthPreview` renders inline below `IncomeFlowBar` within the same card.
4. When `trendDrilldown` is true, `IncomeTrendMonthDrilldown` replaces the entire card content (chart, IncomeFlowBar, and preview are not rendered).
5. When `trendDrilldown` is false, `IncomeTrendMonthDrilldown` is not rendered.

---

### Requirement 1.5 — Year change resets month selection

**User story**: As a user, I want changing the year to clear any selected month, so I always start fresh when switching years.

**Acceptance criteria**:

1. When `handleYearChange` is called with a new year, `trendMonth` is reset to `null`.
2. When `handleYearChange` is called, `trendDrilldown` is reset to `false`.
3. After a year change, `AnalyticsCharts` renders `YearView`.

---

### Requirement 1.6 — URL param cleanup

**User story**: As a developer, I want the URL state to be minimal and consistent, so the app URL reflects only the persisted navigation state.

**Acceptance criteria**:

1. `selectedMonth` is no longer read from or written to URL params in `App.tsx`.
2. `year`, `trendMonth`, and `trendDrilldown` URL params continue to work exactly as before.
3. Existing URLs containing only `year`, `trendMonth`, and `trendDrilldown` params continue to restore state correctly.

---

### Requirement 1.7 — Page layout order

**User story**: As a user, I want the analytics page to have a clear top-to-bottom hierarchy, so I can navigate from year overview down to month detail.

**Acceptance criteria**:

1. Page renders in this order (top to bottom):
   - Header ("Analytics")
   - `YearStrip`
   - Unified trend card (`IncomeTrendSection` with `IncomeFlowBar`)
   - `AnalyticsCharts` (YearView or MonthView)
2. No other sections appear between these elements.

---

## Feature 2: IncomeFlowBar Component

### Requirement 2.1 — Component file and props

**User story**: As a developer, I want a well-typed `IncomeFlowBar` component, so it can be safely integrated into the analytics page.

**Acceptance criteria**:

1. Component is created at `src/features/analytics/IncomeFlowBar.tsx`.
2. Component accepts year-level props (`yearIncome`, `yearFixed`, `yearVariable`, `yearSavings`, `yearRemaining`), month-level array props (`monthlyIncome`, `monthlyFixed`, `monthlyVariable`, `monthlySavings`, `monthlyRemaining`), and selection/context props (`selectedMonth`, `monthCount`, `isCurrentYear`, `year`, `formatAmount`).
3. Component is the default export of the file.

---

### Requirement 2.2 — Morphing based on selection state

**User story**: As a user, I want the income flow bar to show the selected month's data when I click a chart dot, so I can see how that specific month's budget was allocated.

**Acceptance criteria**:

1. When `selectedMonth` is `null`, the bar uses year-level data (`yearIncome`, `yearFixed`, `yearVariable`, `yearSavings`, `yearRemaining`).
2. When `selectedMonth` is a valid month index M, the bar uses month-level data (`monthlyIncome[M]`, `monthlyFixed[M]`, `monthlyVariable[M]`, `monthlySavings[M] ?? 0`, `monthlyRemaining[M] ?? 0`).
3. The bar re-computes all segments immediately when `selectedMonth` changes — no stale data is shown.
4. The headline label updates to reflect the current mode (year vs month).

---

### Requirement 2.3 — Income headline

**User story**: As a user, I want to see a compact income summary above the bar, so I know the total income context at a glance.

**Acceptance criteria**:

1. A single line above the bar shows the income label and formatted income amount.
2. When `selectedMonth` is `null` and `isCurrentYear` is true: label is "YTD Income" with month count context (e.g. "· 5 months").
3. When `selectedMonth` is `null` and `isCurrentYear` is false: label is "Total Income" with "· 12 months".
4. When `selectedMonth` is set: label is "{MonthLabel} Income" (e.g. "May Income").
5. When the resolved `income = 0`, the headline still renders but the bar area shows a zero-state placeholder.

---

### Requirement 2.4 — Bar segments

**User story**: As a user, I want to see how income is split across savings, fixed expenses, variable expenses, and remaining budget, so I can understand my allocation at a glance.

**Acceptance criteria**:

1. Bar segments render left-to-right in this order: Savings → Fixed → Variable → Remaining.
2. Savings segment uses `colors.success`.
3. Fixed segment uses `colors.primary`.
4. Variable segment uses `colors.danger`.
5. Remaining segment uses the dynamic green-to-red tone from `getRemainingBarColor` (same logic as `BudgetFlow.tsx`).
6. Segments with a resolved value of `0` are not rendered.
7. Each segment's width is proportional to `value / resolvedIncome * 100` percent of the bar.

---

### Requirement 2.5 — Savings cap

**User story**: As a user, I want the savings segment to never exceed the total income bar width, so the visualisation remains accurate.

**Acceptance criteria**:

1. The savings segment value used for width calculation is `min(resolvedSavings, resolvedIncome)`.
2. When `resolvedSavings > resolvedIncome`, the savings segment fills the entire bar and the overflow segment is shown.

---

### Requirement 2.6 — Overflow / debt segment

**User story**: As a user, I want to see when my total allocated spending exceeds my income, so I can identify over-budget situations.

**Acceptance criteria**:

1. When `savings + fixed + variable > income`, an overflow segment is rendered extending past the 100% mark in `colors.danger`.
2. A vertical dashed line marks the 100% (income) boundary when overflow is present.
3. The overflow amount is displayed (e.g. "−$1,200 over").
4. When `savings + fixed + variable ≤ income`, no overflow segment or dashed line is rendered.
5. When overflow is present, the remaining segment is not rendered.

---

### Requirement 2.7 — Zero income state

**User story**: As a user, I want a clear placeholder when there is no income data, so I understand why the bar is empty.

**Acceptance criteria**:

1. When the resolved `income = 0`, no bar segments are rendered.
2. A placeholder message is shown in the bar area (e.g. "No income data").
3. The legend rows are still rendered below the placeholder.

---

### Requirement 2.7 — Desktop tooltip (hover)

**User story**: As a desktop user, I want to hover over a bar segment to see its label, amount, and percentage, so I can get precise figures without reading the legend.

**Acceptance criteria**:

1. Hovering over a segment shows a tooltip above the bar with: segment label, formatted amount, and percentage of income.
2. Tooltip format: "Label · $amount · X%".
3. Tooltip is positioned relative to the bar using `onMouseEnter`/`onMouseMove` (same pattern as `BudgetFlow.tsx`).
4. Moving the mouse off the bar container dismisses the tooltip.
5. At most one tooltip is visible at a time.

---

### Requirement 2.8 — Mobile tooltip (tap)

**User story**: As a mobile user, I want to tap a bar segment to see its details, so I can get the same information as desktop hover without needing a mouse.

**Acceptance criteria**:

1. Tapping a segment sets it as the active segment and shows its tooltip.
2. Tapping the same segment again dismisses the tooltip.
3. Tapping a different segment switches the active segment.
4. No hover events are used on mobile (touch devices).

---

### Requirement 2.9 — Legend rows

**User story**: As a user, I want a legend below the bar showing each allocation category with its percentage and amount, so I can read exact figures without hovering.

**Acceptance criteria**:

1. Legend renders these rows in order: Savings, Fixed Expenses, Variable Expenses, then a divider, then Remaining / Over Budget.
2. Each row shows: a coloured dot, label, percentage of income, and formatted amount.
3. Savings row uses `colors.success` dot.
4. Fixed Expenses row uses `colors.primary` dot.
5. Variable Expenses row uses `colors.danger` dot.
6. Remaining row label is "Remaining" when `remaining ≥ 0`, "Over Budget" when `remaining < 0`.
7. Remaining row uses `colors.success` dot when `remaining ≥ 0`, `colors.danger` when `remaining < 0`.
8. Remaining value is shown with a `+` prefix when positive and `−` prefix when negative.
9. Legend rows are always rendered regardless of income value.

---

### Requirement 2.10 — Data wiring

**User story**: As a developer, I want `IncomeFlowBar` to receive its data directly from `AnalyticsData`, so there is no additional data transformation layer.

**Acceptance criteria**:

1. `yearIncome` prop = `data.yearTotalIncome`
2. `yearFixed` prop = `data.yearFixedTotal`
3. `yearVariable` prop = `data.yearVariableTotal`
4. `yearSavings` prop = `data.yearSavings`
5. `yearRemaining` prop = `data.yearRemaining`
6. `monthlyIncome` prop = `data.monthlyIncome`
7. `monthlyFixed` prop = `data.monthlyFixedTotals`
8. `monthlyVariable` prop = `data.monthlyVariableTotals`
9. `monthlySavings` prop = `data.monthlySavings`
10. `monthlyRemaining` prop = `data.monthlyRemaining`
11. `selectedMonth` prop = `trendMonth` (from session state)
12. `monthCount` prop = `isCurrentYear ? currentMonth + 1 : 12`
13. `isCurrentYear` prop = `year === currentYear`
14. `year` prop = `year`
15. `formatAmount` prop = `formatAmount` from `useSettings()`

---

### Requirement 2.11 — Theme compliance

**User story**: As a user, I want the IncomeFlowBar to respect the active theme, so it looks consistent with the rest of the app.

**Acceptance criteria**:

1. All colors are sourced from `useThemeColors()` — no hardcoded hex values.
2. The component uses `cn()` for conditional class composition.
3. No `/` opacity modifiers on `text-theme-*` or `border-theme-*` classes.
4. Tailwind responsive prefixes are only applied to Tailwind utility classes, not custom theme classes.
