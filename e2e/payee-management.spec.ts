import { test } from "@playwright/test";
import {
  addPayee,
  expect,
  getPayees,
  resetAppState,
} from "./helpers";

test.describe("Payee management (desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("archive payee and undo from manage payees", async ({ page }) => {
    await addPayee(page, "Undo Payee");

    await page.reload();
    await page.getByTestId("dashboard").waitFor({ timeout: 15000 });

    const payees = await getPayees(page);
    const targetPayee = payees.find((payee) => payee.name === "Undo Payee");
    expect(targetPayee?.id).toBeTruthy();

    await page.getByTestId("btn-add-expense").first().click();
    await expect(page.getByTestId("expense-form")).toBeVisible();
    await page.getByRole("button", { name: "+ Manage" }).first().click();
    await expect(page.getByRole("heading", { name: "Manage Payees" })).toBeVisible({
      timeout: 5000,
    });

    await page.getByPlaceholder("Search payees...").fill("Undo Payee");

    const payeeRow = page.getByRole("listitem").filter({ hasText: "Undo Payee" });
    await expect(payeeRow).toBeVisible();

    await payeeRow.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "Delete payee" })).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).last().click();

    await expect(payeeRow).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Payee archived.")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();

    await expect
      .poll(async () => (await getPayees(page)).some((payee) => payee.name === "Undo Payee"))
      .toBe(true);
    await expect(payeeRow).toBeVisible({ timeout: 3000 });
  });
});
