import { useSummary } from './hooks/useSummary'
import { useState } from 'react'
import { useSettings } from '../../context/settingsContext'
import type { Expense } from '../../types'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import FixedExpensesList from '../fixedExpenses/FixedExpensesList'
import BudgetFlow from './BudgetFlow'
import BudgetPaceSection from './BudgetPaceSection'
import IncomeForm from './IncomeForm'
import SavingsForm from './SavingsForm'
import SpendingBreakdown from './SpendingBreakdown'
import './summary.css'

interface SummaryPageProps {
  expenses: Expense[]
}

export default function SummaryPage({ expenses }: SummaryPageProps) {
  const { formatAmount } = useSettings()
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const {
    incomeRaw,
    incomeFreq,
    monthlyIncome,
    savingsRate,
    fixedExpenses,
    financialSummary,
    variableBreakdown,
    handleIncomeSave,
    handleSavingsRateSave,
    handleAddFixed,
    handleUpdateFixed,
    handleDeleteFixed,
  } = useSummary({ expenses })

  const incomeIsSet = parseFloat(String(incomeRaw || 0)) > 0
  const hasFixedExpenses = fixedExpenses.some((item) => !item.isArchived)
  const hasSavingsGoal = Number(savingsRate || 0) > 0
  const hasBudgetSetup = incomeIsSet || hasSavingsGoal || hasFixedExpenses
  const fixedExpenseTotal = fixedExpenses
    .filter((item) => !item.isArchived)
    .reduce((sum, item) => sum + item.amount, 0)
  const savingsAmount = (Number(savingsRate || 0) / 100) * monthlyIncome
  const allocatedTotal = fixedExpenseTotal + savingsAmount
  const formatSummaryAmount = (amount: number) => formatAmount(amount).replace(/\.00$/, '')
  const planSummaryParts = [
    incomeIsSet ? `Inc. ${formatSummaryAmount(monthlyIncome)}` : null,
    hasSavingsGoal ? `Sav. ${formatSummaryAmount(savingsAmount)}` : null,
    hasFixedExpenses ? `Fixed ${formatSummaryAmount(fixedExpenseTotal)}` : null,
  ].filter(Boolean)

  return (
    <main className="max-w-4xl w-full mx-auto px-4 py-6 space-y-6" data-testid="summary-page">
      <h1 className="text-2xl font-bold text-theme-text tracking-tight">Budget</h1>
      <div className="space-y-4 md:max-w-3xl mx-auto">
        {!incomeIsSet && (
          <div className="rounded-theme-large border border-dashed border-theme-border bg-theme-surface p-5 text-center space-y-1">
            <p className="text-sm font-medium text-theme-text">Set up your budget</p>
            <p className="text-xs text-theme-muted">
              Add your income below to see your budget breakdown.
            </p>
          </div>
        )}

        {hasBudgetSetup ? (
          <>
            <section className="md:hidden">
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(true)}
                className="flex w-full items-center justify-between gap-3 rounded-theme-large border border-theme-border bg-theme-surface px-4 py-3 text-left"
                aria-label="Edit monthly plan"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-semibold text-theme-text">Plan</p>
                  <p className="truncate text-xs text-theme-muted">
                    {planSummaryParts.length > 0
                      ? planSummaryParts.join(' · ')
                      : 'Tap to configure your monthly plan'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {allocatedTotal > 0 && (
                    <p className="text-xs font-medium text-theme-text">
                      {formatAmount(allocatedTotal)} allocated
                    </p>
                  )}
                  <span className="text-base text-theme-muted" aria-hidden="true">
                    ›
                  </span>
                </div>
              </button>
            </section>

            <Modal
              isOpen={isPlanModalOpen}
              onClose={() => setIsPlanModalOpen(false)}
              title="Monthly Plan"
              size="sm"
              footer={
                <ModalFooter>
                  <button
                    type="button"
                    onClick={() => setIsPlanModalOpen(false)}
                    className="btn-modal-primary flex-1"
                  >
                    Done
                  </button>
                </ModalFooter>
              }
            >
              <div className="divide-y divide-theme-border">
                <div className="py-2.5">
                  <IncomeForm
                    income={incomeRaw}
                    frequency={incomeFreq}
                    onSave={handleIncomeSave}
                    compact
                    mobileList
                  />
                </div>
                <div className="py-2.5">
                  <SavingsForm
                    savingsRate={savingsRate}
                    monthlyIncome={monthlyIncome}
                    onSave={handleSavingsRateSave}
                    compact
                    mobileList
                  />
                </div>
                <div className="py-2.5">
                  <FixedExpensesList
                    items={fixedExpenses}
                    onAdd={handleAddFixed}
                    onUpdate={handleUpdateFixed}
                    onDelete={handleDeleteFixed}
                    compact
                    mobileList
                  />
                </div>
              </div>
            </Modal>

            <section className="hidden md:block rounded-theme-large border border-theme-border bg-theme-surface p-3 md:p-4">
              <div className="grid gap-2.5 md:grid-cols-3">
                <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-3">
                  <IncomeForm
                    income={incomeRaw}
                    frequency={incomeFreq}
                    onSave={handleIncomeSave}
                    compact
                  />
                </div>
                <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-3">
                  <SavingsForm
                    savingsRate={savingsRate}
                    monthlyIncome={monthlyIncome}
                    onSave={handleSavingsRateSave}
                    compact
                  />
                </div>
                <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-3">
                  <FixedExpensesList
                    items={fixedExpenses}
                    onAdd={handleAddFixed}
                    onUpdate={handleUpdateFixed}
                    onDelete={handleDeleteFixed}
                    compact
                  />
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            <div className="rounded-theme-large border border-theme-border bg-theme-surface p-4 md:p-5">
              <IncomeForm income={incomeRaw} frequency={incomeFreq} onSave={handleIncomeSave} />
            </div>

            <div className="rounded-theme-large border border-theme-border bg-theme-surface p-4 md:p-5">
              <SavingsForm
                savingsRate={savingsRate}
                monthlyIncome={monthlyIncome}
                onSave={handleSavingsRateSave}
              />
            </div>

            <div className="rounded-theme-large border border-theme-border bg-theme-surface p-4 md:p-5">
              <FixedExpensesList
                items={fixedExpenses}
                onAdd={handleAddFixed}
                onUpdate={handleUpdateFixed}
                onDelete={handleDeleteFixed}
              />
            </div>
          </>
        )}

        {financialSummary && incomeIsSet && (
          <BudgetFlow summary={financialSummary} variableBreakdown={variableBreakdown} />
        )}

        {financialSummary && <BudgetPaceSection expenses={expenses} summary={financialSummary} />}

        {variableBreakdown.length > 0 && (
          <SpendingBreakdown
            items={variableBreakdown}
            total={financialSummary?.variableExpenses ?? 0}
          />
        )}
      </div>
    </main>
  )
}
