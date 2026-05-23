import { Suspense, lazy, useState } from 'react'
import BudgetFlowBar, { AllocationRow, barPct } from '../../components/ui/BudgetFlowBar'
import LazyModalFallback from '../../components/ui/LazyModalFallback'
import PrivateValue from '../../components/privacy/PrivateValue'
import { useSettings } from '../../context/settingsContext'
import type { FixedExpense, MonthlySummary } from '../../types'
import { getRemainingDisplayState } from '../../utils/remainingDisplayState'
import { getCategoryColor } from '../../utils/summaryColorUtils'
import { PencilIcon } from '../../components/ui/IconButton'
import IncomeModalForm from '../dashboard/components/IncomeModalForm'
import SavingsModalForm from '../dashboard/components/SavingsModalForm'

const FixedExpenseManagerModal = lazy(() => import('../fixedExpenses/FixedExpenseManagerModal'))

interface BudgetFlowProps {
  summary: MonthlySummary
  variableBreakdown: VariableBreakdownItem[]
  savingsRate: number
  fixedExpenses: FixedExpense[]
  onSaveIncome: (data: { income: number; frequency: string; monthlyIncome: number }) => void
  onSaveSavingsRate: (rate: number) => void
  onAddFixed: (item: Omit<FixedExpense, 'id'>) => void
  onUpdateFixed: (id: number, changes: Partial<FixedExpense>) => void
  onDeleteFixed: (id: number) => void
}

interface VariableBreakdownItem {
  name: string
  amount: number
  pct: number
}

