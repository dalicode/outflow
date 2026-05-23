import { test, expect } from "./live-sync.fixture";
import { clearLiveSupabaseUserDataByAdmin } from "./liveSupabaseAdmin";
import {
  clearAllData,
  getAllExpenses,
  getAllExpensesIncludingDeleted,
  getFirstCategoryId,
  getSyncMetadataCounts,
  resetLiveSyncState,
  seedExpenses,
  signInLiveSupabaseUser,
  signOutLiveSupabaseUser,
  triggerManualSync,
  updateExpenseForSyncTest,
  deleteExpenseForSyncTest,
  restoreExpenseForSyncTest,
} from "./helpers";

async function setContextOffline(page: import("@playwright/test").Page, offline: boolean): Promise<void> {
  await page.context().setOffline(offline);
  await page.evaluate((nextOffline) => {
    window.dispatchEvent(new Event(nextOffline ? "offline" : "online"));
  }, offline);
}

async function expectSyncLabel(
  page: import("@playwright/test").Page,
  label: "Cloud synced" | "Syncing" | "Sync error" | "Offline",
): Promise<void> {
  await expect(page.locator(`[aria-label="${label}"]`).first()).toBeVisible({ timeout: 20000 });
}

async function triggerManualSyncRounds(
  pages: import("@playwright/test").Page[],
  rounds = 1,
): Promise<void> {
  for (let round = 0; round < rounds; round += 1) {
    for (const page of pages) {
      await triggerManualSync(page);
    }
  }
}

async function waitForZeroPendingSync(
  page: import("@playwright/test").Page,
): Promise<void> {
  await expect.poll(async () => (await getSyncMetadataCounts(page)).pending).toBe(0);
}

async function addSeedExpense(
  page: import("@playwright/test").Page,
  description: string,
  amount = 11.11,
): Promise<void> {
  const categoryId = await getFirstCategoryId(page);
  await seedExpenses(page, [
    {
      categoryId,
      amount,
      date: new Date().toISOString().slice(0, 10),
      description,
    },
  ]);
}

function supabaseRestPattern(tableName: string): RegExp {
  return new RegExp(`/rest/v1/${tableName}(?:\\?|$)`);
}

