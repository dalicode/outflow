import React, { useRef, useState } from 'react'
import { useSettings } from './SettingsContext'
import { StorageService } from './StorageService'
import { THEMES } from './themeConfig'

function Row({ label, value, onChange, options }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="border dark:border-gray-600 rounded-theme-medium px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-theme-large shadow-sm p-5 space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{title}</h2>
      {children}
    </section>
  )
}

const themePreviews = {
  default: {
    background: '#f8fafc',
    border: '#e2e8f0',
    primary: '#6366f1',
  },
  modernSoft: {
    background: '#f5f3ff',
    border: '#ede9fe',
    primary: '#a78bfa',
  },
  sharpProfessional: {
    background: '#f1f5f9',
    border: '#cbd5e1',
    primary: '#334155',
  },
  darkMinimal: {
    background: '#09090b',
    border: '#27272a',
    primary: '#a1a1aa',
  },
  financeGlass: {
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    border: 'rgba(255,255,255,0.15)',
    primary: '#818cf8',
  },
}

function ThemeCard({ theme, isSelected, onClick }) {
  const preview = themePreviews[theme.id] || themePreviews.default
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 w-32 p-3 rounded-theme-large border-2 transition-all text-left ${
        isSelected 
          ? 'border-[var(--theme-primary)] ring-2 ring-[var(--theme-primary)] ring-opacity-30' 
          : 'border-transparent hover:border-[var(--theme-border)]'
      }`}
      style={{ backgroundColor: preview.background }}
    >
      <div 
        className="h-16 rounded-theme-small border"
        style={{ 
          backgroundColor: theme.id === 'financeGlass' ? 'rgba(255,255,255,0.1)' : '#ffffff',
          borderColor: preview.border 
        }}
      >
        <div className="flex gap-1 p-2">
          <div 
            className="h-2 flex-1 rounded-theme-small" 
            style={{ backgroundColor: preview.primary, opacity: 0.7 }}
          />
          <div 
            className="h-2 flex-1 rounded-theme-small" 
            style={{ backgroundColor: preview.primary, opacity: 0.4 }}
          />
        </div>
        <div className="px-2 space-y-1">
          <div className="h-2 w-3/4 rounded-theme-small" style={{ backgroundColor: preview.border }} />
          <div className="h-2 w-1/2 rounded-theme-small" style={{ backgroundColor: preview.primary, opacity: 0.8 }} />
        </div>
      </div>
      <p className="text-xs mt-2 text-center truncate" style={{ color: theme.colors.text }}>
        {theme.name}
      </p>
    </button>
  )
}

function ThemeSelector({ value, onChange }) {
  const themeList = Object.values(THEMES)
  
  return (
    <div className="space-y-3">
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {themeList.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            isSelected={value === theme.id}
            onClick={() => onChange(theme.id)}
          />
        ))}
      </div>
    </div>
  )
}

const CSV_HEADERS = ['Date', 'Category', 'Description', 'Amount', 'Month', 'Year']

function expenseToRow(exp, formatDate) {
  const d = exp.date || ''
  const [y, m] = d.split('-')
  return [
    formatDate(d),
    exp.category ?? '',
    exp.description ?? '',
    exp.amount ?? 0,
    m ? parseInt(m, 10) : '',
    y ?? '',
  ]
}

function downloadCSV(rows, filename) {
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`
  const csv = [CSV_HEADERS, ...rows].map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? []
    const clean = vals.map((v) => v.replace(/^"|"$/g, '').trim())
    return Object.fromEntries(headers.map((h, i) => [h, clean[i] ?? '']))
  })
}

