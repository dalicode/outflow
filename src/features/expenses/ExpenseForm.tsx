import { useState, useMemo, type FormEvent } from 'react'
import { cn } from '../../utils/cn'
import { useSettings } from '../../context/settingsContext'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import CreatableCombobox from '../../components/inputs/CreatableCombobox'
import DatePicker from '../../components/inputs/DatePicker'
import { getLocalToday } from '../../utils/historicalDataHelpers'
import { normalizeName } from '../../utils/normalizeName'
import { usePayees } from '../../hooks/useLocalData'
import { StorageService } from '../../services/storageService'
import './expenses.css'
import type { Expense, Category, Payee } from '../../types'

const EMPTY_FORM = { date: getLocalToday(), categoryId: '', payeeId: '', description: '', amount: '' }

function getFormFromExpense(expense: Expense) {
  return {
    date: expense.date,
    categoryId: String(expense.categoryId ?? ''),
    payeeId: String(expense.payeeId ?? ''),
    description: expense.description ?? '',
    amount: String(expense.amount ?? ''),
  }
}

interface CategoryModalProps {
  categories: Category[];
  onCategoriesChange?: (
    action: 'add' | 'update' | 'delete',
    payload: { id?: number; name?: string },
  ) => Promise<number | undefined>;
  onClose: () => void;
  refreshCategories?: () => void;
}

function CategoryModal({ categories, onCategoriesChange, onClose, refreshCategories }: CategoryModalProps) {
  const [newName, setNewName] = useState('')
  const [newError, setNewError] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const active = categories.filter((c) => !c.isArchived)

  const addCat = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { setNewError('Name is required.'); return }
    if (active.some((c) => c.name.toLowerCase() === name.toLowerCase())) { setNewError('Already exists.'); return }
    if (onCategoriesChange) {
      await onCategoriesChange('add', { name })
    } else {
      await StorageService.addCategory(name)
      refreshCategories?.()
    }
    setNewName(''); setNewError('')
  }

  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = editName.trim()
    if (!name) return
    if (active.some((c) => c.id !== editId && c.name.toLowerCase() === name.toLowerCase())) return
    if (onCategoriesChange) {
      await onCategoriesChange('update', { id: editId as number, name })
    } else {
      await StorageService.updateCategory(editId as number, { name })
      refreshCategories?.()
    }
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
                <span className="flex-1 text-theme-text">{normalizeName(cat.name)}</span>
                <button type="button" onClick={() => { setEditId(cat.id as number); setEditName(cat.name) }} className="text-theme-primary hover:opacity-80">Edit</button>
                <button type="button" onClick={async () => {
                  if (onCategoriesChange) {
                    await onCategoriesChange('delete', { id: cat.id })
                  } else {
                    await StorageService.archiveCategory(cat.id as number)
                    refreshCategories?.()
                  }
                }} className="text-theme-danger hover:opacity-80">Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}

interface PayeeModalProps {
  payees: Payee[];
  onPayeesChange?: () => void;
  onClose: () => void;
  refreshPayees?: () => void;
}

