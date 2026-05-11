import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export interface SeedExpenseEntry {
  date: string;
  amount: number;
  categoryId?: number;
  payeeId?: number;
  description?: string;
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.getByTestId("dashboard").waitFor({ timeout: 15000 });
}

export async function gotoAndWait(page: Page, path = "/"): Promise<void> {
  await page.goto(path);
  if (path === "/" || path === "/summary" || path === "/analytics" || path === "/payees" || path === "/settings") {
    await waitForAppReady(page).catch(() => undefined);
  }
}

export async function clearAllData(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found – is the app running in dev mode?");
    await api.clearAllData();
  });
}

export async function seedExpenses(page: Page, entries: SeedExpenseEntry[]): Promise<void> {
  await page.evaluate(async (data) => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    await api.seedExpenses(data);
  }, entries);
}

export async function seedSettings(
  page: Page,
  settings: Record<string, unknown>,
): Promise<void> {
  await page.evaluate(async (data) => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    await api.seedSettings(data);
  }, settings);
}

export async function addCategory(page: Page, name: string): Promise<number> {
  return page.evaluate(async (categoryName) => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    return api.addCategory(categoryName);
  }, name);
}

export async function addPayee(page: Page, name: string): Promise<number> {
  return page.evaluate(async (payeeName) => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    return api.addPayee(payeeName);
  }, name);
}

export async function exportAllData(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async () => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    return api.exportAllData();
  });
}

export async function importAllData(
  page: Page,
  data: Record<string, unknown>,
  opts?: { replace?: boolean },
): Promise<void> {
  await page.evaluate(
    async ({ importData, importOpts }) => {
      const api = (window as Window & {
        outflowTestApi?: typeof import("../src/test/testApi").testApi;
      }).outflowTestApi;
      if (!api) throw new Error("outflowTestApi not found");
      await api.importAllData(importData, importOpts);
    },
    { importData: data, importOpts: opts },
  );
}

export async function getCategories(page: Page): Promise<Array<{ id?: number; name: string }>> {
  return page.evaluate(async () => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    return api.getCategories();
  });
}

export async function getAllExpenses(
  page: Page,
): Promise<Array<{ id?: number; date: string; amount: number; description?: string }>> {
  return page.evaluate(async () => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    return api.getAllExpenses();
  });
}

export async function getPayees(
  page: Page,
): Promise<Array<{ id?: number; name: string; isArchived?: boolean; mergedIntoPayeeId?: number | null }>> {
  return page.evaluate(async () => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    return api.getPayees();
  });
}

export async function getIncomeSnapshots(
  page: Page,
): Promise<Array<{ year: number; month: number; amountSnapshot: number }>> {
  return page.evaluate(async () => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    return api.getAllIncomeSnapshots();
  });
}

export async function getSavingsSnapshots(
  page: Page,
): Promise<Array<{ year: number; month: number; rateSnapshot: number }>> {
  return page.evaluate(async () => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    return api.getAllSavingsSnapshots();
  });
}

export async function getFixedExpenseSnapshots(
  page: Page,
): Promise<Array<{ year: number; month: number; amountSnapshot: number; nameSnapshot: string }>> {
  return page.evaluate(async () => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    return api.getAllFixedExpenseSnapshots();
  });
}

export async function getFirstCategoryId(page: Page): Promise<number> {
  const categories = await getCategories(page);
  const id = categories[0]?.id;
  if (!id) {
    throw new Error("No seeded categories available");
  }
  return id;
}

export async function resetAppState(
  page: Page,
  options?: {
    route?: string;
    expenses?: SeedExpenseEntry[];
    settings?: Record<string, unknown>;
  },
): Promise<void> {
  await gotoAndWait(page, "/");
  await clearAllData(page);

  if (options?.settings) {
    await seedSettings(page, options.settings);
  }

  if (options?.expenses?.length) {
    const categoryId = await getFirstCategoryId(page);
    const normalized = options.expenses.map((entry) => ({
      ...entry,
      categoryId: entry.categoryId ?? categoryId,
    }));
    await seedExpenses(page, normalized);
  }

  await page.goto(options?.route ?? "/");
  await waitForRouteReady(page, options?.route ?? "/");
}

