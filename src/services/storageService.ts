import * as expenseRepo from './repositories/expenseRepository'
import * as settingsRepo from './repositories/settingsRepository'
import * as fixedExpenseRepo from './repositories/fixedExpenseRepository'
import * as snapshotRepo from './repositories/snapshotRepository'
import * as scheduleRepo from './repositories/scheduleRepository'
import * as categoryRepo from './repositories/categoryRepository'
import * as payeeRepo from './repositories/payeeRepository'
import * as syncRepo from './repositories/syncRepository'
import * as backupRepo from './repositories/backupRepository'
import { snapshotIncome, snapshotSavings } from './repositories/common'
import db from './db/schema'

export const StorageService = {
  db,
  // ── Expenses ──────────────────────────────────────────────
  getAll: expenseRepo.getAll,
  add: expenseRepo.add,
  update: expenseRepo.update,
  remove: expenseRepo.remove,
  removeMany: expenseRepo.removeMany,
  bulkAddExpensesForImport: expenseRepo.bulkAddForImport,
  replaceAllExpenses: expenseRepo.replaceAll,
  getExpenseCountForCategory: expenseRepo.getExpenseCountForCategory,
  getExpenseCountForPayee: expenseRepo.getExpenseCountForPayee,

  // ── Settings ──────────────────────────────────────────────
  getSetting: settingsRepo.getSetting,
  setSetting: settingsRepo.setSetting,
  setLocalSetting: settingsRepo.setLocalSetting,

  // ── Fixed Expenses ────────────────────────────────────────
  getFixedExpenses: fixedExpenseRepo.getFixedExpenses,
  getActiveFixedExpenses: fixedExpenseRepo.getActiveFixedExpenses,
  addFixedExpense: fixedExpenseRepo.addFixedExpense,
  addArchivedFixedExpense: fixedExpenseRepo.addArchivedFixedExpense,
  updateFixedExpense: fixedExpenseRepo.updateFixedExpense,
  removeFixedExpense: fixedExpenseRepo.removeFixedExpense,

  // ── Fixed Expense Snapshots ───────────────────────────────
  getSnapshotsForYear: fixedExpenseRepo.getSnapshotsForYear,
  getAllFixedExpenseSnapshots: fixedExpenseRepo.getAllFixedExpenseSnapshots,
  bulkUpsertSnapshots: fixedExpenseRepo.bulkUpsertSnapshots,
  deleteSnapshotsForYear: fixedExpenseRepo.deleteSnapshotsForYear,

  // ── Income Snapshots ──────────────────────────────────────
  getIncomeSnapshot: snapshotRepo.getIncomeSnapshot,
  setIncomeSnapshot: snapshotIncome,
  getIncomeSnapshotsForYear: snapshotRepo.getIncomeSnapshotsForYear,
  getAllIncomeSnapshots: snapshotRepo.getAllIncomeSnapshots,
  bulkUpsertIncomeSnapshots: snapshotRepo.bulkUpsertIncomeSnapshots,
  deleteIncomeSnapshotsForYear: snapshotRepo.deleteIncomeSnapshotsForYear,

  // ── Savings Snapshots ─────────────────────────────────────
  getSavingsSnapshot: snapshotRepo.getSavingsSnapshot,
  setSavingsSnapshot: snapshotSavings,
  getSavingsSnapshotsForYear: snapshotRepo.getSavingsSnapshotsForYear,
  getAllSavingsSnapshots: snapshotRepo.getAllSavingsSnapshots,
  bulkUpsertSavingsSnapshots: snapshotRepo.bulkUpsertSavingsSnapshots,
  deleteSavingsSnapshotsForYear: snapshotRepo.deleteSavingsSnapshotsForYear,

  // ── Schedule Materialization ──────────────────────────────
  materializePendingSnapshots: scheduleRepo.materializePendingSnapshots,
  rolloverSnapshots: scheduleRepo.rolloverSnapshots,

  // ── Scheduled Changes ─────────────────────────────────────
  getSchedules: scheduleRepo.getSchedules,
  getActiveSchedules: scheduleRepo.getActiveSchedules,
  addSchedule: scheduleRepo.addSchedule,
  updateSchedule: scheduleRepo.updateSchedule,
  deleteSchedule: scheduleRepo.deleteSchedule,

  // ── Categories ────────────────────────────────────────────
  getCategories: categoryRepo.getCategories,
  addCategory: categoryRepo.addCategory,
  ensureCategoriesForImport: categoryRepo.ensureForImport,
  updateCategory: categoryRepo.updateCategory,
  deleteCategory: categoryRepo.deleteCategory,
  mergeCategory: categoryRepo.mergeCategory,
  revertCategoryMerge: categoryRepo.revertCategoryMerge,

  // ── Payees ────────────────────────────────────────────────
  getPayees: payeeRepo.getPayees,
  getActivePayees: payeeRepo.getActivePayees,
  addPayee: payeeRepo.addPayee,
  updatePayee: payeeRepo.updatePayee,
  ensurePayeesForImport: payeeRepo.ensureForImport,
  archivePayee: payeeRepo.archivePayee,
  unarchivePayee: payeeRepo.unarchivePayee,
  mergePayee: payeeRepo.mergePayee,
  revertPayeeMerge: payeeRepo.revertPayeeMerge,

  // ── Sync Queue ───────────────────────────────────────────
  getSyncQueue: syncRepo.getSyncQueue,
  removeSyncQueueItem: syncRepo.removeSyncQueueItem,
  clearSyncQueue: syncRepo.clearSyncQueue,

  // ── Danger zone ───────────────────────────────────────────
  clearAllData: backupRepo.clearAllData,

  // ── Bulk upsert (used by incoming sync merge) ─────────────
  bulkUpsertExpenses: backupRepo.bulkUpsertExpenses,
  bulkUpsertCategories: backupRepo.bulkUpsertCategories,
  bulkUpsertPayees: backupRepo.bulkUpsertPayees,
  bulkUpsertFixedExpenses: backupRepo.bulkUpsertFixedExpenses,

  // ── Full data backup ──────────────────────────────────────
  dbVersion: backupRepo.dbVersion,
  exportAllData: backupRepo.exportAllData,
  importBackup: backupRepo.importBackup,
  importAllData: backupRepo.importAllData,
}
