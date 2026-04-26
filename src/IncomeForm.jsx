import React, { useState, useEffect } from 'react'

const FREQUENCIES = ['monthly', 'biweekly', 'weekly']
const MULTIPLIERS = { monthly: 1, biweekly: 2.17, weekly: 4.33 }
const inputCls = 'border dark:border-gray-600 rounded-theme-medium px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-700 dark:text-gray-100'

export default function IncomeForm({ income, frequency, onSave }) {
  const [editing, setEditing] = useState(!income)
  const [amt, setAmt] = useState(income || '')
  const [freq, setFreq] = useState(frequency || 'monthly')
  const [error, setError] = useState('')

  useEffect(() => {
    if (income) { setAmt(income); setFreq(frequency); setEditing(false) }
  }, [income, frequency])

  const submit = (e) => {
    e.preventDefault()
    if (!amt || isNaN(amt) || Number(amt) <= 0) { setError('Enter a positive amount.'); return }
    setError('')
    onSave({ income: parseFloat(amt), frequency: freq, monthlyIncome: parseFloat(amt) * MULTIPLIERS[freq] })
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">Income</h3>
          <button onClick={() => setEditing(true)} className="text-indigo-500 hover:text-indigo-700 text-sm">Edit</button>
        </div>
        <p className="text-2xl font-bold text-indigo-600">${parseFloat(amt).toFixed(2)}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 capitalize">{freq} · ${(parseFloat(amt) * MULTIPLIERS[freq]).toFixed(2)}/mo</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="font-semibold text-gray-700 dark:text-gray-200">Income</h3>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div className="flex gap-2">
        <input type="number" value={amt} onChange={(e) => setAmt(e.target.value)}
          placeholder="Amount" min="0.01" step="0.01" className={`${inputCls} flex-1`} />
        <select value={freq} onChange={(e) => setFreq(e.target.value)} className={inputCls}>
          {FREQUENCIES.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-theme-medium transition-colors">Save</button>
        {income && <button type="button" onClick={() => { setAmt(income); setFreq(frequency); setEditing(false) }}
          className="text-gray-400 hover:text-gray-600 text-sm px-3 py-2">Cancel</button>}
      </div>
    </form>
  )
}
