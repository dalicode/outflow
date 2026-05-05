import { describe, expect, it } from "vitest";
import { shouldShowCheckInReminder } from "../utils/reminderUtils";
import type { AppSettings, Expense } from "../types";

describe("shouldShowCheckInReminder", () => {
  const settings: AppSettings = {
    visualTheme: "default",
    font: "system",
    fontSize: "1",
    currencySymbol: "$",
    decimalPlaces: "2",
    thousandSep: ",",
    dateFormat: "MM/DD/YYYY",
    hapticsEnabled: true,
    enableCheckInReminders: true,
    reminderTime: "20:00",
    reminderDays: ["0", "1", "2", "3", "4", "5", "6"],
    reminderStyle: "gentle",
  };

  it("shows the reminder after the scheduled time when the day is empty", () => {
    const now = new Date(2026, 4, 5, 20, 30);
    const expenses: Expense[] = [];

    expect(shouldShowCheckInReminder(settings, expenses, now)).toBe(true);
  });

  it("hides the reminder before the scheduled time", () => {
    const now = new Date(2026, 4, 5, 19, 30);
    expect(shouldShowCheckInReminder(settings, [], now)).toBe(false);
  });

  it("hides the reminder after a dismissal on the same day", () => {
    const now = new Date(2026, 4, 5, 20, 30);
    expect(
      shouldShowCheckInReminder(
        {
          ...settings,
          lastCheckInDismissedAt: "2026-05-05T18:00:00.000Z",
        },
        [],
        now,
      ),
    ).toBe(false);
  });
});
