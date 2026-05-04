/**
 * DatePicker helpers — pure date utilities with no React dependencies.
 */

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface CalendarDay {
  date: number;
  month: number;
  year: number;
  isToday: boolean;
  isCurrentMonth: boolean;
}

/** Format a Date to ISO YYYY-MM-DD. */
export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Check if two dates represent the same calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Add days to a date (returns new Date). */
export function addDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setDate(date.getDate() + n);
  return result;
}

/** Add months to a date (returns new Date). */
export function addMonths(date: Date, n: number): Date {
  const result = new Date(date);
  result.setMonth(date.getMonth() + n);
  return result;
}

/** First day of the month for a given date. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Last day of the month for a given date. */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Generate a 6×7 calendar grid for a given month.
 * Includes previous-month and next-month padding so arrow keys
 * can navigate across month boundaries seamlessly.
 */
export function getCalendarGrid(
  year: number,
  month: number,
): CalendarDay[] {
  const today = new Date();
  const todayISO = toISO(today);

  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay(); // 0 = Sunday

  // Start from the Sunday on or before the 1st of the month
  const startDate = addDays(firstDay, -firstWeekday);

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(startDate, i);
    const iso = toISO(d);
    days.push({
      date: d.getDate(),
      month: d.getMonth(),
      year: d.getFullYear(),
      isToday: iso === todayISO,
      isCurrentMonth: d.getMonth() === month,
    });
  }

  return days;
}

export function getMonthName(month: number): string {
  return MONTH_NAMES[month] ?? "";
}

/**
 * Parse user-typed date string according to the configured format.
 * Requires 4-digit year. Returns ISO YYYY-MM-DD or null.
 */
export function parseUserDateInput(
  text: string,
  dateFormat: string,
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  let match: RegExpMatchArray | null = null;

  switch (dateFormat) {
    case "DD/MM/YYYY":
      match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) return null;
      return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    case "YYYY-MM-DD":
      match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!match) return null;
      return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    default: // MM/DD/YYYY
      match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) return null;
      return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  }
}

/**
 * Format an ISO date string to the user's configured display format.
 */
export function formatISODate(
  iso: string,
  dateFormat: string,
): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  switch (dateFormat) {
    case "DD/MM/YYYY":
      return `${d}/${m}/${y}`;
    case "YYYY-MM-DD":
      return `${y}-${m}-${d}`;
    default:
      return `${m}/${d}/${y}`;
  }
}

/**
 * Validate that an ISO date string represents a real calendar date.
 */
export function isValidISODate(iso: string): boolean {
  if (!iso) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}
