import * as expenseRepo from './repositories/expenseRepository'
import * as settingsRepo from './repositories/settingsRepository'
import * as fixedExpenseRepo from './repositories/fixedExpenseRepository'
import * as snapshotRepo from './repositories/snapshotRepository'
import * as scheduleRepo from './repositories/scheduleRepository'
import * as categoryRepo from './repositories/categoryRepository'
import * as payeeRepo from './repositories/payeeRepository'
import * as syncRepo from './repositories/syncRepository'
import * as backupRepo from './repositories/backupRepository'
import * as historicalSnapshotRepo from './repositories/historicalSnapshotRepository'
import db from './db/schema'

export const StorageService = {
  db,
  // ── Expenses ──────────────────────────────────────────────
  getExpenses: expenseRepo.getAll,
  getAllExpenses: expenseRepo.getAllExpenses,
  getAll: expenseRepo.getAll, // legacy alias: active-only expense rows
  add: expenseRepo.add,
  update: expenseRepo.update,
  remove: expenseRepo.remove,
  removeMany: expenseRepo.removeMany,
  restoreExpense: expenseRepo.restore,
  restoreManyExpenses: expenseRepo.restoreMany,
  bulkAddExpensesForImport: expenseRepo.bulkAddForImport,
  replaceAllExpenses: expenseRepo.replaceAll,
  getExpenseCountForCategory: expenseRepo.getExpenseCountForCategory,
  getExpenseCountForPayee: expenseRepo.getExpenseCountForPayee,

  // ── Settings ──────────────────────────────────────────────
  getSettingsRows: settingsRepo.getSettingsRows,
  getAllSettingsRows: settingsRepo.getAllSettingsRows,
  getSetting: settingsRepo.getSetting,
  setSetting: settingsRepo.setSetting,
  setLocalSetting: settingsRepo.setLocalSetting,

  // ── Fixed Expenses ────────────────────────────────────────
  getFixedExpenses: fixedExpenseRepo.getFixedExpenses,
  getAllFixedExpenses: fixedExpenseRepo.getAllFixedExpenses,
  getActiveFixedExpenses: fixedExpenseRepo.getActiveFixedExpenses,
  addFixedExpense: fixedExpenseRepo.addFixedExpense,
  addArchivedFixedExpense: fixedExpenseRepo.addArchivedFixedExpense,
  updateFixedExpense: fixedExpenseRepo.updateFixedExpense,
  removeFixedExpense: fixedExpenseRepo.removeFixedExpense,

  // ── Fixed Expense Snapshots ───────────────────────────────
  getSnapshotsForYear: fixedExpenseRepo.getSnapshotsForYear,
  getAllSnapshotsForYear: fixedExpenseRepo.getAllSnapshotsForYear,
  getFixedExpenseSnapshots: fixedExpenseRepo.getFixedExpenseSnapshots,
  getAllFixedExpenseSnapshots: fixedExpenseRepo.getAllFixedExpenseSnapshots,
  bulkUpsertSnapshots: fixedExpenseRepo.bulkUpsertSnapshots,
  deleteSnapshotsForYear: fixedExpenseRepo.deleteSnapshotsForYear,
  deleteSnapshotsByNaturalKeys: fixedExpenseRepo.deleteSnapshotsByNaturalKeys,

  // ── Income Snapshots ──────────────────────────────────────
  getIncomeSnapshot: snapshotRepo.getIncomeSnapshot,
  setIncomeSnapshot: snapshotRepo.setIncomeSnapshot,
  getIncomeSnapshots: snapshotRepo.getIncomeSnapshots,
  getIncomeSnapshotsForYear: snapshotRepo.getIncomeSnapshotsForYear,
  getAllIncomeSnapshotsForYear: snapshotRepo.getAllIncomeSnapshotsForYear,
  getAllIncomeSnapshots: snapshotRepo.getAllIncomeSnapshots,
  bulkUpsertIncomeSnapshots: snapshotRepo.bulkUpsertIncomeSnapshots,
  deleteIncomeSnapshotsForYear: snapshotRepo.deleteIncomeSnapshotsForYear,
  deleteIncomeSnapshotsByNaturalKeys: snapshotRepo.deleteIncomeSnapshotsByNaturalKeys,

  // ── Savings Snapshots ─────────────────────────────────────
  getSavingsSnapshot: snapshotRepo.getSavingsSnapshot,
  setSavingsSnapshot: snapshotRepo.setSavingsSnapshot,
  getSavingsSnapshots: snapshotRepo.getSavingsSnapshots,
  getSavingsSnapshotsForYear: snapshotRepo.getSavingsSnapshotsForYear,
  getAllSavingsSnapshotsForYear: snapshotRepo.getAllSavingsSnapshotsForYear,
  getAllSavingsSnapshots: snapshotRepo.getAllSavingsSnapshots,
  bulkUpsertSavingsSnapshots: snapshotRepo.bulkUpsertSavingsSnapshots,
  deleteSavingsSnapshotsForYear: snapshotRepo.deleteSavingsSnapshotsForYear,
  deleteSavingsSnapshotsByNaturalKeys: snapshotRepo.deleteSavingsSnapshotsByNaturalKeys,
  saveHistoricalSnapshotConfigs: historicalSnapshotRepo.saveHistoricalSnapshotConfigs,

  // ── Schedule Materialization ──────────────────────────────
  materializePendingSnapshots: scheduleRepo.materializePendingSnapshots,
  rolloverSnapshots: scheduleRepo.rolloverSnapshots,

  // ── Scheduled Changes ─────────────────────────────────────
  getSchedules: scheduleRepo.getSchedules,
  getAllSchedules: scheduleRepo.getAllSchedules,
  getActiveSchedules: scheduleRepo.getActiveSchedules,
  addSchedule: scheduleRepo.addSchedule,
  updateSchedule: scheduleRepo.updateSchedule,
  deleteSchedule: scheduleRepo.deleteSchedule,

  // ── Categories ────────────────────────────────────────────
  getCategories: categoryRepo.getCategories,
  getAllCategories: categoryRepo.getAllCategories,
  addCategory: categoryRepo.addCategory,
  ensureCategoriesForImport: categoryRepo.ensureForImport,
  updateCategory: categoryRepo.updateCategory,
  deleteCategory: categoryRepo.deleteCategory,
  mergeCategory: categoryRepo.mergeCategory,
  revertCategoryMerge: categoryRepo.revertCategoryMerge,

  // ── Payees ────────────────────────────────────────────────
  getPayees: payeeRepo.getPayees,
  getAllPayees: payeeRepo.getAllPayees,
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
  hasPendingSyncMetadata: syncRepo.hasPendingSyncMetadata,
  getSyncMetadataCounts: syncRepo.getSyncMetadataCounts,
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
