/**
 * Pure helper functions for Edit Historical Data modal range management.
 * No React dependencies — testable in isolation.
 */

export interface RangeItem {
  id: string;
  amount: string | number;
  startMonth: number;
  endMonth: number;
}

let _idCounter = 0;
const nextId = () => `tmp-${++_idCounter}`;

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Convert a { month: value } map into an array of contiguous ranges.
 * Months with no entry or null/undefined are treated as gaps.
 */
export function monthMapToRanges(
  monthMap: Record<number, number | null | undefined>,
): RangeItem[] {
  const ranges: RangeItem[] = [];
  let current: RangeItem | null = null;
  for (let m = 1; m <= 12; m++) {
    const val = monthMap?.[m];
    if (val != null && val !== 0) {
      if (current && current.amount === val) {
        current.endMonth = m;
      } else {
        if (current) ranges.push(current);
        current = { id: nextId(), amount: val, startMonth: m, endMonth: m };
      }
    } else {
      if (current) {
        ranges.push(current);
        current = null;
      }
    }
  }
  if (current) ranges.push(current);
  return ranges;
}

/**
 * Flatten an array of ranges into a { month: value } map.
 * Later ranges overwrite earlier ones for overlapping months.
 */
export function flattenRangesToMonthMap(ranges: RangeItem[]): Record<number, number> {
  const map: Record<number, number> = {};
  for (const range of ranges) {
    const val = parseFloat(String(range.amount));
    if (isNaN(val)) continue;
    const sm = clamp(range.startMonth || 1, 1, 12);
    const em = clamp(range.endMonth || 12, 1, 12);
    for (let m = sm; m <= em; m++) {
      map[m] = val;
    }
  }
  return map;
}

interface ExpenseLike {
  date?: string;
  amount?: number;
}

/**
 * Compute monthly variable expense totals for a given year from raw expenses.
 * Returns an array of 12 numbers (index 0 = Jan).
 */
export function getYearlyVariableTotals(year: number, expenses: ExpenseLike[]): number[] {
  const totals = Array(12).fill(0);
  const prefix = `${year}-`;
  for (const e of expenses || []) {
    if (!e.date || !e.date.startsWith(prefix)) continue;
    const month = parseInt(e.date.slice(5, 7), 10) - 1;
    if (month >= 0 && month < 12) {
      totals[month] += e.amount || 0;
    }
  }
  return totals;
}

export function getMaxMonthForYear(year: number): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year === currentYear ? Math.max(0, currentMonth - 1) : 12;
}

/**
 * Find the first available gap in a sorted list of ranges, prioritizing
 * front gaps (near January). Returns null when the year is fully covered.
 */
export function findGapToFill(
  ranges: RangeItem[],
  maxMonth: number,
): { startMonth: number; endMonth: number } | null {
  const sorted = [...ranges].sort((a, b) => a.startMonth - b.startMonth);

  if (sorted.length === 0) {
    return { startMonth: 1, endMonth: maxMonth };
  }

  if (sorted[0].startMonth > 1) {
    return { startMonth: 1, endMonth: sorted[0].startMonth - 1 };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].endMonth + 1 < sorted[i + 1].startMonth) {
      return {
        startMonth: sorted[i].endMonth + 1,
        endMonth: sorted[i + 1].startMonth - 1,
      };
    }
  }

  if (sorted[sorted.length - 1].endMonth < maxMonth) {
    return {
      startMonth: sorted[sorted.length - 1].endMonth + 1,
      endMonth: maxMonth,
    };
  }

  return null; // fully covered
}

/**
 * Remove a range by id and merge its span into the neighbor:
 * - If a next range exists, expand it backward.
 * - Otherwise expand the previous range forward.
 */
export function removeRangeAndMerge(ranges: RangeItem[], id: string): RangeItem[] {
  const result = [...ranges];
  const idx = result.findIndex((r) => r.id === id);
  if (idx === -1) return result;

  const deleted = result[idx];
  result.splice(idx, 1);

  if (idx < result.length) {
    result[idx] = { ...result[idx], startMonth: deleted.startMonth };
  } else if (idx > 0) {
    result[idx - 1] = { ...result[idx - 1], endMonth: deleted.endMonth };
  }

  return result;
}

/**
 * Update a range's endMonth and cascade the change to all subsequent ranges
 * so the partition stays contiguous. Ranges squeezed to zero or negative
 * width are auto-removed.
 */
export function updateRangeEndAndCascade(
  ranges: RangeItem[],
  id: string,
  newEndMonth: number,
): RangeItem[] {
  const result = [...ranges];
  const idx = result.findIndex((r) => r.id === id);
  if (idx === -1) return result;

  result[idx] = { ...result[idx], endMonth: newEndMonth };

  for (let i = idx + 1; i < result.length; i++) {
    const newStart = result[i - 1].endMonth + 1;
    result[i] = { ...result[i], startMonth: newStart };
    if (result[i].startMonth > result[i].endMonth) {
      result.splice(i, 1);
      i--;
    }
  }

  return result;
}

/**
 * Validate that ranges form a contiguous, non-overlapping partition.
 */
export function checkRangeOverlaps(ranges: RangeItem[], label: string): string[] {
  const sorted = [...ranges].sort((a, b) => a.startMonth - b.startMonth);
  const errs: string[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].startMonth > sorted[i].endMonth) {
      errs.push(`${label} start month must be ≤ end month.`);
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMonth <= sorted[i - 1].endMonth) {
      errs.push(`${label} ranges must not overlap.`);
    }
    if (sorted[i].startMonth !== sorted[i - 1].endMonth + 1) {
      errs.push(`${label} ranges must be contiguous with no gaps.`);
    }
  }

  return errs;
}

/**
 * Determine whether the given ranges fully cover Jan–maxMonth with no gaps.
 */
export function isFullyCovered(ranges: RangeItem[], maxMonth: number): boolean {
  if (ranges.length === 0) return false;

  const sorted = [...ranges].sort((a, b) => a.startMonth - b.startMonth);
  if (sorted[0].startMonth !== 1) return false;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startMonth !== sorted[i - 1].endMonth + 1) return false;
  }

  return sorted[sorted.length - 1].endMonth === maxMonth;
}

/**
 * Format year/month/day as YYYY-MM-DD string.
 */
export function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse a YYYY-MM-DD string into year/month/day components.
 * Returns null if the string is not a valid ISO date.
 */
export function parseISODate(dateStr: string): { year: number; month: number; day: number } | null {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return {
    year: parseInt(m[1], 10),
    month: parseInt(m[2], 10),
    day: parseInt(m[3], 10),
  };
}

/**
 * Get today's date in the user's local timezone as YYYY-MM-DD.
 */
export function getLocalToday(): string {
  const now = new Date();
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Get current year-month in the user's local timezone as YYYY-MM.
 */
export function getLocalMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Determine whether a scheduled date (year/month) has arrived relative to now.
 * Used by materializePendingSnapshots to know when to execute a schedule.
 */
export function shouldMaterializeNow(
  scheduleYear: number,
  scheduleMonth: number,
  currentYear: number,
  currentMonth: number,
): boolean {
  return (
    scheduleYear < currentYear ||
    (scheduleYear === currentYear && scheduleMonth <= currentMonth)
  );
}