export async function waitForRouteReady(page: Page, path: string): Promise<void> {
  if (path === "/") {
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 15000 });
    return;
  }

  if (path === "/summary") {
    await expect(page.getByTestId("summary-page")).toBeVisible({ timeout: 15000 });
    return;
  }

  if (path === "/analytics") {
    await expect(page.getByTestId("analytics-page")).toBeVisible({ timeout: 15000 });
    return;
  }

  if (path === "/payees") {
    await expect(page.getByTestId("payees-page")).toBeVisible({ timeout: 15000 });
    return;
  }

  if (path === "/settings") {
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 15000 }).catch(() => {
      if (!page.url().includes('/settings')) {
        throw new Error(`Not on settings page: ${page.url()}`)
      }
    });
    return;
  }

  await page.waitForLoadState("networkidle");
}

export async function navigateToExpenseForm(page: Page): Promise<void> {
  await page.getByTestId("btn-add-expense").first().click();
  await page.getByTestId("expense-form").waitFor();
}

export async function openMobileSecondaryNav(page: Page): Promise<void> {
  const handle = page.getByRole("button", { name: "Expand navigation" });
  const box = await handle.boundingBox();
  if (!box) {
    throw new Error("Mobile navigation handle is not measurable");
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX, centerY - 96, { steps: 6 });
  await page.mouse.up();

  await expect(
    page.locator(".mobile-nav-row-secondary").getByTestId("nav-analytics"),
  ).toBeVisible({ timeout: 2000 });
}

export async function longPressElement(
  page: Page,
  selector: string,
  durationMs = 650,
): Promise<void> {
  const locator = page.locator(selector).first();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Element for long press is not measurable: ${selector}`);
  }

  const clientX = Math.round(box.x + box.width / 2);
  const clientY = Math.round(box.y + box.height / 2);

  const touchPayload = {
    bubbles: true,
    cancelable: true,
    composed: true,
    touches: [{ identifier: 1, clientX, clientY }],
    targetTouches: [{ identifier: 1, clientX, clientY }],
    changedTouches: [{ identifier: 1, clientX, clientY }],
  };

  await locator.dispatchEvent("touchstart", touchPayload);
  await page.waitForTimeout(durationMs);
  await locator.dispatchEvent("touchend", {
    bubbles: true,
    cancelable: true,
    composed: true,
    touches: [],
    targetTouches: [],
    changedTouches: [{ identifier: 1, clientX, clientY }],
  });
}

export async function getSchedules(
  page: Page,
): Promise<Array<{ id?: number; type: string; effectiveYear: number; effectiveMonth: number; newValue: number; isActive: number; note?: string }>> {
  return page.evaluate(async () => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    return api.getSchedules();
  });
}

export async function addSchedule(
  page: Page,
  schedule: Record<string, unknown>,
): Promise<void> {
  await page.evaluate(async (data) => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    await api.addSchedule(data);
  }, schedule);
}

export async function deleteSchedule(page: Page, id: number): Promise<void> {
  await page.evaluate(async (scheduleId) => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    await api.deleteSchedule(scheduleId);
  }, id);
}

export async function materializePendingSnapshots(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    await api.materializePendingSnapshots();
  });
}

export async function getSetting(
  page: Page,
  key: string,
): Promise<unknown> {
  return page.evaluate(async (settingKey) => {
    const api = (window as Window & {
      outflowTestApi?: typeof import("../src/test/testApi").testApi;
    }).outflowTestApi;
    if (!api) throw new Error("outflowTestApi not found");
    return api.getSetting(settingKey);
  }, key);
}

export async function getFirstExpenseId(page: Page): Promise<number> {
  const expenses = await getAllExpenses(page);
  return expenses[0]?.id ?? 0;
}

export { expect };
