import React from 'react'

function Card({ label, value, color = 'text-gray-800' }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-4 py-3 flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-xl font-semibold ${color}`}>{value}</span>
    </div>
  )
}

const fmt = (n) => `$${n.toFixed(2)}`

export default function SummarySection({ monthlyIncome, totalFixed, variableExpenses, savingsRate }) {
  const available = monthlyIncome - totalFixed
  const savings = available * (savingsRate / 100)
  const remaining = available - savings - variableExpenses

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-700 dark:text-gray-200">Financial Summary</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card label="Monthly Income" value={fmt(monthlyIncome)} color="text-indigo-600" />
        <Card label="Fixed Expenses" value={fmt(totalFixed)} color="text-orange-500" />
        <Card label="Variable Expenses" value={fmt(variableExpenses)} color="text-yellow-600" />
        <Card label="Available Income" value={fmt(Math.max(0, available))} color="text-blue-600" />
        <Card label="Savings" value={fmt(Math.max(0, savings))} color="text-green-600" />
        <Card label="Remaining Budget" value={fmt(remaining)} color={remaining >= 0 ? 'text-emerald-600' : 'text-red-500'} />
      </div>
    </div>
  )
}
