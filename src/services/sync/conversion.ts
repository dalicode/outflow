import type {
  Category,
  CategoryMergeHistory,
  Expense,
  FixedExpense,
  FixedExpenseSnapshot,
  IncomeSnapshot,
  Payee,
  PayeeMergeHistory,
  SavingsSnapshot,
  Schedule,
} from '../../types'
import type { FromCloudMaps, ToCloudMaps } from './types'

type LocalCloudReference = {
  id?: number
  cloudId?: string
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

export function toCloud(
  table: string,
  payload: Record<string, unknown>,
  userId: string,
  maps?: ToCloudMaps,
): Record<string, unknown> {
  const now = new Date().toISOString()
  const base = { user_id: userId, updated_at: now }

  function cat(id: number | undefined | null) {
    if (id == null) return null
    return maps?.categoryIdToCloudId?.get(id) ?? String(id)
  }
  function pay(id: number | undefined | null) {
    if (id == null) return null
    return maps?.payeeIdToCloudId?.get(id) ?? String(id)
  }
  function categoryCloudId(p: Category) {
    if (p.cloudId) return p.cloudId
    if (p.id != null) return maps?.categoryIdToCloudId?.get(p.id) ?? String(p.id)
    return crypto.randomUUID()
  }
  function payeeCloudId(p: Payee) {
    if (p.cloudId) return p.cloudId
    if (p.id != null) return maps?.payeeIdToCloudId?.get(p.id) ?? String(p.id)
    return crypto.randomUUID()
  }
  function fixedExpenseCloudId(p: FixedExpense) {
    if (p.cloudId) return p.cloudId
    if (p.id != null) return maps?.fixedExpenseIdToCloudId?.get(p.id) ?? String(p.id)
    return crypto.randomUUID()
  }

  if (table === 'expenses') {
    const p = payload as unknown as Expense
    return {
      ...base,
      id: p.cloudId ?? String(p.id),
      date: p.date,
      category_id: cat(p.categoryId),
      payee_id: pay(p.payeeId),
      description: p.description ?? '',
      amount: p.amount,
    }
  }
  if (table === 'categories') {
    const p = payload as unknown as Category
    return {
      ...base,
      id: categoryCloudId(p),
      name: p.name,
      is_archived: p.isArchived ?? false,
      archived_at: p.archivedAt ?? null,
      merged_into_category_id: cat(p.mergedIntoCategoryId),
    }
  }
  if (table === 'payees') {
    const p = payload as unknown as Payee
    return {
      ...base,
      id: payeeCloudId(p),
      name: p.name,
      is_archived: p.isArchived ?? false,
      archived_at: p.archivedAt ?? null,
      merged_into_payee_id: pay(p.mergedIntoPayeeId),
    }
  }
  if (table === 'fixedExpenses') {
    const p = payload as unknown as FixedExpense
    return {
      ...base,
      id: fixedExpenseCloudId(p),
      name: p.name,
      amount: p.amount,
      is_archived: p.isArchived ?? false,
      archived_at: p.archivedAt ?? null,
    }
  }
  if (table === 'fixedExpenseSnapshots') {
    const p = payload as unknown as FixedExpenseSnapshot
    return {
      ...base,
      id: p.cloudId ?? String(p.id),
      fixed_expense_id:
        maps?.fixedExpenseIdToCloudId?.get(p.fixedExpenseId) ?? String(p.fixedExpenseId),
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
      id: p.cloudId ?? String(p.id ?? `${p.year}-${p.month}`),
      year: p.year,
      month: p.month,
      amount_snapshot: p.amountSnapshot,
      created_at: p.createdAt ?? now,
    }
  }
  if (table === 'savingsSnapshots') {
    const p = payload as unknown as SavingsSnapshot
    return {
      ...base,
      id: p.cloudId ?? String(p.id ?? `${p.year}-${p.month}`),
      year: p.year,
      month: p.month,
      rate_snapshot: p.rateSnapshot,
      created_at: p.createdAt ?? now,
    }
  }
  if (table === 'schedules') {
    const p = payload as unknown as Schedule
    return {
      ...base,
      id: p.cloudId ?? String(p.id),
      type: p.type,
      target_id: maps?.fixedExpenseIdToCloudId?.get(p.targetId as number) ?? String(p.targetId),
      effective_year: p.effectiveYear,
      effective_month: p.effectiveMonth,
      new_value: p.newValue,
      previous_value: p.previousValue ?? null,
      materialized_at: p.materializedAt ?? null,
      is_active: p.isActive,
      note: p.note ?? null,
      day: p.day ?? null,
      category_id: cat(p.categoryId),
      payee_id: pay(p.payeeId),
    }
  }
  if (table === 'categoryMergeHistory') {
    const p = payload as unknown as CategoryMergeHistory
    return {
      ...base,
      id: p.cloudId ?? String(p.id ?? `${p.sourceCategoryId}-${p.targetCategoryId}-${p.createdAt}`),
      source_category_id: cat(p.sourceCategoryId),
      target_category_id: cat(p.targetCategoryId),
      affected_expense_ids: p.affectedExpenseIds,
      created_at: p.createdAt,
      reverted_at: p.revertedAt ?? null,
    }
  }
  if (table === 'payeeMergeHistory') {
    const p = payload as unknown as PayeeMergeHistory
    return {
      ...base,
      id: p.cloudId ?? String(p.id ?? `${p.sourcePayeeId}-${p.targetPayeeId}-${p.createdAt}`),
      source_payee_id: pay(p.sourcePayeeId),
      target_payee_id: pay(p.targetPayeeId),
      affected_expense_ids: p.affectedExpenseIds,
      created_at: p.createdAt,
      reverted_at: p.revertedAt ?? null,
    }
  }
  if (table === 'settings') {
    return {
      ...base,
      key: payload.key,
      value: JSON.stringify(payload.value),
    }
  }
  return { ...base, ...payload }
}

export function fromCloud(
  table: string,
  row: Record<string, unknown>,
  maps?: FromCloudMaps,
): Record<string, unknown> {
  const cid = String(row.id)

  function resolveCat(cloudId: unknown) {
    if (cloudId == null) return undefined
    const str = String(cloudId)
    const byCloud = maps?.cloudIdToCategoryId?.get(str)
    if (byCloud !== undefined) return byCloud
    if (/^\d+$/.test(str) && Number(str) < 100000) {
      const numId = toNumberOrUndefined(cloudId)
      if (numId !== undefined) return numId
    }
    return undefined
  }
  function resolvePay(cloudId: unknown) {
    if (cloudId == null) return undefined
    const str = String(cloudId)
    const byCloud = maps?.cloudIdToPayeeId?.get(str)
    if (byCloud !== undefined) return byCloud
    if (/^\d+$/.test(str) && Number(str) < 100000) {
      const numId = toNumberOrUndefined(cloudId)
      if (numId !== undefined) return numId
    }
    return undefined
  }
  function resolveFixed(cloudId: unknown) {
    if (cloudId == null) return undefined
    const str = String(cloudId)
    const byCloud = maps?.cloudIdToFixedExpenseId?.get(str)
    if (byCloud !== undefined) return byCloud
    if (/^\d+$/.test(str) && Number(str) < 100000) {
      const numId = toNumberOrUndefined(cloudId)
      if (numId !== undefined) return numId
    }
    return undefined
  }

  if (table === 'expenses') {
    return {
      cloudId: cid,
      date: row.date,
      cloudCategoryId: row.category_id != null ? String(row.category_id) : undefined,
      categoryId: resolveCat(row.category_id),
      cloudPayeeId: row.payee_id != null ? String(row.payee_id) : undefined,
      payeeId: resolvePay(row.payee_id),
      description: row.description ?? '',
      amount: row.amount,
      updatedAt: row.updated_at as string | undefined,
    }
  }
  if (table === 'categories') {
    return {
      cloudId: cid,
      name: row.name,
      isArchived: row.is_archived,
      createdAt: row.created_at ?? new Date().toISOString(),
      updatedAt: row.updated_at as string | undefined,
      archivedAt: row.archived_at ?? undefined,
      mergedIntoCategoryId: resolveCat(row.merged_into_category_id),
    }
  }
  if (table === 'payees') {
    return {
      cloudId: cid,
      name: row.name,
      isArchived: row.is_archived,
      createdAt: row.created_at ?? new Date().toISOString(),
      updatedAt: row.updated_at as string | undefined,
      archivedAt: row.archived_at ?? undefined,
      mergedIntoPayeeId: resolvePay(row.merged_into_payee_id),
    }
  }
  if (table === 'fixed_expenses') {
    return {
      cloudId: cid,
      name: row.name,
      amount: row.amount,
      isArchived: row.is_archived,
      updatedAt: row.updated_at as string | undefined,
      archivedAt: row.archived_at ?? undefined,
    }
  }
  if (table === 'fixed_expense_snapshots') {
    return {
      cloudId: cid,
      fixedExpenseId:
        resolveFixed(row.fixed_expense_id) ?? toNumberOrUndefined(row.fixed_expense_id),
      nameSnapshot: row.name_snapshot,
      amountSnapshot: row.amount_snapshot,
      month: row.month,
      year: row.year,
      updatedAt: row.updated_at as string | undefined,
      createdAt: row.created_at as string | undefined,
    }
  }
  if (table === 'income_snapshots') {
    return {
      cloudId: cid,
      year: row.year,
      month: row.month,
      amountSnapshot: row.amount_snapshot,
      updatedAt: row.updated_at as string | undefined,
      createdAt: row.created_at as string | undefined,
    }
  }
  if (table === 'savings_snapshots') {
    return {
      cloudId: cid,
      year: row.year,
      month: row.month,
      rateSnapshot: row.rate_snapshot,
      updatedAt: row.updated_at as string | undefined,
      createdAt: row.created_at as string | undefined,
    }
  }
  if (table === 'schedules') {
    const isActiveValue = row.is_active
    return {
      cloudId: cid,
      type: row.type,
      targetId: resolveFixed(row.target_id) ?? toNumberOrUndefined(row.target_id) ?? null,
      effectiveYear: row.effective_year,
      effectiveMonth: row.effective_month,
      newValue: row.new_value,
      previousValue: row.previous_value ?? null,
      materializedAt: row.materialized_at ?? undefined,
      isActive: isActiveValue === true || Number(isActiveValue) === 1 ? 1 : 0,
      note: row.note ?? undefined,
      updatedAt: row.updated_at as string | undefined,
      createdAt: row.created_at as string | undefined,
      day: row.day ?? undefined,
      categoryId: resolveCat(row.category_id),
      payeeId: resolvePay(row.payee_id),
    }
  }
  if (table === 'category_merge_history') {
    return {
      cloudId: cid,
      sourceCategoryId: resolveCat(row.source_category_id) ?? 0,
      targetCategoryId: resolveCat(row.target_category_id) ?? 0,
      affectedExpenseIds: toNumberArray(row.affected_expense_ids),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string | undefined,
      revertedAt: row.reverted_at ?? null,
    }
  }
  if (table === 'payee_merge_history') {
    return {
      cloudId: cid,
      sourcePayeeId: resolvePay(row.source_payee_id) ?? 0,
      targetPayeeId: resolvePay(row.target_payee_id) ?? 0,
      affectedExpenseIds: toNumberArray(row.affected_expense_ids),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string | undefined,
      revertedAt: row.reverted_at ?? null,
    }
  }
  if (table === 'settings') {
    return {
      key: row.key,
      value: JSON.parse(String(row.value)),
      updatedAt: row.updated_at as string | undefined,
    }
  }
  return row
}
