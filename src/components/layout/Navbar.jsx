import React, { useState } from "react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/summary", label: "Summary" },
  { to: "/analytics", label: "Analytics" },
  { to: "/settings", label: "Settings" },
];

export default function Navbar({
  onAddExpense,
  syncDot,
  onSignOut,
  userEmail,
}) {
  const [open, setOpen] = useState(false);

  const activeClass = "bg-theme-primary/10 text-theme-primary";
  const inactiveClass =
    "text-theme-muted hover:bg-theme-background hover:text-theme-text";

  return (
    <nav className="navbar-theme sticky top-0 z-30">
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
        <span className="text-theme-text font-semibold text-lg tracking-tight flex items-center gap-2">
          <img
            src="/icon.svg"
            alt="Gold stack"
            className="w-7 h-7 align-middle"
            style={{ marginBottom: "2px" }}
          />
          <span
            style={{
              lineHeight: "1",
              display: "inline-block",
              verticalAlign: "middle",
            }}
          >
            Spending Tracker
          </span>
        </span>

        {/* Desktop */}
        <div className="hidden sm:flex items-center gap-0.5">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-theme-small text-sm font-medium transition-colors ${isActive ? activeClass : inactiveClass}`
              }
            >
              {label}
            </NavLink>
          ))}
          {syncDot && <span className="ml-2">{syncDot}</span>}
          <button
            onClick={onAddExpense}
            className="ml-3 bg-theme-primary text-white font-semibold text-lg w-8 h-8 rounded-theme-medium shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center"
            aria-label="Add expense"
          >
            +
          </button>
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="ml-2 text-theme-muted hover:text-theme-danger text-sm px-2 py-1 rounded-theme-small transition-colors"
              title={userEmail}
            >
              Sign out
            </button>
          )}
        </div>

        {/* Mobile */}
        <div className="flex sm:hidden items-center gap-2">
          {syncDot}
          <button
            onClick={onAddExpense}
            className="bg-theme-primary text-white font-semibold text-lg w-8 h-8 rounded-theme-medium shadow-sm flex items-center justify-center"
            aria-label="Add expense"
          >
            +
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            className="text-theme-text p-1"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden bg-theme-surface/95 backdrop-blur-md border-b border-theme-border px-4 pb-3 flex flex-col gap-0.5">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `px-3 py-2 rounded-theme-small text-sm font-medium transition-colors ${isActive ? "bg-theme-primary/10 text-theme-primary" : "text-theme-muted hover:bg-theme-background hover:text-theme-text"}`
              }
            >
              {label}
            </NavLink>
          ))}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="text-left px-3 py-2 text-theme-muted hover:text-theme-danger text-sm font-medium"
            >
              Sign out {userEmail ? `(${userEmail})` : ""}
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
