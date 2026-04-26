import React, { useState, useEffect, useMemo } from 'react'
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom'
import { StorageService } from './StorageService'
import { useAuth } from './AuthContext'
import { supabase } from './supabase'
import Navbar from './Navbar'
import ExpenseForm from './ExpenseForm'
import ExpenseTable from './ExpenseTable'
import SummaryPage from './SummaryPage'
import AnalyticsPage from './AnalyticsPage'
import AuthPage from './AuthPage'
import SettingsPage from './SettingsPage'

const currentMonthKey = () => new Date().toISOString().slice(0, 7)

// ── Sync status dot ───────────────────────────────────────────────────────────
function SyncDot({ status }) {
  if (!supabase) return null
  const styles = {
    idle:    'bg-green-400',
    syncing: 'bg-yellow-400 animate-pulse',
    offline: 'bg-gray-400',
    error:   'bg-red-400',
  }
  const labels = { idle: 'Synced', syncing: 'Syncing…', offline: 'Offline', error: 'Sync error' }
  return (
    <span className="flex items-center gap-1 text-xs text-indigo-200" title={labels[status]}>
      <span className={`w-2 h-2 rounded-theme-small ${styles[status] ?? styles.idle}`} />
      <span className="hidden sm:inline">{labels[status]}</span>
    </span>
  )
}

