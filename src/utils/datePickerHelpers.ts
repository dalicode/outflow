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
  isSelected: boolean;
}

/**
 * Generate days for a given month.
 * Only returns actual days of the selected month.
 */
export function getCalendarDays(
  year: number,
  month: number,
  selectedISO?: string,
): CalendarDay[] {
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: CalendarDay[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({
      date: d,
      month,
      year,
      isToday: iso === todayISO,
      isSelected: iso === selectedISO,
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
