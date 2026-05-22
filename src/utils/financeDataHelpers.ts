import type { FinanceEngineData } from '../types'

export function getMonthEngineData(
  engineData: FinanceEngineData,
  year: number,
  month: number,
  now: Date,
): FinanceEngineData {
  const isCurrentOrFuture =
    year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())

  if (!isCurrentOrFuture) {
    return {
      ...engineData,
      snapshots: engineData.snapshots.filter(
        (snapshot) => snapshot.year === year && snapshot.month === month + 1,
      ),
      incomeSnapshots: (engineData.incomeSnapshots ?? []).filter(
        (snapshot) => snapshot.year === year,
      ),
      savingsSnapshots: (engineData.savingsSnapshots ?? []).filter(
        (snapshot) => snapshot.year === year,
      ),
    }
  }

  const currentSnapshots = engineData.fixedExpenses
    .filter((fixed) => fixed.isArchived !== true)
    .map((fixed) => ({
      fixedExpenseId: fixed.id as number,
      year,
      month: month + 1,
      amountSnapshot: fixed.amount,
      nameSnapshot: fixed.name,
    }))

  return {
    ...engineData,
    snapshots: currentSnapshots,
    incomeSnapshots: (engineData.incomeSnapshots ?? []).filter(
      (snapshot) => snapshot.year === year,
    ),
    savingsSnapshots: (engineData.savingsSnapshots ?? []).filter(
      (snapshot) => snapshot.year === year,
    ),
  }
}
