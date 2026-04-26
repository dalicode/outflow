import React, { useState, useEffect } from 'react'

export default function SavingsForm({ savingsRate, onSave }) {
  const hasValue = savingsRate !== null && savingsRate !== undefined && savingsRate !== ''
  const [editing, setEditing] = useState(!hasValue)
  const [rate, setRate] = useState(savingsRate ?? '')
  const [error, setError] = useState('')

  // Sync when persisted value loads asynchronously
  useEffect(() => {
    if (hasValue) { setRate(savingsRate); setEditing(false) }
  }, [savingsRate])

  const submit = (e) => {
    e.preventDefault()
    const n = Number(rate)
    if (isNaN(n) || n < 0 || n > 100) { setError('Enter a value between 0 and 100.'); return }
    setError('')
    onSave(n)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-700">Savings Goal</h3>
          <button onClick={() => setEditing(true)} className="text-indigo-500 hover:text-indigo-700 text-sm">Edit</button>
        </div>
        <p className="text-2xl font-bold text-green-600">{Number(rate).toFixed(1)}%</p>
        <p className="text-sm text-gray-400">of available income after fixed expenses</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="font-semibold text-gray-700">Savings Goal</h3>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div className="flex gap-2 items-center">
        <input type="number" value={rate} onChange={(e) => setRate(e.target.value)}
          placeholder="e.g. 20" min="0" max="100" step="0.1"
          className="border rounded-theme-medium px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <span className="text-sm text-gray-500">%</span>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-theme-small transition-colors">Save</button>
        {hasValue && <button type="button" onClick={() => { setRate(savingsRate); setEditing(false) }}
          className="text-gray-400 hover:text-gray-600 text-sm px-3 py-2 rounded-theme-small">Cancel</button>}
      </div>
    </form>
  )
}
