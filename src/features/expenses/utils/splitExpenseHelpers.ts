import type { Expense, Payee } from '../../../types'

export interface SplitReconciliationResult {
  childTotal: number
  difference: number
  isBalanced: boolean
}

export function reconcileSplitAmounts(
  containerAmount: number,
  childAmounts: number[],
  decimalPlaces = 2,
): SplitReconciliationResult {
  const factor = 10 ** Math.max(0, decimalPlaces)
  const roundedContainer = Math.round((containerAmount || 0) * factor)
  const roundedChildTotal = Math.round(
    childAmounts.reduce((sum, amount) => sum + (amount || 0), 0) * factor,
  )
  const diffCents = roundedContainer - roundedChildTotal

  return {
    childTotal: roundedChildTotal / factor,
    difference: diffCents / factor,
    isBalanced: diffCents === 0,
  }
}

export function distributeSplitAmountEvenly(
  containerAmount: number,
  childCount: number,
  decimalPlaces = 2,
): number[] {
  if (childCount <= 0) return []

  const factor = 10 ** Math.max(0, decimalPlaces)
  const totalUnits = Math.round((containerAmount || 0) * factor)
  const baseUnits = Math.trunc(totalUnits / childCount)
  const distributed = Array(childCount).fill(baseUnits)
  const usedUnits = baseUnits * childCount
  distributed[childCount - 1] += totalUnits - usedUnits

  return distributed.map((units) => units / factor)
}

interface PayeeAggregateInput {
  childExpenses: Expense[]
  payees: Payee[]
}

function resolveChildPayeeName(expense: Expense, payeeById: Map<number, string>): string {
  if (expense.payeeId != null) {
    return payeeById.get(expense.payeeId) ?? expense.payeeNameSnapshot?.trim() ?? 'No payee'
  }

  const snap = expense.payeeNameSnapshot?.trim()
  if (snap) return snap
  return 'No payee'
}

export function getSplitContainerPayeeDisplay({
  childExpenses,
  payees,
}: PayeeAggregateInput): string {
  if (childExpenses.length === 0) return 'No payee'

  const payeeById = new Map(payees.map((payee) => [payee.id as number, payee.name]))
  const grouped = new Map<string, { count: number; totalAmount: number }>()

  for (const child of childExpenses) {
    const name = resolveChildPayeeName(child, payeeById)
    const current = grouped.get(name) ?? { count: 0, totalAmount: 0 }
    grouped.set(name, {
      count: current.count + 1,
      totalAmount: current.totalAmount + (child.amount || 0),
    })
  }

  const ranked = Array.from(grouped.entries()).sort((a, b) => {
    if (a[1].count !== b[1].count) return b[1].count - a[1].count
    if (a[1].totalAmount !== b[1].totalAmount) return b[1].totalAmount - a[1].totalAmount
    return a[0].localeCompare(b[0])
  })

  const label = ranked[0]?.[0] ?? 'No payee'
  const extraCount = ranked.length - 1
  return extraCount > 0 ? `${label} (+${extraCount} more)` : label
}
