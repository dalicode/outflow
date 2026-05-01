export const DASHBOARD_VIEWS = {
  CATEGORIES: "categories",
  EXPENSES: "expenses",
} as const;

export type DashboardView =
  (typeof DASHBOARD_VIEWS)[keyof typeof DASHBOARD_VIEWS];

export const MONTH_SPANS = [1, 2, 3, 6, 12] as const;

export type MonthSpan = (typeof MONTH_SPANS)[number];

export const VIEWPORT_THRESHOLDS: Record<number, number> = {
  1: 640,
  2: 768,
  3: 896,
  6: 1280,
  12: 1920,
};

export const INCOME_FREQUENCIES = ["monthly", "biweekly", "weekly"] as const;

export const INCOME_MULTIPLIERS: Record<string, number> = {
  monthly: 1,
  biweekly: 2.17,
  weekly: 4.33,
};
