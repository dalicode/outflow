import React, { useState } from 'react'

const EMPTY = { name: '', amount: '' }
const inputCls = 'border dark:border-gray-600 rounded-theme-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-700 dark:text-gray-100'

export default function FixedExpensesList({ items, onAdd, onUpdate, onDelete }) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState(EMPTY)
  const [error, setError] = useState('')

  const validate = (name, amount) => {
    if (!name.trim()) return 'Name is required.'
    if (!amount || isNaN(amount) || Number(amount) <= 0) return 'Enter a positive amount.'
    return ''
  }

  const handleAdd = (e) => {
    e.preventDefault()
    const err = validate(form.name, form.amount)
    if (err) { setError(err); return }
    onAdd({ name: form.name.trim(), amount: parseFloat(form.amount) })
    setForm(EMPTY); setError(''); setShowModal(false)
  }

  const startEdit = (item) => { setEditId(item.id); setDraft({ name: item.name, amount: item.amount }) }
  const cancelEdit = () => { setEditId(null); setDraft(EMPTY) }
  const saveEdit = () => {
    const err = validate(draft.name, draft.amount)
    if (err) return
    onUpdate(editId, { name: draft.name.trim(), amount: parseFloat(draft.amount) })
    cancelEdit()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200">Fixed Expenses</h3>
        <button onClick={() => { setForm(EMPTY); setError(''); setShowModal(true) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none transition-colors"
          aria-label="Add fixed expense">+</button>
      </div>

      {items.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">No fixed expenses added yet.</p>}

      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            {editId === item.id ? (
              <>
                <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="border dark:border-gray-600 rounded-theme-small px-2 py-1 flex-1 text-sm bg-white dark:bg-gray-700 dark:text-gray-100" />
                <input type="number" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                  className="border dark:border-gray-600 rounded-theme-small px-2 py-1 w-24 text-sm bg-white dark:bg-gray-700 dark:text-gray-100" />
                <button onClick={saveEdit} className="text-green-600 hover:text-green-800 font-medium">Save</button>
                <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">Cancel</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-gray-700 dark:text-gray-200">{item.name}</span>
                <span className="text-gray-500 dark:text-gray-400">${item.amount.toFixed(2)}</span>
                <button onClick={() => startEdit(item)} className="text-indigo-500 hover:text-indigo-700">Edit</button>
                <button onClick={() => onDelete(item.id)} className="text-red-400 hover:text-red-600">Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-10">
          <form onSubmit={handleAdd} className="bg-white dark:bg-gray-800 rounded-theme-large shadow-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Add Fixed Expense</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
              Name
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Rent" autoFocus className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
              Amount ($)
              <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00" min="0.01" step="0.01" className={inputCls} />
            </label>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-theme-medium transition-colors">Add</button>
          </form>
        </div>
      )}
    </div>
  )
}
