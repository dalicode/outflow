import { test } from "@playwright/test";
import {
  addPayee,
  expect,
  getAllExpenses,
  getFixedExpenseSnapshots,
  getIncomeSnapshots,
  getPayees,
  getSavingsSnapshots,
  resetAppState,
  seedExpenses,
} from "./helpers";

test.describe("Advanced budget flows", () => {
  test("bulk edit applies description updates to selected expenses", async ({ page }) => {
    await resetAppState(page, {
      expenses: [
        { date: "2026-05-01", amount: 15.5, description: "Lunch" },
        { date: "2026-05-02", amount: 42.0, description: "Groceries" },
        { date: "2026-05-03", amount: 5.0, description: "Snack" },
      ],
    });

    await page.getByTestId("view-tab-expenses").first().click();
    const rows = page.locator("[data-testid^='expense-row-']");

    await rows.nth(0).locator(".expense-checkbox-wrapper").first().click({ force: true });
    await rows.nth(1).locator(".expense-checkbox-wrapper").first().click({ force: true });

    await rows.nth(0).click({ button: "right" });
    await page.getByText("Edit 2 rows").click();

    const dialog = page.getByRole("dialog", { name: "Edit 2 Expenses" });
    await expect(dialog).toBeVisible();
    await dialog.locator("label", { hasText: "Description" }).click();
    await dialog.getByPlaceholder("Enter description...").fill("Shared description");
    await dialog.getByRole("button", { name: "Apply Changes" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(rows.nth(0).locator("[data-field='description']")).toHaveText("Shared description");
    await expect(rows.nth(1).locator("[data-field='description']")).toHaveText("Shared description");
    await expect(rows.nth(2).locator("[data-field='description']")).toHaveText("Lunch");
  });

  test("merging payees reassigns expenses and archives the source payee", async ({ page }) => {
    await resetAppState(page);
    const alphaId = await addPayee(page, "Alpha Market");
    const betaId = await addPayee(page, "Beta Market");

    await seedExpenses(page, [
      {
        date: "2026-05-04",
        amount: 24.75,
        description: "Alpha lunch",
        payeeId: alphaId,
      },
      {
        date: "2026-05-05",
        amount: 18.2,
        description: "Alpha coffee",
        payeeId: alphaId,
      },
    ]);

    await page.goto("/payees");
    await expect(page.getByTestId("payees-page")).toBeVisible();

    const alphaRow = page.locator("[data-testid^='payee-row-']").filter({
      has: page.getByText("Alpha Market", { exact: false }),
    });
    await alphaRow.getByText("Merge").click();

    const mergeDialog = page.getByRole("dialog", { name: "Merge Payee" });
    await expect(mergeDialog).toBeVisible();
    await mergeDialog.locator("select").selectOption(String(betaId));
    await mergeDialog.getByRole("button", { name: "Merge Payee" }).click();
    await expect(mergeDialog).not.toBeVisible();

    // Wait for the toast to appear and disappear, then verify no payee row exists
    await page.waitForTimeout(5500);
    await expect(page.locator("[data-testid^='payee-row-']").filter({
      has: page.getByText("Alpha Market"),
    })).toHaveCount(0);

    const payees = await getPayees(page);
    const alpha = payees.find((payee) => payee.id === alphaId);
    expect(alpha?.isArchived).toBe(true);
    expect(alpha?.mergedIntoPayeeId).toBe(betaId);

    const expenses = await getAllExpenses(page);
    const alphaExpenses = expenses.filter((expense) =>
      ["Alpha lunch", "Alpha coffee"].includes(expense.description ?? ""),
    ) as Array<{ payeeId?: number }>;
    expect(alphaExpenses.every((expense) => expense.payeeId === betaId)).toBe(true);
  });

  test("historical data modal saves income, savings, and fixed expense snapshots", async ({ page }) => {
    await resetAppState(page, {
      route: "/settings",
      expenses: [{ date: "2025-03-15", amount: 22.4, description: "Archive seed" }],
      settings: {
        monthlyIncome: 4000,
        savingsRate: 15,
      },
    });

    await page.getByTestId("btn-open-historical-data").click();

    const dialog = page.getByRole("dialog", { name: "Edit Historical Data" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /Use current: \$4,000\.00/ }).click();
    await dialog.getByRole("button", { name: /Use current: 15%/ }).click();
    await dialog.locator("button").filter({ hasText: /^Rent$/ }).click();
    await dialog.getByRole("button", { name: "Confirm Save" }).click();
    await expect
      .poll(async () => {
        const incomeSnapshots = await getIncomeSnapshots(page);
        return incomeSnapshots.filter((snapshot) => snapshot.year === 2025).length;
      })
      .toBe(12);
    await expect
      .poll(async () => {
        const savingsSnapshots = await getSavingsSnapshots(page);
        return savingsSnapshots.filter((snapshot) => snapshot.year === 2025).length;
      })
      .toBe(12);
    await expect
      .poll(async () => {
        const fixedSnapshots = await getFixedExpenseSnapshots(page);
        return fixedSnapshots.filter((snapshot) => snapshot.year === 2025).length;
      })
      .toBe(12);

    const incomeSnapshots = await getIncomeSnapshots(page);
    const savingsSnapshots = await getSavingsSnapshots(page);
    const fixedSnapshots = await getFixedExpenseSnapshots(page);
    const income2025 = incomeSnapshots.filter((snapshot) => snapshot.year === 2025);
    const savings2025 = savingsSnapshots.filter((snapshot) => snapshot.year === 2025);
    const fixed2025 = fixedSnapshots.filter((snapshot) => snapshot.year === 2025);

    expect(income2025.every((snapshot) => snapshot.amountSnapshot === 4000)).toBe(true);
    expect(savings2025.every((snapshot) => snapshot.rateSnapshot === 15)).toBe(true);
    expect(fixed2025.every((snapshot) => snapshot.amountSnapshot === 1200)).toBe(true);
    expect(fixed2025.every((snapshot) => snapshot.nameSnapshot === "Rent")).toBe(true);
  });
});
