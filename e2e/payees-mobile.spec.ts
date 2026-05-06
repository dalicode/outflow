import { test, expect } from "@playwright/test";

test.describe("Payees — mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/payees");
    await page.getByTestId("payees-page").waitFor({ timeout: 15000 });
  });

  test("payees page renders with existing payees", async ({ page }) => {
    await expect(page.getByTestId("payees-page")).toBeVisible();
    // Default payees should exist
    await expect(page.getByText("No payees yet.")).not.toBeVisible();
  });

  test("add a new payee", async ({ page }) => {
    const newPayeeInput = page.getByPlaceholder("New payee name");
    await newPayeeInput.fill("Test Payee");

    await page.getByTestId("btn-add-payee").click();

    await expect(page.getByText("Test payee")).toBeVisible({ timeout: 5000 });
  });

  test("search filters payees", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search payees...");
    await searchInput.fill("xyznoresults");
    await expect(page.getByText("No payees match your search.")).toBeVisible({ timeout: 5000 });

    await searchInput.fill("");
    await expect(page.getByText("No payees yet.")).not.toBeVisible({ timeout: 5000 });
  });

  test("edit a payee inline", async ({ page }) => {
    // Wait for payee rows to render
    const payeeRows = page.locator("[data-testid^='payee-row-']");
    await expect(payeeRows.first()).toBeVisible({ timeout: 5000 });

    // Click Edit on the first payee
    const firstRow = payeeRows.first();
    await firstRow.locator("text=Edit").click();

    // Inline edit input should appear with a Save button
    await expect(firstRow.locator("text=Save")).toBeVisible({ timeout: 3000 });
  });
});