export default function SettingsPage({ expenses, onImport }) {
  const { settings, save, formatDate, formatAmount, currentTheme } = useSettings()
  const fileRef = useRef()
  const [importStatus, setImportStatus] = useState('')
  const [replaceMode, setReplaceMode] = useState(false)
  const [exportRange, setExportRange] = useState({ from: '', to: '' })

  const handleExport = () => {
    let rows = expenses
    if (exportRange.from) rows = rows.filter((e) => e.date >= exportRange.from)
    if (exportRange.to)   rows = rows.filter((e) => e.date <= exportRange.to)
    const csvRows = rows.map((e) => expenseToRow(e, formatDate))
    downloadCSV(csvRows, `expenses-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('Reading…')
    const text = await file.text()
    const parsed = parseCSV(text)

    const valid = []; const errors = []
    parsed.forEach((row, i) => {
      const date = row.date || row['date']
      const amount = parseFloat(row.amount || row['amount'])
      if (!date || isNaN(amount) || amount <= 0) {
        errors.push(`Row ${i + 2}: invalid date or amount`)
        return
      }
      let iso = date
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
        const [m, d, y] = date.split('/'); iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
        const [d, m, y] = date.split('/'); iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
      }
      valid.push({
        date: iso,
        category: row.category || row['category'] || 'Uncategorized',
        description: row.description || row['description'] || '',
        amount,
      })
    })

    if (errors.length) {
      setImportStatus(`${errors.length} row(s) skipped: ${errors.slice(0, 3).join('; ')}`)
    }

    if (valid.length === 0) { setImportStatus('No valid rows found.'); return }

    const existing = await StorageService.getAll()
    const existingKeys = new Set(existing.map((e) => `${e.date}|${e.amount}|${e.description}`))

    let toAdd = replaceMode ? valid : valid.filter((r) => !existingKeys.has(`${r.date}|${r.amount}|${r.description}`))
    const skipped = valid.length - toAdd.length

    for (const row of toAdd) await StorageService.add(row)
    await onImport()

    setImportStatus(`Imported ${toAdd.length} row(s)${skipped ? `, skipped ${skipped} duplicate(s)` : ''}.${errors.length ? ` ${errors.length} invalid row(s) skipped.` : ''}`)
    fileRef.current.value = ''
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Settings</h1>

      <Card title="Visual Theme">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Choose a visual style. Theme changes apply instantly across the app.
        </p>
        <ThemeSelector 
          value={settings.visualTheme} 
          onChange={(v) => save({ visualTheme: v })} 
        />
      </Card>

      <Card title="Appearance">
        <Row label="Theme" value={settings.theme} onChange={(v) => save({ theme: v })}
          options={[['light','Light'],['dark','Dark'],['system','System']]} />
        <Row label="Font" value={settings.font} onChange={(v) => save({ font: v })}
          options={[['system','System default'],['sans','Sans-serif'],['serif','Serif'],['mono','Monospace']]} />
        <Row label="Font size" value={settings.fontSize} onChange={(v) => save({ fontSize: v })}
          options={[['0.85','Small (0.85×)'],['1','Medium (1×)'],['1.15','Large (1.15×)'],['1.3','X-Large (1.3×)']]} />
      </Card>

      <Card title="Number Format">
        <Row label="Currency symbol" value={settings.currencySymbol} onChange={(v) => save({ currencySymbol: v })}
          options={[['$','$ Dollar'],['€','€ Euro'],['£','£ Pound'],['¥','¥ Yen'],['₹','₹ Rupee']]} />
        <Row label="Decimal places" value={settings.decimalPlaces} onChange={(v) => save({ decimalPlaces: v })}
          options={[['0','0'],['1','1'],['2','2']]} />
        <Row label="Thousand separator" value={settings.thousandSep} onChange={(v) => save({ thousandSep: v })}
          options={[[',','1,000'],['.','1.000'],[' ','1 000']]} />
        <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">Preview: {formatAmount(1234567.89)}</p>
      </Card>

      <Card title="Date Format">
        <Row label="Format" value={settings.dateFormat} onChange={(v) => save({ dateFormat: v })}
          options={[['MM/DD/YYYY','MM/DD/YYYY'],['DD/MM/YYYY','DD/MM/YYYY'],['YYYY-MM-DD','YYYY-MM-DD']]} />
        <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">Preview: {formatDate(new Date().toISOString().slice(0,10))}</p>
      </Card>

      <Card title="Export to CSV (Google Sheets)">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Exports variable expenses only. Fixed expenses are excluded.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            From
            <input type="date" value={exportRange.from} onChange={(e) => setExportRange((r) => ({ ...r, from: e.target.value }))}
              className="border dark:border-gray-600 rounded-theme-medium px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            To
            <input type="date" value={exportRange.to} onChange={(e) => setExportRange((r) => ({ ...r, to: e.target.value }))}
              className="border dark:border-gray-600 rounded-theme-medium px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </label>
        </div>
        <button onClick={handleExport}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-theme-medium transition-colors">
          Download CSV
        </button>
      </Card>

      <Card title="Import from CSV (Google Sheets)">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Required columns: <code className="bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-1 rounded text-xs">Date, Category, Description, Amount</code>
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-3 cursor-pointer">
          <input type="checkbox" checked={replaceMode} onChange={(e) => setReplaceMode(e.target.checked)}
            className="rounded-theme-small" />
          Replace mode (re-import duplicates)
        </label>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleImport}
          className="block text-sm text-gray-500 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-theme-medium file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
        {importStatus && (
          <p className={`text-sm mt-2 ${importStatus.startsWith('Imported') ? 'text-green-600' : 'text-red-500'}`}>
            {importStatus}
          </p>
        )}
      </Card>
    </main>
  )
}