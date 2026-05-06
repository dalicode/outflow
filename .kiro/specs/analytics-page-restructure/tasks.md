# Tasks: Analytics Page Restructure + IncomeFlowBar

## Task List

- [ ] 1. Simplify AnalyticsSessionState and useAnalytics hook
  - [ ] 1.1 Remove `selectedMonth` field from `AnalyticsSessionState` interface in `src/hooks/useAnalytics.ts`
  - [ ] 1.2 Remove `selectedMonth` local state, `setSelectedMonth`, `availableMonths`, `prevMonth`, `nextMonth`, `jumpBackMonths`, `jumpToCurrentMonth`, `isAtCurrentMonth`, `canPrevMonth`, `canNextMonth` from `useAnalytics` return value and internal logic
  - [ ] 1.3 Update `useAnalytics` return to expose only: `year`, `handleYearChange`, `currentYear`, `currentMonth`, `canGoForward`, `lastMonth`, `data`, `multiYearData`, `trendMonth`, `trendDrilldown`
  - [ ] 1.4 Update `handleYearChange` to reset `trendMonth: null` and `trendDrilldown: false` in the session state patch

- [ ] 2. Update App.tsx session state initialisation and URL param handling
  - [ ] 2.1 Remove `selectedMonth: null` from `analyticsSession` initial state in `App.tsx`
  - [ ] 2.2 Remove any `selectedMonth` URL param read/write logic from `handleAnalyticsSessionChange`
  - [ ] 2.3 Verify `year`, `trendMonth`, `trendDrilldown` URL params continue to work correctly

- [ ] 3. Create IncomeFlowBar component
  - [ ] 3.1 Create `src/features/analytics/IncomeFlowBar.tsx` with the full props interface: year-level props (`yearIncome`, `yearFixed`, `yearVariable`, `yearSavings`, `yearRemaining`), month-level array props (`monthlyIncome`, `monthlyFixed`, `monthlyVariable`, `monthlySavings`, `monthlyRemaining`), and selection/context props (`selectedMonth`, `monthCount`, `isCurrentYear`, `year`, `formatAmount`)
  - [ ] 3.2 Implement value resolution logic: when `selectedMonth` is null use year-level props; when set use `monthlyX[selectedMonth]` arrays — this is the morphing behaviour
  - [ ] 3.3 Implement segment computation from resolved values: savings (capped at resolved income), fixed, variable, remaining (when not over-allocated), overflow segment (when over-allocated)
  - [ ] 3.4 Implement income headline that morphs: "YTD Income · N months" (year, current), "Total Income · 12 months" (year, past), "{MonthLabel} Income" (month selected)
  - [ ] 3.5 Implement stacked bar rendering with correct segment order (Savings → Fixed → Variable → Remaining) and colors from `useThemeColors()`
  - [ ] 3.6 Implement overflow segment with dashed boundary line at 100% mark and overflow amount display
  - [ ] 3.7 Implement zero income state: no bar segments, placeholder message, legend still rendered
  - [ ] 3.8 Implement desktop hover tooltip (positioned relative to bar, same pattern as `BudgetFlow.tsx`)
  - [ ] 3.9 Implement mobile tap tooltip (onClick sets active segment; tapping same segment dismisses)
  - [ ] 3.10 Implement legend rows: Savings, Fixed Expenses, Variable Expenses, divider, Remaining/Over Budget — using `AllocationRow` pattern from `BudgetFlow.tsx`; legend values also morph with `selectedMonth`
  - [ ] 3.11 Ensure all colors use `useThemeColors()`, no hardcoded hex values, `cn()` for conditional classes

- [ ] 4. Restructure IncomeTrendSection into the unified trend card
  - [ ] 4.1 Add `IncomeFlowBar` props to `IncomeTrendSectionProps`: year-level (`yearTotalIncome`, `yearFixedTotal`, `yearVariableTotal`, `yearSavings`, `yearRemaining`), month-level arrays (`monthlyIncome`, `monthlyFixedTotals`, `monthlyVariableTotals`, `monthlySavings`, `monthlyRemaining`), context (`monthCount`, `isCurrentYear`)
  - [ ] 4.2 Render `IncomeTrendYearChart` first (after the "Net Remaining" heading), then render `IncomeFlowBar` **below the chart** — passing `trendMonth` as `selectedMonth` so it morphs on dot click
  - [ ] 4.3 Ensure `IncomeTrendMonthDrilldown` still replaces the entire card content (chart and IncomeFlowBar not rendered during drilldown)
  - [ ] 4.4 Ensure `IncomeTrendMonthPreview` renders inline below `IncomeFlowBar` (not below the chart) when `trendMonth` is set and not in drilldown

- [ ] 5. Update AnalyticsPage
  - [ ] 5.1 Remove `MonthStrip` import and usage
  - [ ] 5.2 Remove `AnalyticsOverviewSection` import and usage
  - [ ] 5.3 Remove all MonthStrip-related destructured values from `useAnalytics` call (`selectedMonth`, `setSelectedMonth`, `availableMonths`, `prevMonth`, `nextMonth`, `jumpBackMonths`, `jumpToCurrentMonth`, `isAtCurrentMonth`, `canPrevMonth`, `canNextMonth`)
  - [ ] 5.4 Pass `trendMonth` as `selectedMonth` to `AnalyticsCharts`
  - [ ] 5.5 Pass IncomeFlowBar data props to `IncomeTrendSection`: year-level (`data.yearTotalIncome`, `data.yearFixedTotal`, `data.yearVariableTotal`, `data.yearSavings`, `data.yearRemaining`), month-level arrays (`data.monthlyIncome`, `data.monthlyFixedTotals`, `data.monthlyVariableTotals`, `data.monthlySavings`, `data.monthlyRemaining`), context (`monthCount`, `isCurrentYear`)
  - [ ] 5.6 Remove `contentMotionKey` that included `selectedMonth` (update to use only `year` and `trendMonth`)

- [ ] 6. Delete MonthStrip
  - [ ] 6.1 Delete `src/features/analytics/MonthStrip.tsx`

- [ ] 7. Verify build and tests pass
  - [ ] 7.1 Run `npm run build` — must pass with no TypeScript errors
  - [ ] 7.2 Run `npx vitest run` — all existing tests must pass
  - [ ] 7.3 Manually verify: year navigation works, clicking chart dots selects month and morphs IncomeFlowBar to month data, clicking same dot deselects and morphs back to year data, drilldown and back navigation work, IncomeFlowBar renders correctly for current year and past years
