import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/summary', label: 'Summary' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/settings', label: 'Settings' },
]

const activeClass = 'bg-indigo-700 text-white'
const inactiveClass = 'text-indigo-100 hover:bg-indigo-700 hover:text-white'

export default function Navbar({ onAddExpense, syncDot, onSignOut, userEmail }) {
  const [open, setOpen] = useState(false)

  return (
    <nav className="bg-indigo-600 shadow">
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
        <span className="text-white font-bold text-lg tracking-tight">Spending Tracker</span>

        {/* Desktop */}
        <div className="hidden sm:flex items-center gap-1">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-theme-small text-sm font-medium transition-colors ${isActive ? activeClass : inactiveClass}`
              }>
              {label}
            </NavLink>
          ))}
          {syncDot && <span className="ml-2">{syncDot}</span>}
          <button onClick={onAddExpense}
            className="ml-3 bg-white text-indigo-600 font-bold text-lg w-8 h-8 rounded-theme-medium shadow hover:bg-indigo-50 transition-colors flex items-center justify-center"
            aria-label="Add expense">+</button>
          {onSignOut && (
            <button onClick={onSignOut}
              className="ml-1 text-indigo-200 hover:text-white text-xs px-2 py-1 rounded-theme-small transition-colors"
              title={userEmail}>
              Sign out
            </button>
          )}
        </div>

        {/* Mobile */}
        <div className="flex sm:hidden items-center gap-2">
          {syncDot}
          <button onClick={onAddExpense}
            className="bg-white text-indigo-600 font-bold text-lg w-8 h-8 rounded-theme-medium shadow flex items-center justify-center"
            aria-label="Add expense">+</button>
          <button onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" className="text-white p-1">
            {open ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden bg-indigo-700 px-4 pb-3 flex flex-col gap-1">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} end onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `px-3 py-2 rounded-theme-small text-sm font-medium transition-colors ${isActive ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-800'}`
              }>
              {label}
            </NavLink>
          ))}
          {onSignOut && (
            <button onClick={onSignOut} className="text-left px-3 py-2 text-indigo-200 hover:text-white text-sm">
              Sign out {userEmail ? `(${userEmail})` : ''}
            </button>
          )}
        </div>
      )}
    </nav>
  )
}
