import { StorageService } from '../services/storageService'
import { fakeSupabase } from '../services/fakeSupabase'
import type { Expense, Schedule } from '../types'

declare global {
  interface Window {
    outflowTestApi?: typeof testApi
  }
}

export const testApi = {
  syncHandlers: {
    syncNow: null as null | (() => Promise<void>),
    syncLocalThenPull: null as null | (() => Promise<void>),
  },

  setSyncHandlers: (handlers: { syncNow: () => Promise<void>; syncLocalThenPull: () => Promise<void> }) => {
    testApi.syncHandlers.syncNow = handlers.syncNow
    testApi.syncHandlers.syncLocalThenPull = handlers.syncLocalThenPull
  },

  clearAllData: () => StorageService.clearAllData(),

  seedExpenses: async (
    entries: Array<{
      date: string
      amount: number
      categoryId?: number
      payeeId?: number
      description?: string
    }>,
  ) => {
    for (const e of entries) {
      await StorageService.add(e as Omit<Expense, 'id'>)
    }
  },

  seedSettings: async (settings: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(settings)) {
      await StorageService.setSetting(key, value)
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
  addFixedExpense: (item: { name: string; amount: number }) => StorageService.addFixedExpense(item),
  setSetting: (key: string, value: unknown) => StorageService.setSetting(key, value),
  getSetting: (key: string) => StorageService.getSetting(key),

  exportAllData: () => StorageService.exportAllData(),
  importAllData: (data: Record<string, unknown>, opts?: { replace?: boolean }) =>
    StorageService.importAllData(data, opts),

  getSchedules: () => StorageService.getSchedules(),
  addSchedule: (schedule: Omit<Schedule, 'id' | 'isActive' | 'createdAt'>) =>
    StorageService.addSchedule(schedule),
  deleteSchedule: (id: number) => StorageService.deleteSchedule(id),

  materializePendingSnapshots: () => StorageService.materializePendingSnapshots(),

  setFakeSignedInUser: async (userId: string, email: string) => {
    await fakeSupabase.auth.signInWithPassword({ email, password: 'test-password' })
    fakeSupabase.auth.setSessionForTests(userId, email)
  },

  resetFakeCloud: async () => {
    await fakeSupabase.resetFakeCloud()
  },

  seedFakeCloudExpenses: async (
    userId: string,
    entries: Array<Record<string, unknown>>,
  ) => {
    await fakeSupabase.seedFakeCloudExpenses(userId, entries)
  },

  inspectFakeCloudExpenses: async (userId: string) => fakeSupabase.inspectFakeCloudExpenses(userId),

  triggerManualSync: async () => {
    if (!testApi.syncHandlers.syncLocalThenPull) {
      throw new Error('syncLocalThenPull handler is not installed')
    }
    await testApi.syncHandlers.syncLocalThenPull()
  },
}

export function installTestApi(): void {
  if (typeof window !== 'undefined') {
    window.outflowTestApi = testApi
  }
}
