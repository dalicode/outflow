import type {
  Category,
  CategoryMergeHistory,
  Expense,
  ExpenseSplit,
  FixedExpense,
  FixedExpenseSnapshot,
  IncomeSnapshot,
  Payee,
  PayeeMergeHistory,
  SavingsSnapshot,
  Schedule,
} from '../../types'
import { normalizeNameForSync } from '../../utils/syncMetadata'
import type { FromCloudMaps, ToCloudMaps } from './types'

type LocalCloudReference = {
  id?: number
  cloudId?: string | null
}

function hasLocalCloudReference<T extends LocalCloudReference>(
  item: T,
): item is T & { id: number; cloudId: string } {
  return item.id != null && Boolean(item.cloudId)
}

export function toLocalCloudMap<T extends LocalCloudReference>(items: T[]): Map<number, string> {
  return new Map(items.filter(hasLocalCloudReference).map((item) => [item.id, item.cloudId]))
}

export function fromCloudLocalMap<T extends LocalCloudReference>(items: T[]): Map<string, number> {
  return new Map(items.filter(hasLocalCloudReference).map((item) => [item.cloudId, item.id]))
}

export function toNumberOrUndefined(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
}

function hasValue(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function resolveMetadataTimestamp(
  value: unknown,
  fallback: string = new Date().toISOString(),
): string {
  return hasValue(value) ? value : fallback
}

function buildFallbackLocalId(payload: Record<string, unknown>): string {
  if (hasValue(payload.localId)) return payload.localId
  if (payload.id != null) return `legacy-${String(payload.id)}`
  return `legacy-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function resolveCloudIdForLocal(
  localId: number | undefined | null,
  map?: Map<number, string>,
): string | null {
  if (localId == null) return null
  return map?.get(localId) ?? String(localId)
}

export function resolveCloudRelationshipId(
  localId: number | undefined | null,
  map?: Map<number, string>,
): string | null {
  return resolveCloudIdForLocal(localId, map)
}

export function resolveLocalRelationshipId(
  cloudId: unknown,
  map?: Map<string, number>,
): number | undefined {
  if (cloudId == null) return undefined
  const str = String(cloudId)
  const byCloud = map?.get(str)
  if (byCloud !== undefined) return byCloud
  if (/^\d+$/.test(str) && Number(str) < 100000) {
    return toNumberOrUndefined(cloudId)
  }
  return undefined
}

function buildCloudBase(payload: Record<string, unknown>, userId: string): Record<string, unknown> {
  const now = new Date().toISOString()
  const row: Record<string, unknown> = {
    user_id: userId,
    local_id: buildFallbackLocalId(payload),
    created_at: resolveMetadataTimestamp(payload.createdAt, now),
    updated_at: resolveMetadataTimestamp(payload.updatedAt, now),
    deleted_at: hasValue(payload.deletedAt) ? payload.deletedAt : null,
    device_id: hasValue(payload.deviceId) ? payload.deviceId : null,
  }

  if (hasValue(payload.cloudId)) {
    row.id = payload.cloudId
  }

  return row
}

function buildCloudSettingsBase(
  payload: Record<string, unknown>,
  userId: string,
): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    user_id: userId,
    local_id: buildFallbackLocalId(payload),
    created_at: resolveMetadataTimestamp(payload.createdAt, now),
    updated_at: resolveMetadataTimestamp(payload.updatedAt, now),
    deleted_at: hasValue(payload.deletedAt) ? payload.deletedAt : null,
    device_id: hasValue(payload.deviceId) ? payload.deviceId : null,
  }
}

export function toCloud(
  table: string,
  payload: Record<string, unknown>,
  userId: string,
  maps?: ToCloudMaps,
): Record<string, unknown> {
  const base = buildCloudBase(payload, userId)

  if (table === 'expenses') {
    const p = payload as unknown as Expense
    return {
      ...base,
      date: p.date,
      category_id: resolveCloudRelationshipId(p.categoryId, maps?.categoryIdToCloudId),
      payee_id: resolveCloudRelationshipId(p.payeeId, maps?.payeeIdToCloudId),
      split_id: resolveCloudRelationshipId(p.splitId, maps?.expenseSplitIdToCloudId),
      category_name_snapshot: p.categoryNameSnapshot ?? null,
      payee_name_snapshot: p.payeeNameSnapshot ?? null,
      description: p.description ?? '',
      amount: p.amount,
    }
  }
  if (table === 'expenseSplits') {
    const p = payload as unknown as ExpenseSplit
    return {
      ...base,
      date: p.date,
      payee_id: resolveCloudRelationshipId(p.payeeId, maps?.payeeIdToCloudId),
      payee_name_snapshot: p.payeeNameSnapshot ?? null,
      description: p.description ?? '',
      amount: p.amount,
      note: p.note ?? null,
    }
  }
  if (table === 'categories') {
    const p = payload as unknown as Category
    return {
      ...base,
      name: p.name,
      normalized_name: p.normalizedName ?? null,
      is_archived: p.isArchived ?? false,
      merged_into_category_id: resolveCloudRelationshipId(
        p.mergedIntoCategoryId ?? null,
        maps?.categoryIdToCloudId,
      ),
    }
  }
  if (table === 'payees') {
    const p = payload as unknown as Payee
    return {
      ...base,
      name: p.name,
      normalized_name: p.normalizedName ?? null,
      is_archived: p.isArchived ?? false,
      merged_into_payee_id: resolveCloudRelationshipId(
        p.mergedIntoPayeeId ?? null,
        maps?.payeeIdToCloudId,
      ),
    }
  }
  if (table === 'fixedExpenses') {
    const p = payload as unknown as FixedExpense
    return {
      ...base,
      name: p.name,
      amount: p.amount,
      is_archived: p.isArchived ?? false,
    }
  }
  if (table === 'fixedExpenseSnapshots') {
    const p = payload as unknown as FixedExpenseSnapshot
    return {
      ...base,
      fixed_expense_id: resolveCloudRelationshipId(p.fixedExpenseId, maps?.fixedExpenseIdToCloudId),
      name_snapshot: p.nameSnapshot,
      amount_snapshot: p.amountSnapshot,
      month: p.month,
      year: p.year,
    }
  }
  if (table === 'incomeSnapshots') {
    const p = payload as unknown as IncomeSnapshot
    return {
      ...base,
      year: p.year,
      month: p.month,
      amount_snapshot: p.amountSnapshot,
    }
  }
  if (table === 'savingsSnapshots') {
    const p = payload as unknown as SavingsSnapshot
    return {
      ...base,
      year: p.year,
      month: p.month,
      rate_snapshot: p.rateSnapshot,
    }
  }
  if (table === 'schedules') {
    const p = payload as unknown as Schedule
    return {
      ...base,
      type: p.type,
      target_id: resolveCloudRelationshipId(p.targetId, maps?.fixedExpenseIdToCloudId),
      effective_year: p.effectiveYear,
      effective_month: p.effectiveMonth,
      new_value: p.newValue,
      previous_value: p.previousValue ?? null,
      materialized_at: p.materializedAt ?? null,
      is_active: p.isActive,
      note: p.note ?? null,
      day: p.day ?? null,
      category_id: resolveCloudRelationshipId(p.categoryId, maps?.categoryIdToCloudId),
      payee_id: resolveCloudRelationshipId(p.payeeId, maps?.payeeIdToCloudId),
    }
  }
  if (table === 'categoryMergeHistory') {
    const p = payload as unknown as CategoryMergeHistory
    return {
      ...base,
      source_category_id: resolveCloudRelationshipId(p.sourceCategoryId, maps?.categoryIdToCloudId),
      target_category_id: resolveCloudRelationshipId(p.targetCategoryId, maps?.categoryIdToCloudId),
      affected_expense_ids: p.affectedExpenseIds,
      reverted_at: p.revertedAt ?? null,
    }
  }
  if (table === 'payeeMergeHistory') {
    const p = payload as unknown as PayeeMergeHistory
    return {
      ...base,
      source_payee_id: resolveCloudRelationshipId(p.sourcePayeeId, maps?.payeeIdToCloudId),
      target_payee_id: resolveCloudRelationshipId(p.targetPayeeId, maps?.payeeIdToCloudId),
      affected_expense_ids: p.affectedExpenseIds,
      affected_split_ids: p.affectedSplitIds ?? [],
      reverted_at: p.revertedAt ?? null,
    }
  }
  if (table === 'settings') {
    const baseSettings = buildCloudSettingsBase(payload, userId)
    return {
      ...baseSettings,
      key: payload.key,
      value: JSON.stringify(payload.value),
    }
  }
  return { ...base, ...payload, local_id: base.local_id }
}

export function fromCloud(
  table: string,
  row: Record<string, unknown>,
  maps?: FromCloudMaps,
): Record<string, unknown> {
  const cid = row.id != null ? String(row.id) : ''
  const now = new Date().toISOString()
  const syncMetadata = {
    localId: hasValue(row.local_id) ? row.local_id : hasValue(row.key) ? row.key : cid,
    cloudId: cid.length > 0 ? cid : null,
    createdAt: resolveMetadataTimestamp(row.created_at, now),
    updatedAt: resolveMetadataTimestamp(row.updated_at, now),
    deletedAt: hasValue(row.deleted_at) ? row.deleted_at : null,
    deviceId: hasValue(row.device_id) ? row.device_id : null,
    syncStatus: 'synced' as const,
    lastSyncedAt: resolveMetadataTimestamp(row.updated_at, now),
    syncError: null,
  }

  function resolveCat(cloudId: unknown) {
    return resolveLocalRelationshipId(cloudId, maps?.cloudIdToCategoryId)
  }
  function resolvePay(cloudId: unknown) {
    return resolveLocalRelationshipId(cloudId, maps?.cloudIdToPayeeId)
  }
  function resolveFixed(cloudId: unknown) {
    return resolveLocalRelationshipId(cloudId, maps?.cloudIdToFixedExpenseId)
  }
  function resolveSplit(cloudId: unknown) {
    return resolveLocalRelationshipId(cloudId, maps?.cloudIdToExpenseSplitId)
  }

  if (table === 'expenses') {
    return {
      ...syncMetadata,
      date: row.date,
      cloudCategoryId: row.category_id != null ? String(row.category_id) : undefined,
      categoryId: resolveCat(row.category_id),
      cloudPayeeId: row.payee_id != null ? String(row.payee_id) : undefined,
      payeeId: resolvePay(row.payee_id),
      cloudSplitId: row.split_id != null ? String(row.split_id) : undefined,
      splitId: resolveSplit(row.split_id) ?? toNumberOrUndefined(row.split_id),
      categoryNameSnapshot: row.category_name_snapshot ?? null,
      payeeNameSnapshot: row.payee_name_snapshot ?? null,
      description: row.description ?? '',
      amount: row.amount,
    }
  }
  if (table === 'expense_splits') {
    return {
      ...syncMetadata,
      date: row.date,
      cloudPayeeId: row.payee_id != null ? String(row.payee_id) : undefined,
      payeeId: resolvePay(row.payee_id),
      payeeNameSnapshot: row.payee_name_snapshot ?? null,
      description: row.description ?? '',
      amount: row.amount,
      note: row.note ?? undefined,
    }
  }
  if (table === 'categories') {
    return {
      ...syncMetadata,
      name: row.name,
      normalizedName:
        (row.normalized_name as string | undefined) ??
        (typeof row.name === 'string' ? normalizeNameForSync(row.name) : undefined),
      isArchived: row.is_archived,
      mergedIntoCategoryId: resolveCat(row.merged_into_category_id),
    }
  }
  if (table === 'payees') {
    return {
      ...syncMetadata,
      name: row.name,
      normalizedName:
        (row.normalized_name as string | undefined) ??
        (typeof row.name === 'string' ? normalizeNameForSync(row.name) : undefined),
      isArchived: row.is_archived,
      mergedIntoPayeeId: resolvePay(row.merged_into_payee_id),
    }
  }
  if (table === 'fixed_expenses') {
    return {
      ...syncMetadata,
      name: row.name,
      amount: row.amount,
      isArchived: row.is_archived,
    }
  }
  if (table === 'fixed_expense_snapshots') {
    return {
      ...syncMetadata,
      fixedExpenseId:
        resolveFixed(row.fixed_expense_id) ?? toNumberOrUndefined(row.fixed_expense_id),
      nameSnapshot: row.name_snapshot,
      amountSnapshot: row.amount_snapshot,
      month: row.month,
      year: row.year,
    }
  }
  if (table === 'income_snapshots') {
    return {
      ...syncMetadata,
      year: row.year,
      month: row.month,
      amountSnapshot: row.amount_snapshot,
    }
  }
  if (table === 'savings_snapshots') {
    return {
      ...syncMetadata,
      year: row.year,
      month: row.month,
      rateSnapshot: row.rate_snapshot,
    }
  }
  if (table === 'schedules') {
    const isActiveValue = row.is_active
    return {
      ...syncMetadata,
      type: row.type,
      targetId: resolveFixed(row.target_id) ?? toNumberOrUndefined(row.target_id) ?? null,
      effectiveYear: row.effective_year,
      effectiveMonth: row.effective_month,
      newValue: row.new_value,
      previousValue: row.previous_value ?? null,
      materializedAt: row.materialized_at ?? undefined,
      isActive: isActiveValue === true || Number(isActiveValue) === 1 ? 1 : 0,
      note: row.note ?? undefined,
      day: row.day ?? undefined,
      categoryId: resolveCat(row.category_id),
      payeeId: resolvePay(row.payee_id),
    }
  }
  if (table === 'category_merge_history') {
    return {
      ...syncMetadata,
      sourceCategoryId: resolveCat(row.source_category_id) ?? 0,
      targetCategoryId: resolveCat(row.target_category_id) ?? 0,
      affectedExpenseIds: toNumberArray(row.affected_expense_ids),
      revertedAt: row.reverted_at ?? null,
    }
  }
  if (table === 'payee_merge_history') {
    return {
      ...syncMetadata,
      sourcePayeeId: resolvePay(row.source_payee_id) ?? 0,
      targetPayeeId: resolvePay(row.target_payee_id) ?? 0,
      affectedExpenseIds: toNumberArray(row.affected_expense_ids),
      affectedSplitIds: toNumberArray(row.affected_split_ids),
      revertedAt: row.reverted_at ?? null,
    }
  }
  if (table === 'settings') {
    return {
      ...syncMetadata,
      key: row.key,
      value: JSON.parse(String(row.value)),
      updatedAt: row.updated_at as string | undefined,
    }
  }
  return { ...row, ...syncMetadata }
}
