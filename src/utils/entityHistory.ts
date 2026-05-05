import type { Expense } from "../types";

type EntityField = "categoryId" | "payeeId";

type HistoryExpense = Pick<Expense, "date" | "categoryId" | "payeeId">;

function sortByMostRecent(a: HistoryExpense, b: HistoryExpense): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

function isAllowedId(
  id: number | null | undefined,
  allowedIds?: Set<number>,
): boolean {
  if (id == null) return false;
  if (!allowedIds) return true;
  return allowedIds.has(id);
}

export function getRecentEntityIds(
  expenses: HistoryExpense[],
  field: EntityField,
  limit = 5,
  allowedIds?: Set<number>,
): number[] {
  const seen = new Set<number>();
  const ids: number[] = [];

  for (const expense of [...expenses].sort(sortByMostRecent)) {
    const rawId = expense[field];
    const id = rawId == null ? null : Number(rawId);
    if (!isAllowedId(id, allowedIds) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
  }

  return ids;
}

export function getMostLikelyRelatedEntityId(
  expenses: HistoryExpense[],
  sourceField: EntityField,
  sourceId: number,
  targetField: EntityField,
  allowedIds?: Set<number>,
): number | null {
  const ranked = new Map<number, { count: number; newestIndex: number }>();
  const sorted = [...expenses].sort(sortByMostRecent);

  sorted.forEach((expense, index) => {
    const sourceValue = expense[sourceField];
    const targetValue = expense[targetField];
    const targetId = targetValue == null ? null : Number(targetValue);

    if (sourceValue == null || Number(sourceValue) !== sourceId) return;
    if (!isAllowedId(targetId, allowedIds)) return;
    if (targetId == null) return;

    const current = ranked.get(targetId) ?? {
      count: 0,
      newestIndex: index,
    };
    current.count += 1;
    current.newestIndex = Math.min(current.newestIndex, index);
    ranked.set(targetId, current);
  });

  let bestId: number | null = null;
  let bestCount = 0;
  let bestIndex = Number.POSITIVE_INFINITY;

  for (const [id, meta] of ranked.entries()) {
    if (
      meta.count > bestCount ||
      (meta.count === bestCount && meta.newestIndex < bestIndex)
    ) {
      bestId = id;
      bestCount = meta.count;
      bestIndex = meta.newestIndex;
    }
  }

  return bestId;
}