function PayeeModal({ payees, onPayeesChange, onClose, refreshPayees }: PayeeModalProps) {
  const [newName, setNewName] = useState('')
  const [newError, setNewError] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const active = payees.filter((p) => !p.isArchived)

  const addPayee = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { setNewError('Name is required.'); return }
    if (active.some((p) => p.name.toLowerCase() === name.toLowerCase())) { setNewError('Already exists.'); return }
    try {
      await StorageService.addPayee(name)
      setNewName(''); setNewError('')
      onPayeesChange?.()
      refreshPayees?.()
    } catch (err) {
      setNewError((err as Error).message)
    }
  }

  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = editName.trim()
    if (!name) return
    if (active.some((p) => p.id !== editId && p.name.toLowerCase() === name.toLowerCase())) return
    try {
      await StorageService.updatePayee(editId as number, name)
      setEditId(null)
      onPayeesChange?.()
      refreshPayees?.()
    } catch (err) {
      setNewError((err as Error).message)
    }
  }

  const handleArchive = async (id: number) => {
    await StorageService.archivePayee(id)
    onPayeesChange?.()
    refreshPayees?.()
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Manage Payees" size="md">
      <form onSubmit={addPayee} className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New payee…" autoFocus
          className="input-theme text-sm flex-1 px-3 py-2" />
        <button type="submit" className="btn-primary-sm">Add</button>
      </form>
      {newError && <p className="text-theme-danger text-xs -mt-2">{newError}</p>}
      <ul className="space-y-1 max-h-64 overflow-y-auto scrollbar-themed">
        {active.map((payee) => (
          <li key={payee.id} className="flex items-center gap-2 text-sm">
            {editId === payee.id ? (
              <form onSubmit={saveEdit} className="flex gap-2 flex-1">
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="input-theme text-sm flex-1 px-2 py-1" />
                <button type="submit" className="text-theme-success hover:opacity-80 font-medium">Save</button>
                <button type="button" onClick={() => setEditId(null)} className="text-theme-muted hover:text-theme-text">Cancel</button>
              </form>
            ) : (
              <>
                <span className="flex-1 text-theme-text">{normalizeName(payee.name)}</span>
                <button type="button" onClick={() => { setEditId(payee.id as number); setEditName(payee.name) }} className="text-theme-primary hover:opacity-80">Edit</button>
                <button type="button" onClick={() => handleArchive(payee.id as number)} className="text-theme-danger hover:opacity-80">Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}

interface ExpenseFormProps {
  onAdd?: (expense: Omit<Expense, 'id'>) => void;
  onUpdate?: (id: number, changes: Partial<Expense>) => void;
  onClose: () => void;
  categories: Category[];
  onCategoriesChange?: (
    action: 'add' | 'update' | 'delete',
    payload: { id?: number; name?: string },
  ) => Promise<number | undefined>;
  initialExpense?: Expense;
}

export default function ExpenseForm({ onAdd, onUpdate, onClose, categories, onCategoriesChange, initialExpense }: ExpenseFormProps) {
  const isEdit = !!initialExpense
  const [form, setForm] = useState(() => isEdit ? getFormFromExpense(initialExpense) : EMPTY_FORM)
  const [error, setError] = useState('')
  const [showCatModal, setShowCatModal] = useState(false)
  const [showPayeeModal, setShowPayeeModal] = useState(false)
  const { payees, refresh: refreshPayees } = usePayees()

  const activeCategories = useMemo(() => categories.filter((c) => !c.isArchived), [categories])
  const activePayees = useMemo(() => payees.filter((p) => !p.isArchived).sort((a, b) => a.name.localeCompare(b.name)), [payees])

  const categoryOptions = useMemo(
    () => activeCategories.map((c) => ({ id: c.id!, label: normalizeName(c.name) })),
    [activeCategories]
  )
  const payeeOptions = useMemo(
    () => activePayees.map((p) => ({ id: p.id!, label: normalizeName(p.name) })),
    [activePayees]
  )

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.categoryId) { setError('Please select a category.'); return }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) === 0) { setError('Amount cannot be zero.'); return }
    const cat = categories.find((c) => c.id === Number(form.categoryId))
    const payee = activePayees.find((p) => p.id === Number(form.payeeId))
    const payload = {
      date: form.date,
      categoryId: Number(form.categoryId),
      payeeId: form.payeeId ? Number(form.payeeId) : undefined,
      description: form.description,
      amount: parseFloat(form.amount),
    }
    if (isEdit && initialExpense) {
      onUpdate?.(initialExpense.id as number, payload)
    } else {
      onAdd?.(payload)
      setForm(EMPTY_FORM)
    }
    setError('')
  }

  const inputCls = 'input-theme px-3 py-2 w-full'

  return (
    <>
      <Modal isOpen={true} onClose={onClose} title={isEdit ? 'Edit Expense' : 'Add Expense'} size="md"
        footer={
          <ModalFooter>
            <button type="button" onClick={onClose} className="btn-cancel-sm flex-1">
              Cancel
            </button>
            <button type="submit" form="expense-form" className="btn-save-expense flex-1">
              {isEdit ? 'Save Changes' : 'Save Expense'}
            </button>
          </ModalFooter>
        }
      >
        <form id="expense-form" onSubmit={submit} className="space-y-4">
          {error && <p className="text-theme-danger text-sm">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-theme-muted">
              Date
              <DatePicker
                value={form.date}
                onChange={(iso) => setForm((f) => ({ ...f, date: iso }))}
                placeholder="Select date…"
              />
            </label>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-sm text-theme-muted">Category</label>
                <button type="button" onClick={() => setShowCatModal(true)}
                  className="text-xs text-theme-primary hover:opacity-80 font-medium">+ Manage</button>
              </div>
              <CreatableCombobox
                value={form.categoryId ? Number(form.categoryId) : undefined}
                options={categoryOptions}
                placeholder="Select or add category"
                emptyMessage="No categories found."
                allowCreate
                required
                onChange={(id) => setForm((f) => ({ ...f, categoryId: id != null ? String(id) : '' }))}
                onCreate={async (name) => {
                  if (onCategoriesChange) {
                    const newId = await onCategoriesChange('add', { name })
                    return newId!
                  }
                  return await StorageService.addCategory(name)
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-sm text-theme-muted">Payee</label>
              <button type="button" onClick={() => setShowPayeeModal(true)}
                className="text-xs text-theme-primary hover:opacity-80 font-medium">+ Manage</button>
            </div>
            <CreatableCombobox
              value={form.payeeId ? Number(form.payeeId) : undefined}
              options={payeeOptions}
              placeholder="Select or add payee"
              emptyMessage="No payees found."
              allowCreate
              allowClear
              onChange={(id) => setForm((f) => ({ ...f, payeeId: id != null ? String(id) : '' }))}
              onCreate={async (name) => {
                const newId = await StorageService.addPayee(name)
                await refreshPayees()
                return newId
              }}
            />
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
        </form>
      </Modal>
      {showCatModal && (
        <CategoryModal categories={categories} onCategoriesChange={onCategoriesChange} onClose={() => setShowCatModal(false)} />
      )}
      {showPayeeModal && (
        <PayeeModal payees={payees} onPayeesChange={refreshPayees} onClose={() => setShowPayeeModal(false)} />
      )}
    </>
  )
}
