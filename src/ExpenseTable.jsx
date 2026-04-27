import React, { useState, useMemo, useCallback } from 'react'
import { useSettings } from './SettingsContext'

function EditableCell({ editing, value, onChange, type = 'text', children }) {
  if (!editing) return <span>{children ?? value}</span>
  if (type === 'select') return children
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      className="border border-theme-border rounded-theme-small px-1 py-0.5 text-sm w-full bg-theme-surface text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary/40" />
  )
}

export default function ExpenseTable({ expenses, onUpdate, onDelete, onBulkDelete, categories = [] }) {
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState({})
  const [manageMode, setManageMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showConfirm, setShowConfirm] = useState(false)
  const { formatAmount, getNumberColorClass, formatDate } = useSettings()

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])
  const activeCategories = useMemo(() => categories.filter((c) => !c.isDeleted), [categories])

  const resolveName = (exp) => {
    const cat = catMap[exp.categoryId]
    if (cat) return cat.isDeleted ? `${cat.name} (deleted)` : cat.name
    return exp.category || 'Uncategorized'
  }

  const startEdit = (expense) => { setEditId(expense.id); setDraft({ ...expense }) }
  const cancelEdit = () => { setEditId(null); setDraft({}) }
  const saveEdit = () => {
    if (!draft.amount || isNaN(draft.amount) || Number(draft.amount) === 0) return
    const cat = catMap[draft.categoryId]
    onUpdate(editId, { ...draft, amount: parseFloat(draft.amount), category: cat?.name ?? draft.category })
    cancelEdit()
  }

  const setField = (field) => (val) => setDraft((d) => ({ ...d, [field]: val }))
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  // ── Manage Mode helpers ─────────────────────────────────────────────────────
  const toggleManageMode = useCallback(() => {
    setManageMode((prev) => {
      if (prev) {
        setSelectedIds(new Set())
        setShowConfirm(false)
      }
      return !prev
    })
  }, [])

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === expenses.length) return new Set()
      return new Set(expenses.map((e) => e.id))
    })
  }, [expenses])

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return
    setShowConfirm(true)
  }, [selectedIds])

  const confirmDelete = useCallback(() => {
    onBulkDelete?.(Array.from(selectedIds))
    setSelectedIds(new Set())
    setShowConfirm(false)
  }, [selectedIds, onBulkDelete])

  if (expenses.length === 0) {
    return <p className="text-center text-sm text-theme-muted py-10">No expenses yet. Hit <strong>+</strong> to add one.</p>
  }

  const allSelected = selectedIds.size === expenses.length && expenses.length > 0
  const someSelected = selectedIds.size > 0

  return (
    <div className="overflow-x-auto">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
        <span className="text-sm text-theme-muted">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-2">
          {manageMode && someSelected && (
            <button
              onClick={handleBulkDelete}
              className="text-xs font-medium px-2.5 py-1.5 rounded-theme-small bg-theme-danger text-white hover:opacity-90 transition-opacity"
            >
              Delete {selectedIds.size}
            </button>
          )}
          <button
            onClick={toggleManageMode}
            className={`text-xs font-medium px-3 py-1.5 rounded-theme-small transition-colors ${
              manageMode
                ? 'bg-theme-primary text-white'
                : 'bg-theme-background text-theme-muted border border-theme-border hover:bg-theme-border'
            }`}
          >
            {manageMode ? 'Done' : 'Manage'}
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="modal-theme p-5 w-full max-w-xs space-y-4">
            <h3 className="text-base font-semibold text-theme-text">Confirm Delete</h3>
            <p className="text-sm text-theme-muted">
              Are you sure you want to delete <strong className="text-theme-text">{selectedIds.size}</strong> expense{selectedIds.size !== 1 ? 's' : ''}?
            </p>
            <div className="flex gap-2">
              <button onClick={confirmDelete} className="flex-1 bg-theme-danger hover:opacity-90 text-white text-sm font-medium py-2 rounded-theme-small transition-opacity">
                Delete
              </button>
              <button onClick={() => setShowConfirm(false)} className="flex-1 bg-theme-background hover:bg-theme-border text-theme-text text-sm font-medium py-2 rounded-theme-small transition-colors border border-theme-border">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <table className="w-full text-sm border-collapse table-theme">
        <thead>
          <tr>
            {manageMode && (
              <th className="px-2 py-2 text-center w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded-theme-small cursor-pointer"
                  aria-label="Select all"
                />
              </th>
            )}
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Category</th>
            <th className="px-3 py-2 text-left">Description</th>
            <th className="px-3 py-2 text-right">Amount</th>
            {manageMode && <th className="px-3 py-2 text-center">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {expenses.map((exp) => {
            const editing = editId === exp.id
            const isSelected = selectedIds.has(exp.id)
            return (
              <tr key={exp.id} className={`hover:bg-theme-primary/[0.04] transition-colors ${isSelected ? 'bg-theme-primary/[0.06]' : ''}`}>
                {manageMode && (
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(exp.id)}
                      className="w-4 h-4 rounded-theme-small cursor-pointer"
                      aria-label={`Select ${exp.description || 'expense'}`}
                    />
                  </td>
                )}
                <td className="px-3 py-2 text-theme-text">
                  <EditableCell editing={editing} type="date" value={draft.date} onChange={setField('date')}>
                    {formatDate(exp.date)}
                  </EditableCell>
                </td>
                <td className="px-3 py-2">
                  {editing ? (
                    <select value={draft.categoryId ?? ''} onChange={(e) => setField('categoryId')(Number(e.target.value))}
                      className="border border-theme-border rounded-theme-small px-1 py-0.5 text-sm w-full bg-theme-surface text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary/40">
                      {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <span className={catMap[exp.categoryId]?.isDeleted ? 'text-theme-muted italic' : 'text-theme-text'}>
                      {resolveName(exp)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-theme-text">
                  <EditableCell editing={editing} value={draft.description} onChange={setField('description')}>
                    {exp.description || <span className="text-theme-muted/50">—</span>}
                  </EditableCell>
                </td>
                <td className={`px-3 py-2 text-right ${getNumberColorClass(exp.amount)}`}>
                  <EditableCell editing={editing} type="number" value={draft.amount} onChange={setField('amount')}>
                    {formatAmount(exp.amount)}
                  </EditableCell>
                </td>
                {manageMode && (
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {editing ? (
                      <>
                        <button onClick={saveEdit} className="text-theme-success hover:opacity-80 font-medium mr-2">Save</button>
                        <button onClick={cancelEdit} className="text-theme-muted hover:text-theme-text">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(exp)} className="text-theme-primary hover:opacity-80 mr-2">Edit</button>
                        <button onClick={() => onDelete(exp.id)} className="text-theme-danger hover:opacity-80">Delete</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
