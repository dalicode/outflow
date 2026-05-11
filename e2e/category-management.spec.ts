import { test } from "@playwright/test";
import {
  expect,
  getCategories,
  resetAppState,
} from "./helpers";

test.describe("Category management (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("add a new category from the expense form", async ({ page }) => {
    await page.getByTestId("btn-add-expense").first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    await page.getByRole("button", { name: "+ Manage" }).nth(1).click();
    await expect(page.getByRole("heading", { name: "Manage Categories" })).toBeVisible({ timeout: 5000 });

    const newCatInput = page.getByPlaceholder("New category…");
    await newCatInput.click();
    await newCatInput.fill("Test Category");
    await expect(newCatInput).toHaveValue("Test Category");

    const addBtn = page.getByRole("button", { name: "Add category" });
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await page.waitForTimeout(500);

    const catsAfter = await getCategories(page);
    expect(catsAfter.some((c) => c.name === "Test Category")).toBe(true);

    await page.getByRole("button", { name: "Done" }).first().click();
    await expect(page.getByRole("heading", { name: "Manage Categories" })).not.toBeVisible({ timeout: 3000 });
  });

  test("edit an existing category name", async ({ page }) => {
    // Add a category via test API then reload the page to refresh React state
    await page.evaluate(async () => {
      const api = (window as Window & {
        outflowTestApi?: typeof import("../src/test/testApi").testApi;
      }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      await api.addCategory("TestCategory");
    });

    // Reload so App refetches categories into state
    await page.reload();
    await page.getByTestId("dashboard").waitFor({ timeout: 15000 });

    const categories = await getCategories(page);
    const targetCat = categories.find((c) => c.name === "TestCategory");
    expect(targetCat?.id).toBeTruthy();

    await page.getByTestId("btn-add-expense").first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();

    await page.getByRole("button", { name: "+ Manage" }).nth(1).click();
    await expect(page.getByRole("heading", { name: "Manage Categories" })).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder("Search categories...").fill("TestCategory");

    // Find the TestCategory row and click Edit
    const catRow = page.locator(`[data-testid^="category-row-"]`).filter({ hasText: "TestCategory" });
    await catRow.getByRole("button", { name: "Edit" }).click();

    // After Edit is clicked, the row shows an input with value "TestCategory"
    await page.waitForTimeout(300);
    const editInput = page.locator('input[value="TestCategory"]').nth(1);
    await expect(editInput).toBeVisible({ timeout: 3000 });
    await editInput.fill("RenamedCategory");

    // The row now has "RenamedCategory" as text — find the Save button (the category edit one)
    await page.getByRole("button", { name: "Save" }).last().click();

    const updatedCategories = await getCategories(page);
    expect(updatedCategories.some((c) => c.name === "RenamedCategory")).toBe(true);

    await page.getByRole("button", { name: "Done" }).first().click();
  });
});
