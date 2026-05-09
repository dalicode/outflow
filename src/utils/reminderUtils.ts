import type { AppSettings, Expense } from '../types'

function getLocalDateStamp(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getStoredDateStamp(value?: string): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return getLocalDateStamp(parsed)
}

export function isReminderDay(reminderDays: string[] | undefined, date = new Date()): boolean {
  if (!reminderDays || reminderDays.length === 0) return true
  return reminderDays.includes(String(date.getDay()))
}

export function hasExpenseOnDate(expenses: Expense[], isoDate: string): boolean {
  return expenses.some((expense) => expense.date === isoDate)
}

export function shouldShowCheckInReminder(
  settings: AppSettings,
  expenses: Expense[],
  now = new Date(),
): boolean {
  if (!settings.enableCheckInReminders) return false
  if (!isReminderDay(settings.reminderDays, now)) return false

  const today = getLocalDateStamp(now)
  if (hasExpenseOnDate(expenses, today)) return false

  const reminderTime = settings.reminderTime ?? '20:00'
  const [hourText, minuteText] = reminderTime.split(':')
  const reminderHour = Number.parseInt(hourText ?? '20', 10)
  const reminderMinute = Number.parseInt(minuteText ?? '0', 10)
  if (Number.isNaN(reminderHour) || Number.isNaN(reminderMinute)) return false

  const reminderMinutes = reminderHour * 60 + reminderMinute
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  if (currentMinutes < reminderMinutes) return false

  if (getStoredDateStamp(settings.lastCheckInDismissedAt) === today) return false
  if (getStoredDateStamp(settings.lastCheckInCompletedAt) === today) return false

  return true
}
