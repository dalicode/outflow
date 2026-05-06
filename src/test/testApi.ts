import { StorageService } from "../services/storageService";
import type { Expense, Category } from "../types";

declare global {
  interface Window {
    outflowTestApi?: typeof testApi;
  }
}

const testApi = {
  clearAllData: () => StorageService.clearAllData(),

  seedExpenses: async (
    entries: Array<{
      date: string;
      amount: number;
      categoryId?: number;
      payeeId?: number;
      description?: string;
    }>,
  ) => {
    for (const e of entries) {
      await StorageService.add(e as Omit<Expense, "id">);
    }
  },

  seedSettings: async (
    settings: Record<string, unknown>,
  ) => {
    for (const [key, value] of Object.entries(settings)) {
      await StorageService.setSetting(key, value);
    }
  },

  getCategories: () => StorageService.getCategories(),
  getPayees: () => StorageService.getPayees(),
  getAllExpenses: () => StorageService.getAll(),
  getAllIncomeSnapshots: () => StorageService.getAllIncomeSnapshots(),
  getAllSavingsSnapshots: () => StorageService.getAllSavingsSnapshots(),
  getAllFixedExpenseSnapshots: () => StorageService.getAllFixedExpenseSnapshots(),
  addCategory: (name: string) => StorageService.addCategory(name),
  addPayee: (name: string) => StorageService.addPayee(name),
  addFixedExpense: (item: { name: string; amount: number }) =>
    StorageService.addFixedExpense(item),
  setSetting: (key: string, value: unknown) =>
    StorageService.setSetting(key, value),
  getSetting: (key: string) => StorageService.getSetting(key),

  exportAllData: () => StorageService.exportAllData(),
  importAllData: (
    data: Record<string, unknown>,
    opts?: { replace?: boolean },
  ) => StorageService.importAllData(data, opts),
};

export function installTestApi(): void {
  if (typeof window !== "undefined") {
    window.outflowTestApi = testApi;
  }
}
