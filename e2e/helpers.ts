import { test as base, expect } from "@playwright/test";

export function clearAndSeed(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const api = (window as unknown as { outflowTestApi?: typeof import("../../src/test/testApi").testApi }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found – is the app running in dev mode?");
    await api.clearAllData();
  });
}

export function seedExpenses(
  page: import("@playwright/test").Page,
  entries: Array<{
    date: string;
    amount: number;
    categoryId?: number;
    payeeId?: number;
    description?: string;
  }>,
) {
  return page.evaluate(async (data) => {
    const api = (window as unknown as { outflowTestApi?: typeof import("../../src/test/testApi").testApi }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    await api.seedExpenses(data);
  }, entries);
}

export function waitForAppReady(page: import("@playwright/test").Page) {
  return page.getByTestId("dashboard").waitFor({ timeout: 15000 });
}

export async function navigateToExpenseForm(page: import("@playwright/test").Page) {
  await page.getByTestId("btn-add-expense").first().click();
  await page.getByTestId("expense-form").waitFor();
}

export { expect };