// ── Budget insight cards ──────────────────────────────────────────────────────
function BudgetInsights({ monthTotal, monthlyIncome, savingsRate, totalFixed, fixedExpenses }) {
  if (!monthlyIncome) return null
  const available = monthlyIncome - totalFixed
  const savings = Math.max(0, available * (savingsRate / 100))
  const remaining = available - savings - monthTotal
  const totalSavings = savings + Math.max(0, remaining)

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Budget Insights</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Monthly Spending', value: monthTotal, color: 'text-yellow-600' },
          { label: 'Auto Savings', value: savings, color: 'text-green-600' },
          { label: 'Remaining Budget', value: remaining, color: remaining >= 0 ? 'text-emerald-600' : 'text-red-500' },
          { label: 'Total Savings', value: totalSavings, color: 'text-indigo-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-4 py-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-lg font-semibold ${color}`}>${value.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Fixed Expenses summary card */}
      {fixedExpenses.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-4 py-3 space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Fixed Expenses</p>
            <p className="text-base font-semibold text-orange-600">${totalFixed.toFixed(2)}/mo</p>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {fixedExpenses.map((f) => (
              <li key={f.id} className="flex justify-between py-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">{f.name}</span>
                <span className="text-gray-800 dark:text-gray-100 font-medium">${f.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ expenses, categories, onUpdate, onDelete }) {
  const now = new Date()
  const [searchParams] = useSearchParams()
  const [selectedYear, setSelectedYear] = useState(() => parseInt(searchParams.get('year')) || now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const m = parseInt(searchParams.get('month'))
    return isNaN(m) ? now.getMonth() : m
  })
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [savingsRate, setSavingsRate] = useState(0)
  const [totalFixed, setTotalFixed] = useState(0)
  const [fixedExpensesList, setFixedExpensesList] = useState([])

  useEffect(() => {
    Promise.all([
      StorageService.getSetting('monthlyIncome', 0),
      StorageService.getSetting('savingsRate', 0),
      StorageService.getFixedExpenses(),
    ]).then(([income, rate, fixed]) => {
      setMonthlyIncome(income)
      setSavingsRate(rate)
      setFixedExpensesList(fixed)
      setTotalFixed(fixed.reduce((s, f) => s + f.amount, 0))
    })
  }, [])

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1) }
    else setSelectedMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1) }
    else setSelectedMonth((m) => m + 1)
  }

  const selectedKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
  const isCurrentMonth = selectedKey === currentMonthKey()

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])
  const activeCategories = useMemo(() => categories.filter((c) => !c.isDeleted), [categories])
  const resolveName = (exp) => catMap[exp.categoryId]?.name ?? exp.category ?? 'Uncategorized'

  const monthlyExpenses = useMemo(() =>
    expenses.filter((e) => e.date.startsWith(selectedKey)), [expenses, selectedKey])

  const filtered = useMemo(() =>
    categoryFilter === 'All' ? monthlyExpenses : monthlyExpenses.filter((e) => resolveName(e) === categoryFilter),
    [monthlyExpenses, categoryFilter, catMap])

  const monthTotal = useMemo(() => monthlyExpenses.reduce((s, e) => s + e.amount, 0), [monthlyExpenses])

  const categoryTotals = useMemo(() => {
    const map = {}
    monthlyExpenses.forEach((e) => { const n = resolveName(e); map[n] = (map[n] || 0) + e.amount })
    return Object.entries(map).sort(([, a], [, b]) => b - a)
  }, [monthlyExpenses, catMap])

  const label = new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })

  const filterPills = useMemo(() => {
    const names = new Set(monthlyExpenses.map(resolveName))
    return ['All', ...activeCategories.map((c) => c.name).filter((n) => names.has(n))]
  }, [monthlyExpenses, activeCategories, catMap])

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <BudgetInsights monthTotal={monthTotal} monthlyIncome={monthlyIncome} savingsRate={savingsRate} totalFixed={totalFixed} fixedExpenses={fixedExpensesList} />

      {categoryTotals.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Spending by Category</h2>
          <div className="flex flex-wrap gap-2">
            {categoryTotals.map(([cat, total]) => (
              <div key={cat} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-3 py-2 flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{cat}</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">${total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white dark:bg-gray-800 rounded-theme-large shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 rounded-theme-small hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors" aria-label="Previous month">&#8592;</button>
          <div className="text-center">
            <span className={`text-lg font-semibold ${isCurrentMonth ? 'text-indigo-600' : 'text-gray-800 dark:text-gray-100'}`}>{label}</span>
            {isCurrentMonth && <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-theme-medium">current</span>}
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{monthlyExpenses.length} transaction{monthlyExpenses.length !== 1 ? 's' : ''} · ${monthTotal.toFixed(2)}</p>
          </div>
          <button onClick={nextMonth} className="p-2 rounded-theme-small hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors" aria-label="Next month">&#8594;</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterPills.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1 rounded-theme-medium text-sm font-medium transition-colors ${
                categoryFilter === c ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>{c}</button>
          ))}
        </div>

        <ExpenseTable expenses={filtered} onUpdate={onUpdate} onDelete={onDelete} categories={categories} />
      </section>
    </main>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading, syncStatus, triggerSync, signOut } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    Promise.all([StorageService.getAll(), StorageService.getCategories()])
      .then(([exps, cats]) => { setExpenses(exps); setCategories(cats) })
  }, [])

  // Re-load local data after a sync pull so UI reflects merged state
  useEffect(() => {
    if (syncStatus === 'idle') {
      Promise.all([StorageService.getAll(), StorageService.getCategories()])
        .then(([exps, cats]) => { setExpenses(exps); setCategories(cats) })
    }
  }, [syncStatus])

  const refreshCategories = () => StorageService.getCategories().then(setCategories)

  const handleCategoriesChange = async (action, payload) => {
    if (action === 'add') await StorageService.addCategory(payload.name)
    else if (action === 'update') await StorageService.updateCategory(payload.id, { name: payload.name })
    else if (action === 'delete') await StorageService.deleteCategory(payload.id)
    await refreshCategories()
    triggerSync?.()
  }

  const handleAdd = async (expense) => {
    await StorageService.add(expense)
    setExpenses(await StorageService.getAll())
    setShowForm(false)
    triggerSync?.()
  }

  const handleUpdate = async (id, changes) => {
    await StorageService.update(id, changes)
    setExpenses(await StorageService.getAll())
    triggerSync?.()
  }

  const handleDelete = async (id) => {
    await StorageService.remove(id)
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    triggerSync?.()
  }

  // Show auth page only when Supabase is configured and user is not logged in
  if (supabase && !loading && !user) return <AuthPage />
  if (loading) return null

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navbar
          onAddExpense={() => setShowForm(true)}
          syncDot={<SyncDot status={syncStatus} />}
          onSignOut={supabase ? signOut : null}
          userEmail={user?.email}
        />
        <Routes>
          <Route path="/" element={
            <Dashboard expenses={expenses} categories={categories} onUpdate={handleUpdate} onDelete={handleDelete} />
          } />
          <Route path="/summary" element={<SummaryPage expenses={expenses} />} />
          <Route path="/analytics" element={<AnalyticsPage expenses={expenses} categories={categories} />} />
          <Route path="/settings" element={
            <SettingsPage expenses={expenses} onImport={async () => setExpenses(await StorageService.getAll())} />
          } />
        </Routes>
        {showForm && (
          <ExpenseForm
            onAdd={handleAdd}
            onClose={() => setShowForm(false)}
            categories={categories}
            onCategoriesChange={handleCategoriesChange}
          />
        )}
      </div>
    </BrowserRouter>
  )
}