export default function BudgetFlow({
  summary,
  variableBreakdown,
  savingsRate,
  fixedExpenses,
  onSaveIncome,
  onSaveSavingsRate,
  onAddFixed,
  onUpdateFixed,
  onDeleteFixed,
}: BudgetFlowProps) {
  const { formatAmount, currentTheme } = useSettings()
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [showSavingsModal, setShowSavingsModal] = useState(false)
  const [showFixedExpensesModal, setShowFixedExpensesModal] = useState(false)

  const { income, fixedExpensesTotal, variableExpenses, autoSavings, remaining } = summary

  const { remainingBarColor, remainingDisplayColor, isOverBudget } = getRemainingDisplayState(
    summary,
    currentTheme.colors,
  )
  const totalAllocated = fixedExpensesTotal + variableExpenses + Math.max(0, autoSavings)
  const spentPct = barPct(totalAllocated, income)
  const reservedSavingsColor = currentTheme.colors.text

  const segments = [
    {
      key: 'savings',
      label: 'Auto Savings',
      value: Math.max(0, autoSavings),
      widthPct: barPct(Math.max(0, autoSavings), income),
      color: reservedSavingsColor,
    },
    {
      key: 'fixed',
      label: 'Fixed',
      value: fixedExpensesTotal,
      widthPct: barPct(fixedExpensesTotal, income),
      bgClass: 'bg-theme-primary',
    },
    ...variableBreakdown.map((item) => ({
      key: item.name,
      label: item.name,
      value: item.amount,
      widthPct: barPct(item.amount, income),
      color: getCategoryColor(item.name),
    })),
  ].filter((s) => s.value > 0)

  return (
    <div className="rounded-theme-large border border-theme-border bg-theme-surface p-5 space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => setShowIncomeModal(true)}
          aria-label="Edit income"
          className="group min-w-0 flex-1 text-left rounded-theme-medium px-1.5 py-1.5 -mx-1.5 -my-1.5 transition-colors hover:bg-theme-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/30"
        >
          <div className="mb-0.5 inline-flex items-center gap-1.5">
            <p className="text-xs text-theme-muted uppercase tracking-wider">Monthly Budget</p>
            <span className="shrink-0 inline-flex items-center text-theme-primary group-hover:text-theme-text transition-colors">
              <PencilIcon className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="text-2xl font-bold text-theme-text tabular-nums">
            <PrivateValue>{formatAmount(income)}</PrivateValue>
          </p>
        </button>
        <div className="text-right text-theme-text">
          <p className="text-xs uppercase tracking-wider mb-0.5 text-theme-muted">
            {isOverBudget ? 'Over budget' : 'Remaining'}
          </p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: remainingDisplayColor }}>
            <PrivateValue>{formatAmount(remaining)}</PrivateValue>
          </p>
        </div>
      </div>

      {/* Bar + allocation rows */}
      {income > 0 && (
        <BudgetFlowBar
          income={income}
          segments={segments}
          remaining={remaining}
          remainingColor={remainingBarColor}
          isOverBudget={isOverBudget}
          overflowAmt={isOverBudget ? Math.abs(remaining) : 0}
          spentPct={spentPct}
          showOverflowLine={false}
          allowPinTooltip={false}
          formatAmount={formatAmount}
        >
          <div className="space-y-1 mt-3">
            <div>
              <AllocationRow
                label="Auto Savings"
                value={Math.max(0, autoSavings)}
                rowPct={barPct(Math.max(0, autoSavings), income)}
                dotColor={reservedSavingsColor}
                textClass="text-theme-success"
                formatAmount={(amount) => formatAmount(amount)}
                privateValue
                privatePercentage={false}
                onClick={() => setShowSavingsModal(true)}
                ariaLabel="Edit savings goal"
                density="compact"
              />
            </div>
            <div className="space-y-1">
              <AllocationRow
                label="Fixed Expenses"
                value={fixedExpensesTotal}
                rowPct={barPct(fixedExpensesTotal, income)}
                dotClass="bg-theme-primary"
                textClass="text-theme-danger"
                formatAmount={formatAmount}
                privateValue
                privatePercentage={false}
                onClick={() => setShowFixedExpensesModal(true)}
                ariaLabel="Edit fixed expenses"
                density="compact"
              />
              <AllocationRow
                label="Variable Expenses"
                value={variableExpenses}
                rowPct={barPct(variableExpenses, income)}
                dotClass="bg-theme-danger"
                textClass="text-theme-danger"
                formatAmount={formatAmount}
                privateValue
                privatePercentage={false}
                density="compact"
              />
            </div>

            <div className="border-t border-theme-border my-2" />

            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: remainingDisplayColor }}
                />
                <span className="text-sm font-medium text-theme-text truncate">
                  {isOverBudget ? 'Over Budget' : 'Remaining'}
                </span>
              </div>
              <div className="flex items-center justify-end gap-3 col-start-3">
                <span className="text-xs text-theme-muted tabular-nums w-10 text-right">
                  {income > 0 ? `${((remaining / income) * 100).toFixed(0)}%` : '—'}
                </span>
                <span
                  className="text-sm font-semibold tabular-nums w-24 text-right"
                  style={{ color: remainingDisplayColor }}
                >
                  <PrivateValue>
                    {isOverBudget ? '−' : '+'}
                    {formatAmount(Math.abs(remaining))}
                  </PrivateValue>
                </span>
              </div>
              <span className="flex w-5 justify-end text-theme-muted invisible" aria-hidden="true">
                <PencilIcon className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </BudgetFlowBar>
      )}

      <IncomeModalForm
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
        title="Edit Income"
        size="md"
        initialAmount={String(income || '')}
        initialFrequency="monthly"
        onSave={(data) => {
          onSaveIncome(data)
          setShowIncomeModal(false)
        }}
        description="Sets your monthly income. This affects budget calculations, savings targets, and remaining balance."
      />

      <SavingsModalForm
        isOpen={showSavingsModal}
        onClose={() => setShowSavingsModal(false)}
        title="Edit Auto Savings"
        size="md"
        initialRate={String(savingsRate || 0)}
        monthlyIncome={income}
        onSave={(rate) => {
          onSaveSavingsRate(rate)
          setShowSavingsModal(false)
        }}
        description="Percentage of income automatically set aside. Remaining budget = income − fixed expenses − auto savings."
      />

      {showFixedExpensesModal && (
        <Suspense
          fallback={
            <LazyModalFallback
              title="Manage Fixed Expenses"
              message="Loading fixed expense manager…"
              onClose={() => setShowFixedExpensesModal(false)}
            />
          }
        >
          <FixedExpenseManagerModal
            isOpen={showFixedExpensesModal}
            onClose={() => setShowFixedExpensesModal(false)}
            items={fixedExpenses}
            onAdd={onAddFixed}
            onUpdate={onUpdateFixed}
            onDelete={onDeleteFixed}
          />
        </Suspense>
      )}
    </div>
  )
}
