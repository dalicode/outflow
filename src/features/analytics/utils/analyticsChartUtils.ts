import type { AnalyticsData } from '../../../types'
import type { ThemeColors } from '../hooks/useThemeColors'
import { fmtFull } from '../../../utils/analyticsFormatting'

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export interface ChartProps {
  data: AnalyticsData
  colors: ThemeColors
  monthCount: number
}

export function getMonthCount(year: number, currentYear: number, currentMonth: number): number {
  if (year > currentYear) return 0
  if (year === currentYear) return currentMonth + 1
  return 12
}

export function sliceMonths(arr: (number | null)[], count: number): (number | null)[] {
  return arr.slice(0, count)
}

export function fmtChange(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (value === 0) return '$0'
  const amount = fmtFull(Math.abs(value))
  return value > 0 ? `+${amount}` : `-${amount}`
}
