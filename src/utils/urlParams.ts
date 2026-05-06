import { DASHBOARD_VIEWS } from "../features/dashboard/constants";
import { MONTH_SPANS } from "../features/dashboard/constants";
import type { DashboardView, MonthSpan } from "../features/dashboard/constants";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseMonthParam(
  value: string | null,
  defaultKey: string,
): string {
  if (!value || !MONTH_REGEX.test(value)) return defaultKey;
  return value;
}

export function parseYearParam(
  value: string | null,
  defaultYear: number,
): number {
  const year = parseInt(value ?? "", 10);
  if (isNaN(year) || year < 2000 || year > 2100) return defaultYear;
  return year;
}

export function parseViewParam(
  value: string | null,
): DashboardView {
  const validViews = new Set(Object.values(DASHBOARD_VIEWS));
  if (!value || !validViews.has(value as DashboardView)) {
    return DASHBOARD_VIEWS.CATEGORIES;
  }
  return value as DashboardView;
}

export function parseSpanParam(value: string | null): MonthSpan {
  const span = parseInt(value ?? "", 10);
  const validSpans = new Set(MONTH_SPANS);
  if (!validSpans.has(span as MonthSpan)) return 1;
  return span as MonthSpan;
}

export function parseAnalyticsMonthParam(
  value: string | null,
  maxMonth: number,
): number | null {
  const month = parseInt(value ?? "", 10);
  if (isNaN(month) || month < 0 || month > maxMonth) return null;
  return month;
}

export function monthKeyToParts(monthKey: string): {
  year: number;
  month: number;
} {
  const [yearStr, monthStr] = monthKey.split("-");
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10) - 1,
  };
}

export function partsToMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function parseTrendMonthParam(
  value: string | null,
): { year: number; monthIndex: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const monthIndex = parseInt(match[2], 10) - 1;
  if (year < 2000 || year > 2100) return null;
  return { year, monthIndex };
}

export function parseTrendDrilldownParam(value: string | null): boolean {
  return value === "1";
}
