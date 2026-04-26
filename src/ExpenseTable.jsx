import React, { useState, useMemo } from 'react'
import { useSettings } from './SettingsContext'

function EditableCell({ editing, value, onChange, type = 'text', children }) {
  if (!editing) return <span>{children ?? value}</span>
  if (type === 'select') return children
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      className="border dark:border-gray-600 rounded-theme-small px-1 py-0.5 text-sm w-full bg-white dark:bg-gray-700 dark:text-gray-100" />
  )
}

export default function ExpenseTable({ expenses, onUpdate, onDelete, categories = [] }) {
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState({})
  const { formatAmount, formatDate } = useSettings()

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
    if (!draft.amount || isNaN(draft.amount) || Number(draft.amount) <= 0) return
    const cat = catMap[draft.categoryId]
    onUpdate(editId, { ...draft, amount: parseFloat(draft.amount), category: cat?.name ?? draft.category })
    cancelEdit()
  }

  const setField = (field) => (val) => setDraft((d) => ({ ...d, [field]: val }))
  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  if (expenses.length === 0) {
    return <p className="text-center text-gray-400 dark:text-gray-500 py-10">No expenses yet. Hit <strong>+</strong> to add one.</p>
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex justify-between items-center mb-3 px-1">
        <span className="text-sm text-gray-500 dark:text-gray-400">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</span>
        <span className="text-lg font-semibold text-indigo-700 dark:text-indigo-400">Total: {formatAmount(total)}</span>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wide">
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Category</th>
            <th className="px-3 py-2 text-left">Description</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((exp) => {
            const editing = editId === exp.id
            return (
              <tr key={exp.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-3 py-2 dark:text-gray-200">
                  <EditableCell editing={editing} type="date" value={draft.date} onChange={setField('date')}>
                    {formatDate(exp.date)}
                  </EditableCell>
                </td>
                <td className="px-3 py-2">
                  {editing ? (
                    <select value={draft.categoryId ?? ''} onChange={(e) => setField('categoryId')(Number(e.target.value))}
                      className="border dark:border-gray-600 rounded-theme-small px-1 py-0.5 text-sm w-full bg-white dark:bg-gray-700 dark:text-gray-100">
                      {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <span className={catMap[exp.categoryId]?.isDeleted ? 'text-gray-400 italic' : 'dark:text-gray-200'}>
                      {resolveName(exp)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 dark:text-gray-200">
                  <EditableCell editing={editing} value={draft.description} onChange={setField('description')}>
                    {exp.description || <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </EditableCell>
                </td>
                <td className="px-3 py-2 text-right dark:text-gray-200">
                  <EditableCell editing={editing} type="number" value={draft.amount} onChange={setField('amount')}>
                    {formatAmount(exp.amount)}
                  </EditableCell>
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  {editing ? (
                    <>
                      <button onClick={saveEdit} className="text-green-600 hover:text-green-800 font-medium mr-2">Save</button>
                      <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(exp)} className="text-indigo-500 hover:text-indigo-700 mr-2">Edit</button>
                      <button onClick={() => onDelete(exp.id)} className="text-red-400 hover:text-red-600">Delete</button>
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
