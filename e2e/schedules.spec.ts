import { test, expect } from "@playwright/test";
import { getSchedules, resetAppState } from "./helpers";

test.describe("Schedules — desktop", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page, {
      route: "/settings",
      settings: {
        monthlyIncome: 5000,
        savingsRate: 10,
      },
    });
  });

  test("create income and savings schedules, then delete", async ({ page }) => {
    // ── Create income schedule ──
    await page.getByTestId("btn-add-schedule").click();
    let dialog = page.getByRole("dialog", { name: "Add Schedule" });
    await expect(dialog).toBeVisible();

    await page.getByTestId("schedule-value-input").fill("6000");
    await page.getByTestId("schedule-note-input").fill("Salary increase");
    await page.getByTestId("btn-save-schedule").click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    await expect(page.getByText("Upcoming")).toBeVisible();
    await expect(page.getByText("Income→$6000")).toBeVisible();
    await expect(page.getByText("(Salary increase)")).toBeVisible();

    let schedules = await getSchedules(page);
    expect(schedules.some((s) => s.type === "income" && s.newValue === 6000)).toBe(true);

    // ── Create savings rate schedule ──
    await page.getByTestId("btn-add-schedule").click();
    dialog = page.getByRole("dialog", { name: "Add Schedule" });
    await expect(dialog).toBeVisible();

    await page.getByTestId("schedule-type-select").selectOption("savingsRate");
    await page.getByTestId("schedule-value-input").fill("20");
    await page.getByTestId("btn-save-schedule").click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    await expect(page.getByText("Savings %→20%")).toBeVisible();

    schedules = await getSchedules(page);
    expect(schedules.some((s) => s.type === "savingsRate" && s.newValue === 20)).toBe(true);

    // ── Delete the income schedule ──
    const incomeSchedule = schedules.find((s) => s.type === "income" && s.newValue === 6000);
    expect(incomeSchedule?.id).toBeTruthy();

    await page.locator(`[data-testid="schedule-item-${incomeSchedule?.id}"]`).getByText("Del").click();
    await page.waitForTimeout(500);

    schedules = await getSchedules(page);
    expect(schedules.some((s) => s.id === incomeSchedule?.id)).toBe(false);
  });
});