test.describe("Live Supabase sync (UAT)", () => {
  test("offline create syncs across two contexts once online", async ({ browser, liveUser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await resetLiveSyncState([pageA, pageB], liveUser.email, liveUser.password);
      await setContextOffline(pageA, true);
      await expectSyncLabel(pageA, "Offline");
      await addSeedExpense(pageA, "uat-offline-create");
      await setContextOffline(pageA, false);
      await triggerManualSyncRounds([pageA, pageB], 2);
      await expect.poll(async () => (await getAllExpenses(pageB)).some((x) => x.description === "uat-offline-create")).toBe(true);
      await waitForZeroPendingSync(pageA);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("offline edit syncs after reconnect", async ({ browser, liveUser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await resetLiveSyncState([pageA, pageB], liveUser.email, liveUser.password);
      await addSeedExpense(pageA, "uat-edit-base", 20);
      await triggerManualSync(pageA);
      await triggerManualSync(pageB);

      const expenseOnA = (await getAllExpenses(pageA)).find((x) => x.description === "uat-edit-base");
      expect(expenseOnA?.id).toBeTruthy();

      await setContextOffline(pageA, true);
      await updateExpenseForSyncTest(pageA, expenseOnA?.id as number, { amount: 88.45, description: "uat-edit-offline" });
      await pageA.waitForTimeout(3000);
      await setContextOffline(pageA, false);
      await triggerManualSyncRounds([pageA, pageB], 2);

      await waitForZeroPendingSync(pageA);
      await expect
        .poll(async () => (await getAllExpenses(pageA)).find((x) => x.localId === expenseOnA?.localId)?.amount ?? 0)
        .toBe(88.45);
      await expect
        .poll(async () => (await getAllExpenses(pageA)).find((x) => x.localId === expenseOnA?.localId)?.description ?? "")
        .toBe("uat-edit-offline");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("concurrent edit conflict resolves to a single stable value", async ({ browser, liveUser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await resetLiveSyncState([pageA, pageB], liveUser.email, liveUser.password);

      await addSeedExpense(pageA, "uat-conflict-edit", 40);
      await triggerManualSync(pageA);
      await triggerManualSync(pageB);
      const shared = (await getAllExpenses(pageA)).find((x) => x.description === "uat-conflict-edit");
      const sharedOnB = (await getAllExpenses(pageB)).find((x) => x.localId === shared?.localId);
      expect(shared?.id).toBeTruthy();
      expect(sharedOnB?.id).toBeTruthy();

      await setContextOffline(pageA, true);
      await setContextOffline(pageB, true);
      await updateExpenseForSyncTest(pageA, shared?.id as number, { amount: 45.01 });
      await pageB.waitForTimeout(75);
      await updateExpenseForSyncTest(pageB, sharedOnB?.id as number, { amount: 49.99 });
      await setContextOffline(pageA, false);
      await setContextOffline(pageB, false);
      await triggerManualSyncRounds([pageA, pageB], 4);

      await expect
        .poll(async () => (await getAllExpenses(pageA)).find((x) => x.localId === shared?.localId)?.amount ?? 0)
        .toBe(49.99);
      await expect
        .poll(async () => (await getAllExpenses(pageB)).find((x) => x.localId === shared?.localId)?.amount ?? 0)
        .toBe(49.99);

      const amountA = (await getAllExpenses(pageA)).find((x) => x.localId === shared?.localId)?.amount;
      const amountB = (await getAllExpenses(pageB)).find((x) => x.localId === shared?.localId)?.amount;
      expect(amountA).toBe(amountB);
      expect(amountA).toBe(49.99);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("delete conflict converges without duplicate rows", async ({ browser, liveUser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await resetLiveSyncState([pageA, pageB], liveUser.email, liveUser.password);
      await addSeedExpense(pageA, "uat-delete-conflict", 55);
      await triggerManualSync(pageA);
      await triggerManualSync(pageB);
      const shared = (await getAllExpenses(pageA)).find((x) => x.description === "uat-delete-conflict");
      const sharedOnB = (await getAllExpenses(pageB)).find((x) => x.localId === shared?.localId);
      expect(shared?.id).toBeTruthy();
      expect(sharedOnB?.id).toBeTruthy();

      await setContextOffline(pageA, true);
      await deleteExpenseForSyncTest(pageA, shared?.id as number);
      await setContextOffline(pageB, true);
      await updateExpenseForSyncTest(pageB, sharedOnB?.id as number, { amount: 56.78, description: "uat-delete-vs-edit" });

      await setContextOffline(pageA, false);
      await setContextOffline(pageB, false);
      await triggerManualSyncRounds([pageA, pageB], 4);

      await expect.poll(async () => {
        const allA = await getAllExpensesIncludingDeleted(pageA);
        const rows = allA.filter((x) => x.localId === shared?.localId);
        if (rows.length !== 1) return "";
        const row = rows[0];
        return row.deletedAt != null || row.description === "uat-delete-vs-edit" ? "resolved" : "";
      }).not.toBe("");

      const allA = await getAllExpensesIncludingDeleted(pageA);
      const rows = allA.filter((x) => x.localId === shared?.localId);
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row.deletedAt != null || row.description === "uat-delete-vs-edit").toBeTruthy();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("delete undo syncs across contexts after a remote delete", async ({ browser, liveUser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await resetLiveSyncState([pageA, pageB], liveUser.email, liveUser.password);

      await addSeedExpense(pageA, "uat-delete-undo-roundtrip", 33.33);
      await triggerManualSyncRounds([pageA, pageB], 2);

      const createdOnA = (await getAllExpenses(pageA)).find(
        (x) => x.description === "uat-delete-undo-roundtrip",
      );
      expect(createdOnA?.id).toBeTruthy();
      expect(createdOnA?.localId).toBeTruthy();

      await expect
        .poll(async () =>
          (await getAllExpenses(pageB)).find((x) => x.localId === createdOnA?.localId) ?? null,
        )
        .not.toBeNull();

      const sharedOnB = (await getAllExpenses(pageB)).find((x) => x.localId === createdOnA?.localId);
      expect(sharedOnB?.id).toBeTruthy();

      await deleteExpenseForSyncTest(pageB, sharedOnB?.id as number);
      await triggerManualSyncRounds([pageB, pageA], 2);

      await expect
        .poll(async () => {
          const allA = await getAllExpensesIncludingDeleted(pageA);
          const row = allA.find((x) => x.localId === createdOnA?.localId);
          return row?.deletedAt ?? null;
        })
        .not.toBeNull();

      await expect
        .poll(async () => (await getAllExpenses(pageA)).some((x) => x.localId === createdOnA?.localId))
        .toBe(false);

      await restoreExpenseForSyncTest(pageB, sharedOnB?.id as number);
      await triggerManualSyncRounds([pageB, pageA], 2);

      await expect
        .poll(async () => {
          const activeA = await getAllExpenses(pageA);
          return activeA.find((x) => x.localId === createdOnA?.localId) ?? null;
        })
        .not.toBeNull();

      await expect
        .poll(async () => {
          const allA = await getAllExpensesIncludingDeleted(pageA);
          const rows = allA.filter((x) => x.localId === createdOnA?.localId);
          if (rows.length !== 1) return "";
          return rows[0]?.deletedAt == null ? "active" : "deleted";
        })
        .toBe("active");

      const finalA = (await getAllExpenses(pageA)).filter((x) => x.localId === createdOnA?.localId);
      expect(finalA).toHaveLength(1);
      expect(finalA[0]?.description).toBe("uat-delete-undo-roundtrip");

      await waitForZeroPendingSync(pageA);
      await waitForZeroPendingSync(pageB);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("interrupted sync resumes safely without duplicates", async ({ browser, liveUser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await resetLiveSyncState([pageA, pageB], liveUser.email, liveUser.password);

      await addSeedExpense(pageA, "uat-interrupted-sync", 61.23);
      let aborted = false;
      await pageA.route(supabaseRestPattern("expenses"), async (route) => {
        if (!aborted && route.request().method() !== "GET") {
          aborted = true;
          await route.abort();
          return;
        }
        await route.continue();
      });

      await triggerManualSync(pageA).catch(() => undefined);
      expect(aborted).toBe(true);
      await expectSyncLabel(pageA, "Sync error");
      expect((await getSyncMetadataCounts(pageA)).failed).toBeGreaterThan(0);

      await pageA.unroute(supabaseRestPattern("expenses"));
      await triggerManualSync(pageA);
      await triggerManualSync(pageB);

      await expect
        .poll(async () => (await getAllExpenses(pageB)).filter((x) => x.description === "uat-interrupted-sync").length)
        .toBe(1);
      await expectSyncLabel(pageA, "Cloud synced");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("long offline catch-up reaches B final state", async ({ browser, liveUser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await resetLiveSyncState([pageA, pageB], liveUser.email, liveUser.password);

      await setContextOffline(pageA, true);
      const categoryId = await getFirstCategoryId(pageB);
      await seedExpenses(
        pageB,
        Array.from({ length: 15 }, (_, index) => ({
          categoryId,
          amount: 100 + index,
          date: new Date().toISOString().slice(0, 10),
          description: `uat-catch-up-${index.toString().padStart(2, "0")}`,
        })),
      );
      await triggerManualSync(pageB);

      await setContextOffline(pageA, false);
      await triggerManualSync(pageA);
      await expect
        .poll(async () => (await getAllExpenses(pageA)).filter((x) => x.description?.startsWith("uat-catch-up-")).length)
        .toBe(15);
      expect((await getAllExpenses(pageA)).find((x) => x.description === "uat-catch-up-14")?.amount).toBe(114);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("pending changes persist until reconnect and sync status reflects transitions", async ({ browser, liveUser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await resetLiveSyncState([page], liveUser.email, liveUser.password);
      await setContextOffline(page, true);
      await addSeedExpense(page, "uat-pending-restart", 66.6);
      await expectSyncLabel(page, "Offline");
      expect((await getSyncMetadataCounts(page)).pending).toBeGreaterThan(0);

      await setContextOffline(page, false);
      await triggerManualSync(page);
      await waitForZeroPendingSync(page);
      await expect.poll(async () => (await getAllExpenses(page)).some((x) => x.description === "uat-pending-restart")).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("auth expires while offline (closest runnable): local session reset while offline keeps data and syncs after re-auth", async ({
    browser,
    liveUser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await resetLiveSyncState([page], liveUser.email, liveUser.password);
      await setContextOffline(page, true);
      await addSeedExpense(page, "uat-auth-offline", 77.7);
      await setContextOffline(page, false);
      await signOutLiveSupabaseUser(page);
      await signInLiveSupabaseUser(page, liveUser.email, liveUser.password);
      await page.waitForTimeout(1000);
      await triggerManualSync(page);
      await expect.poll(async () => (await getSyncMetadataCounts(page)).pending).toBe(0);
      await expect.poll(async () => (await getAllExpenses(page)).some((x) => x.description === "uat-auth-offline")).toBe(true);
    } finally {
      await context.close();
    }
  });

  test("user can delete all data and return to an empty sync state", async ({ browser, liveUser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await resetLiveSyncState([pageA, pageB], liveUser.email, liveUser.password);
      await addSeedExpense(pageA, "uat-delete-all", 12.34);
      await triggerManualSync(pageA);
      await triggerManualSync(pageB);

      await expect
        .poll(async () => (await getAllExpenses(pageB)).some((x) => x.description === "uat-delete-all"))
        .toBe(true);

      await clearAllData(pageA);
      await clearAllData(pageB);
      await clearLiveSupabaseUserDataByAdmin(liveUser.id);
      await triggerManualSyncRounds([pageA, pageB], 4);

      await expect.poll(async () => (await getAllExpenses(pageA)).length).toBe(0);
      await expect.poll(async () => (await getAllExpenses(pageB)).length).toBe(0);
      await waitForZeroPendingSync(pageA);
      await waitForZeroPendingSync(pageB);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
