// @ts-nocheck
import React, { useState, useMemo } from 'react'
import { useSettings } from '../../context/settingsContext'

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY_FORM = { date: today(), categoryId: '', description: '', amount: '' }

function CategoryModal({ categories, onCategoriesChange, onClose }) {
  const [newName, setNewName] = useState('')
  const [newError, setNewError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const active = categories.filter((c) => !c.isDeleted)

  const addCat = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { setNewError('Name is required.'); return }
    if (active.some((c) => c.name.toLowerCase() === name.toLowerCase())) { setNewError('Already exists.'); return }
    await onCategoriesChange('add', { name })
    setNewName(''); setNewError('')
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    const name = editName.trim()
    if (!name) return
    if (active.some((c) => c.id !== editId && c.name.toLowerCase() === name.toLowerCase())) return
    await onCategoriesChange('update', { id: editId, name })
    setEditId(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-20">
      <div className="modal-theme p-5 w-full max-w-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold text-theme-text">Manage Categories</h2>
          <button onClick={onClose} className="text-theme-muted hover:text-theme-text text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={addCat} className="flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category…" autoFocus
            className="input-theme text-sm flex-1 px-3 py-2" />
          <button type="submit" className="bg-theme-primary hover:opacity-90 text-white text-sm px-3 py-2 rounded-theme-small transition-opacity">Add</button>
        </form>
        {newError && <p className="text-theme-danger text-xs -mt-2">{newError}</p>}
        <ul className="space-y-1 max-h-64 overflow-y-auto">
          {active.map((cat) => (
            <li key={cat.id} className="flex items-center gap-2 text-sm">
              {editId === cat.id ? (
                <form onSubmit={saveEdit} className="flex gap-2 flex-1">
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="input-theme text-sm flex-1 px-2 py-1" />
                  <button type="submit" className="text-theme-success hover:opacity-80 font-medium">Save</button>
                  <button type="button" onClick={() => setEditId(null)} className="text-theme-muted hover:text-theme-text">Cancel</button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-theme-text">{cat.name}</span>
                  <button type="button" onClick={() => { setEditId(cat.id); setEditName(cat.name) }} className="text-theme-primary hover:opacity-80">Edit</button>
                  <button type="button" onClick={() => onCategoriesChange('delete', { id: cat.id })} className="text-theme-danger hover:opacity-80">Delete</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function ExpenseForm({ onAdd, onClose, categories, onCategoriesChange }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [showCatModal, setShowCatModal] = useState(false)

  const activeCategories = useMemo(() => categories.filter((c) => !c.isDeleted), [categories])
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.categoryId) { setError('Please select a category.'); return }
    if (!form.amount || isNaN(form.amount) || Number(form.amount) === 0) { setError('Amount cannot be zero.'); return }
    const cat = categories.find((c) => c.id === Number(form.categoryId))
    onAdd({ ...form, categoryId: Number(form.categoryId), category: cat?.name ?? '', amount: parseFloat(form.amount) })
    setForm(EMPTY_FORM); setError('')
  }

  const inputCls = 'input-theme px-3 py-2 w-full'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-10">
        <form onSubmit={submit}
          className="modal-theme w-full sm:max-w-md space-y-4 p-5">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-theme-text">Add Expense</h2>
            <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme-text text-xl leading-none">&times;</button>
          </div>
          {error && <p className="text-theme-danger text-sm">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-theme-muted">
              Date
              <input type="date" value={form.date} onChange={set('date')} required className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-theme-muted">
              <span className="flex items-center justify-between">
                Category
                <button type="button" onClick={() => setShowCatModal(true)}
                  className="text-xs text-theme-primary hover:opacity-80 font-medium">+ Manage</button>
              </span>
              <select value={form.categoryId} onChange={set('categoryId')} required className={inputCls}>
                <option value="">Select…</option>
                {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-theme-muted">
            Description
            <input type="text" value={form.description} onChange={set('description')} placeholder="Optional" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-theme-muted">
            Amount ($)
            <input type="number" value={form.amount} onChange={set('amount')} placeholder="0.00"
              step="0.01" required inputMode="decimal" className={inputCls} />
          </label>
          <button type="submit"
            className="w-full bg-theme-primary hover:opacity-90 text-white font-medium py-3 rounded-theme-medium transition-opacity">
            Save Expense
          </button>
        </form>
      </div>
      {showCatModal && (
        <CategoryModal categories={categories} onCategoriesChange={onCategoriesChange} onClose={() => setShowCatModal(false)} />
      )}
    </>
  )
}
