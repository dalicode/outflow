import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { StorageService } from './StorageService'
import { useSettings } from './SettingsContext'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const pct = (n) => n != null ? `${n.toFixed(1)}%` : '—'

export default function AnalyticsPage({ expenses, categories }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [fixedExpenses, setFixedExpenses] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const { formatAmount } = useSettings()
  const fmt = (n) => (n != null && n !== 0) ? formatAmount(n) : '—'

  useEffect(() => {
    Promise.all([
      StorageService.getSetting('monthlyIncome', 0),
      StorageService.getFixedExpenses(),
    ]).then(([income, fixed]) => {
      setMonthlyIncome(income)
      setFixedExpenses(fixed)
    })
  }, [])

  useEffect(() => {
    StorageService.getSnapshotsForYear(year).then(setSnapshots)
  }, [year])

  const activeCategories = useMemo(() => categories.filter((c) => !c.isDeleted), [categories])
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const yearExpenses = useMemo(() =>
    expenses.filter((e) => e.date.startsWith(`${year}-`)), [expenses, year])

  // ── Variable expense grid ─────────────────────────────────
  const grid = useMemo(() => {
    const g = {}
    yearExpenses.forEach((e) => {
      const key = e.categoryId != null ? String(e.categoryId) : (e.category || 'Uncategorized')
      const m = parseInt(e.date.slice(5, 7), 10) - 1
      if (!g[key]) g[key] = Array(12).fill(0)
      g[key][m] += e.amount
    })
    return g
  }, [yearExpenses])

  const variableRows = useMemo(() => {
    const result = []; const covered = new Set()
    activeCategories.forEach((cat) => {
      const key = String(cat.id)
      if (grid[key]) { result.push({ key, name: cat.name }); covered.add(key) }
    })
    Object.keys(grid).forEach((key) => { if (!covered.has(key)) result.push({ key, name: key }) })
    return result
  }, [activeCategories, grid])

  const monthlyVariableTotals = useMemo(() =>
    MONTHS.map((_, m) => variableRows.reduce((s, r) => s + (grid[r.key]?.[m] ?? 0), 0)),
    [variableRows, grid])

  // ── Fixed expense snapshot grid ───────────────────────────
  // Group snapshots by fixedExpenseId, collect unique items
  const fixedSnapshotGrid = useMemo(() => {
    // map: fixedExpenseId → { name, amounts[12] }
    const map = {}
    snapshots.forEach((s) => {
      const m = s.month - 1 // 0-indexed
      if (!map[s.fixedExpenseId]) {
        map[s.fixedExpenseId] = { name: s.nameSnapshot, amounts: Array(12).fill(0) }
      }
      map[s.fixedExpenseId].amounts[m] = s.amountSnapshot
      // Use the most recent name snapshot for display
      map[s.fixedExpenseId].name = s.nameSnapshot
    })
    return map
  }, [snapshots])

  // For the current year, fill in months with no snapshot using current active fixed expenses
  const fixedRows = useMemo(() => {
    const isCurrentYear = year === now.getFullYear()
    const currentMonth = now.getMonth() // 0-indexed

    // Start from snapshot data
    const rows = { ...fixedSnapshotGrid }

    if (isCurrentYear) {
      fixedExpenses.forEach((f) => {
        const key = f.id
        if (!rows[key]) rows[key] = { name: f.name, amounts: Array(12).fill(0) }
        // Fill current and future months with current amount (not yet snapshotted)
        for (let m = 0; m <= currentMonth; m++) {
          if (rows[key].amounts[m] === 0) rows[key].amounts[m] = f.amount
        }
      })
    }

    return Object.entries(rows).map(([id, { name, amounts }]) => ({ id, name, amounts }))
  }, [fixedSnapshotGrid, fixedExpenses, year])

  const monthlyFixedTotals = useMemo(() =>
    MONTHS.map((_, m) => fixedRows.reduce((s, r) => s + (r.amounts[m] ?? 0), 0)),
    [fixedRows])

  // ── Combined monthly totals ───────────────────────────────
  const monthlyTotals = useMemo(() =>
    MONTHS.map((_, m) => monthlyVariableTotals[m] + monthlyFixedTotals[m]),
    [monthlyVariableTotals, monthlyFixedTotals])

  // ── Savings ───────────────────────────────────────────────
  const currentMonth = now.getMonth()
  const isCurrentYear = year === now.getFullYear()
  const isFutureMonth = (m) => year > now.getFullYear() || (isCurrentYear && m > currentMonth)

  const monthlySavings = useMemo(() =>
    monthlyTotals.map((spent, m) => isFutureMonth(m) ? null : monthlyIncome - spent),
    [monthlyTotals, monthlyIncome, isCurrentYear, currentMonth])

  const monthlySavingsPct = useMemo(() =>
    monthlySavings.map((s) => s == null ? null : (monthlyIncome > 0 ? (s / monthlyIncome) * 100 : 0)),
    [monthlySavings, monthlyIncome])

  const yearVariableTotal = monthlyVariableTotals.reduce((s, v) => s + v, 0)
  const yearFixedTotal = monthlyFixedTotals.reduce((s, v) => s + v, 0)
  const yearTotal = monthlyTotals.reduce((s, v) => s + v, 0)
  const validSavings = monthlySavings.filter((v) => v != null)
  const yearSavings = validSavings.reduce((s, v) => s + v, 0)
  const avgSavingsPct = monthlyIncome > 0 && validSavings.length > 0
    ? (yearSavings / (monthlyIncome * validSavings.length)) * 100 : 0

  const maxPerMonth = useMemo(() =>
    MONTHS.map((_, m) => Math.max(0, ...variableRows.map((r) => grid[r.key]?.[m] ?? 0))),
    [variableRows, grid])

  const navigate = useNavigate()
  const goToMonth = (m) => navigate(`/?month=${m}&year=${year}`)

  const th = 'px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap'
  const td = 'px-3 py-2 text-sm text-right whitespace-nowrap'
  const stickyLabel = (bg = 'bg-white dark:bg-gray-800') => `sticky left-0 ${bg} px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap`

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-4">
        <button onClick={() => setYear((y) => y - 1)} className="p-2 rounded-theme-small hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">&#8592;</button>
        <span className="text-xl font-bold text-gray-800 dark:text-gray-100">{year}</span>
        <button onClick={() => setYear((y) => y + 1)} className="p-2 rounded-theme-small hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">&#8594;</button>
      </div>

      <div className="overflow-x-auto rounded-theme-large shadow-sm">
        <table className="min-w-full text-sm border-collapse bg-white dark:bg-gray-800">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <th className={`${th} sticky left-0 bg-gray-50 dark:bg-gray-700 text-left min-w-[150px]`}>Category</th>
              {MONTHS.map((m, i) => (
                <th key={m} className={`${th} cursor-pointer hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors`}
                  onClick={() => goToMonth(i)}>{m}</th>
              ))}
              <th className={`${th} bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400`}>Year Total</th>
            </tr>
          </thead>

          <tbody>
            {/* ── Section 1: Fixed Expenses ── */}
            <tr className="bg-orange-50 dark:bg-orange-900/20 border-t border-orange-200 dark:border-orange-800">
              <td colSpan={14} className="sticky left-0 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wide">
                Fixed Expenses
              </td>
            </tr>

            {fixedRows.length === 0 && (
              <tr className="border-b dark:border-gray-700">
                <td colSpan={14} className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500 italic">No fixed expenses for {year}.</td>
              </tr>
            )}

            {fixedRows.map((row) => {
              const rowTotal = row.amounts.reduce((s, v) => s + v, 0)
              return (
                <tr key={row.id} className="border-b dark:border-gray-700 hover:bg-orange-50/40 dark:hover:bg-orange-900/10 transition-colors">
                  <td className={stickyLabel()}>{row.name}</td>
                  {row.amounts.map((v, m) => (
                    <td key={m} className={`${td} text-orange-700 dark:text-orange-400`}>{fmt(v)}</td>
                  ))}
                  <td className={`${td} bg-indigo-50 dark:bg-indigo-900/40 font-semibold text-indigo-700 dark:text-indigo-400`}>{fmt(rowTotal)}</td>
                </tr>
              )
            })}

            {/* Fixed subtotal */}
            <tr className="bg-orange-100 dark:bg-orange-900/30 border-t border-orange-300 dark:border-orange-700">
              <td className="sticky left-0 bg-orange-100 dark:bg-orange-900/30 px-3 py-2 text-sm font-semibold text-orange-800 dark:text-orange-300">Total Fixed</td>
              {monthlyFixedTotals.map((v, m) => (
                <td key={m} className={`${td} font-semibold text-orange-800 dark:text-orange-300`}>{fmt(v)}</td>
              ))}
              <td className={`${td} bg-indigo-100 dark:bg-indigo-900/50 font-bold text-indigo-800 dark:text-indigo-300`}>{fmt(yearFixedTotal)}</td>
            </tr>

            {/* ── Section 2: Variable Expenses ── */}
            <tr className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-200 dark:border-blue-800">
              <td colSpan={14} className="sticky left-0 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                Variable Expenses
              </td>
            </tr>

            {variableRows.length === 0 && (
              <tr className="border-b dark:border-gray-700">
                <td colSpan={14} className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500 italic">No variable expenses for {year}.</td>
              </tr>
            )}

            {variableRows.map((row) => {
              const vals = grid[row.key] ?? Array(12).fill(0)
              const rowTotal = vals.reduce((s, v) => s + v, 0)
              return (
                <tr key={row.key} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className={stickyLabel()}>{row.name}</td>
                  {vals.map((v, m) => {
                    const isMax = v > 0 && v === maxPerMonth[m]
                    return (
                      <td key={m} className={`${td} ${isMax ? 'text-orange-600 dark:text-orange-400 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                        {fmt(v)}
                      </td>
                    )
                  })}
                  <td className={`${td} bg-indigo-50 dark:bg-indigo-900/40 font-semibold text-indigo-700 dark:text-indigo-400`}>{fmt(rowTotal)}</td>
                </tr>
              )
            })}
          </tbody>

          {/* ── Summary rows ── */}
          <tfoot>
            <tr className="bg-gray-100 dark:bg-gray-700 border-t-2 border-gray-300 dark:border-gray-600">
              <td className="sticky left-0 bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Total Expenses</td>
              {monthlyTotals.map((v, m) => <td key={m} className={`${td} font-semibold text-gray-800 dark:text-gray-200`}>{fmt(v)}</td>)}
              <td className={`${td} bg-indigo-100 dark:bg-indigo-900/50 font-bold text-indigo-800 dark:text-indigo-300`}>{fmt(yearTotal)}</td>
            </tr>
            <tr className="bg-green-50 dark:bg-green-900/20 border-t dark:border-gray-700">
              <td className="sticky left-0 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm font-semibold text-green-700 dark:text-green-400">Total Savings</td>
              {monthlySavings.map((v, m) => (
                <td key={m} className={`${td} font-semibold ${v == null ? 'text-gray-300 dark:text-gray-600' : v >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-500'}`}>
                  {v == null ? '—' : fmt(v)}
                </td>
              ))}
              <td className={`${td} bg-indigo-100 dark:bg-indigo-900/50 font-bold ${yearSavings >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-500'}`}>{fmt(yearSavings)}</td>
            </tr>
            <tr className="bg-green-50 dark:bg-green-900/20 border-t dark:border-gray-700">
              <td className="sticky left-0 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm font-semibold text-green-700 dark:text-green-400">Savings %</td>
              {monthlySavingsPct.map((v, m) => (
                <td key={m} className={`${td} ${v == null ? 'text-gray-300 dark:text-gray-600' : v >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-500'}`}>
                  {v == null ? '—' : pct(v)}
                </td>
              ))}
              <td className={`${td} bg-indigo-100 dark:bg-indigo-900/50 font-bold ${avgSavingsPct >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-500'}`}>{pct(avgSavingsPct)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  )
}
