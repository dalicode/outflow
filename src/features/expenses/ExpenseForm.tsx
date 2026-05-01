import { useState, useMemo, type FormEvent } from 'react'
import { cn } from '../../utils/cn'
import { useSettings } from '../../context/settingsContext'
import Modal from '../../components/ui/Modal'
import { getLocalToday } from '../../utils/historicalDataHelpers'
import './expenses.css'
import type { Expense, Category } from '../../types'

const EMPTY_FORM = { date: getLocalToday(), categoryId: '', description: '', amount: '' }

interface CategoryModalProps {
  categories: Category[];
  onCategoriesChange: (
    action: 'add' | 'update' | 'delete',
    payload: { id?: number; name?: string },
  ) => Promise<void>;
  onClose: () => void;
}

function CategoryModal({ categories, onCategoriesChange, onClose }: CategoryModalProps) {
  const [newName, setNewName] = useState('')
  const [newError, setNewError] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const active = categories.filter((c) => !c.isDeleted)

  const addCat = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { setNewError('Name is required.'); return }
    if (active.some((c) => c.name.toLowerCase() === name.toLowerCase())) { setNewError('Already exists.'); return }
    await onCategoriesChange('add', { name })
    setNewName(''); setNewError('')
  }

  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = editName.trim()
    if (!name) return
    if (active.some((c) => c.id !== editId && c.name.toLowerCase() === name.toLowerCase())) return
    await onCategoriesChange('update', { id: editId as number, name })
    setEditId(null)
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Manage Categories" size="md">
      <form onSubmit={addCat} className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category…" autoFocus
          className="input-theme text-sm flex-1 px-3 py-2" />
        <button type="submit"             className="btn-primary-sm">Add</button>
      </form>
      {newError && <p className="text-theme-danger text-xs -mt-2">{newError}</p>}
      <ul className="space-y-1 max-h-64 overflow-y-auto scrollbar-themed">
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
                <button type="button" onClick={() => { setEditId(cat.id as number); setEditName(cat.name) }} className="text-theme-primary hover:opacity-80">Edit</button>
                <button type="button" onClick={() => onCategoriesChange('delete', { id: cat.id })} className="text-theme-danger hover:opacity-80">Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}

interface ExpenseFormProps {
  onAdd: (expense: Omit<Expense, 'id'>) => void;
  onClose: () => void;
  categories: Category[];
  onCategoriesChange: (
    action: 'add' | 'update' | 'delete',
    payload: { id?: number; name?: string },
  ) => Promise<void>;
}

export default function ExpenseForm({ onAdd, onClose, categories, onCategoriesChange }: ExpenseFormProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [showCatModal, setShowCatModal] = useState(false)

  const activeCategories = useMemo(() => categories.filter((c) => !c.isDeleted), [categories])
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.categoryId) { setError('Please select a category.'); return }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) === 0) { setError('Amount cannot be zero.'); return }
    const cat = categories.find((c) => c.id === Number(form.categoryId))
    onAdd({
      date: form.date,
      categoryId: Number(form.categoryId),
      category: cat?.name ?? '',
      description: form.description,
      amount: parseFloat(form.amount),
    })
    setForm(EMPTY_FORM); setError('')
  }

  const inputCls = 'input-theme px-3 py-2 w-full'

  return (
    <>
      <Modal isOpen={true} onClose={onClose} title="Add Expense" size="md">
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-theme-danger text-sm">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            className="btn-save-expense">
            Save Expense
          </button>
        </form>
      </Modal>
      {showCatModal && (
        <CategoryModal categories={categories} onCategoriesChange={onCategoriesChange} onClose={() => setShowCatModal(false)} />
      )}
    </>
  )
}
