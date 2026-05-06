import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  bulkUpsertExpenses: vi.fn(),
  bulkUpsertCategories: vi.fn(),
  bulkUpsertPayees: vi.fn(),
  bulkUpsertFixedExpenses: vi.fn(),
  bulkUpsertSnapshots: vi.fn(),
  bulkUpsertIncomeSnapshots: vi.fn(),
  bulkUpsertSavingsSnapshots: vi.fn(),
  setSetting: vi.fn(),
  db: {
    schedules: { bulkPut: vi.fn() },
    categoryMergeHistory: { bulkPut: vi.fn() },
    payeeMergeHistory: { bulkPut: vi.fn() },
    settings: { put: vi.fn() },
  },
}));

const supabaseSelect = vi.hoisted(() => vi.fn());

vi.mock("../services/storageService", () => ({
  StorageService: {
    bulkUpsertExpenses: storageMocks.bulkUpsertExpenses,
    bulkUpsertCategories: storageMocks.bulkUpsertCategories,
    bulkUpsertPayees: storageMocks.bulkUpsertPayees,
    bulkUpsertFixedExpenses: storageMocks.bulkUpsertFixedExpenses,
    bulkUpsertSnapshots: storageMocks.bulkUpsertSnapshots,
    bulkUpsertIncomeSnapshots: storageMocks.bulkUpsertIncomeSnapshots,
    bulkUpsertSavingsSnapshots: storageMocks.bulkUpsertSavingsSnapshots,
    setSetting: storageMocks.setSetting,
    db: storageMocks.db,
  },
}));

vi.mock("../services/supabase", () => ({
  supabase: {
    from: supabaseSelect,
  },
}));

import { pullFromSupabase } from "../services/syncService";

function makeQuery(data: unknown[]) {
  return {
    select: () => ({
      eq: () => Promise.resolve({ data, error: null }),
    }),
  };
}

describe("pullFromSupabase", () => {
  beforeEach(() => {
    storageMocks.bulkUpsertExpenses.mockReset();
    storageMocks.bulkUpsertCategories.mockReset();
    storageMocks.bulkUpsertPayees.mockReset();
    storageMocks.bulkUpsertFixedExpenses.mockReset();
    storageMocks.bulkUpsertSnapshots.mockReset();
    storageMocks.bulkUpsertIncomeSnapshots.mockReset();
    storageMocks.bulkUpsertSavingsSnapshots.mockReset();
    storageMocks.setSetting.mockReset();
    storageMocks.db.schedules.bulkPut.mockReset();
    storageMocks.db.categoryMergeHistory.bulkPut.mockReset();
    storageMocks.db.payeeMergeHistory.bulkPut.mockReset();
    storageMocks.db.settings.put.mockReset();
    supabaseSelect.mockReset();
    supabaseSelect.mockImplementation((table: string) => {
      if (table === "expenses") {
        return makeQuery([
          {
            id: "101",
            date: "2026-05-05",
            category_id: "12",
            payee_id: "42",
            description: "Lunch",
            amount: 18.5,
          },
        ]);
      }
      if (table === "categories") {
        return makeQuery([{ id: "12", name: "Food", is_archived: false }]);
      }
      if (table === "payees") {
        return makeQuery([{ id: "42", name: "Cafe", is_archived: false }]);
      }
      if (table === "fixed_expenses") {
        return makeQuery([{ id: "7", name: "Rent", amount: 1500 }]);
      }
      if (table === "fixed_expense_snapshots") {
        return makeQuery([
          {
            id: "88",
            fixed_expense_id: "7",
            name_snapshot: "Rent",
            amount_snapshot: 1500,
            month: 5,
            year: 2026,
            created_at: "2026-05-01T00:00:00.000Z",
          },
        ]);
      }
      if (table === "settings") {
        return makeQuery([
          { key: "monthlyIncome", value: "5000" },
          { key: "scheduleMaterializationLog", value: "[]" },
        ]);
      }
      if (table === "income_snapshots") {
        return makeQuery([
          {
            id: "200",
            year: 2026,
            month: 5,
            amount_snapshot: 5000,
            created_at: "2026-05-01T00:00:00.000Z",
          },
        ]);
      }
      if (table === "savings_snapshots") {
        return makeQuery([
          {
            id: "201",
            year: 2026,
            month: 5,
            rate_snapshot: 0.2,
            created_at: "2026-05-01T00:00:00.000Z",
          },
        ]);
      }
      if (table === "schedules") {
        return makeQuery([
          {
            id: "300",
            type: "income",
            target_id: null,
            effective_year: 2026,
            effective_month: 6,
            new_value: 5500,
            previous_value: 5000,
            materialized_at: "2026-06-01T00:00:00.000Z",
            is_active: false,
            note: null,
            created_at: "2026-05-10T00:00:00.000Z",
            day: null,
            category_id: null,
            payee_id: null,
          },
        ]);
      }
      if (table === "category_merge_history") {
        return makeQuery([
          {
            id: "400",
            source_category_id: "12",
            target_category_id: "13",
            affected_expense_ids: ["101", "102"],
            created_at: "2026-05-02T00:00:00.000Z",
            reverted_at: null,
          },
        ]);
      }
      if (table === "payee_merge_history") {
        return makeQuery([
          {
            id: "401",
            source_payee_id: "42",
            target_payee_id: "43",
            affected_expense_ids: ["101"],
            created_at: "2026-05-03T00:00:00.000Z",
            reverted_at: null,
          },
        ]);
      }
      return makeQuery([]);
    });
  });

  it("normalizes cloud ids back to local numeric ids", async () => {
    await pullFromSupabase("user-1");

    expect(storageMocks.bulkUpsertExpenses).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 101,
        categoryId: 12,
        payeeId: 42,
      }),
    ]);
    expect(storageMocks.bulkUpsertCategories).toHaveBeenCalledWith([
      expect.objectContaining({ id: 12 }),
    ]);
    expect(storageMocks.bulkUpsertPayees).toHaveBeenCalledWith([
      expect.objectContaining({ id: 42 }),
    ]);
    expect(storageMocks.bulkUpsertFixedExpenses).toHaveBeenCalledWith([
      expect.objectContaining({ id: 7 }),
    ]);
    expect(storageMocks.bulkUpsertSnapshots).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 88,
        fixedExpenseId: 7,
      }),
    ]);
    expect(storageMocks.bulkUpsertIncomeSnapshots).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 200,
        year: 2026,
        month: 5,
        amountSnapshot: 5000,
      }),
    ]);
    expect(storageMocks.bulkUpsertSavingsSnapshots).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 201,
        year: 2026,
        month: 5,
        rateSnapshot: 0.2,
      }),
    ]);
    expect(storageMocks.db.schedules.bulkPut).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 300,
        isActive: 0,
        previousValue: 5000,
      }),
    ]);
    expect(storageMocks.db.categoryMergeHistory.bulkPut).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 400,
        sourceCategoryId: 12,
        targetCategoryId: 13,
        affectedExpenseIds: [101, 102],
      }),
    ]);
    expect(storageMocks.db.payeeMergeHistory.bulkPut).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 401,
        sourcePayeeId: 42,
        targetPayeeId: 43,
        affectedExpenseIds: [101],
      }),
    ]);
    expect(storageMocks.db.settings.put).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "monthlyIncome",
        value: 5000,
      }),
    );
  });
});
