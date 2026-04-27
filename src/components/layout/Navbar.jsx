import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

// RuneScape-inspired pixel art icons
const DashboardIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
    <path
      d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
    />
    <path
      d="M9 22V12h6v10"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const SummaryIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
    {/* Pixelated scroll icon */}
    <rect
      x="4"
      y="2"
      width="16"
      height="20"
      rx="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.2"
    />
    <rect
      x="6"
      y="4"
      width="12"
      height="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
    />
    <rect
      x="6"
      y="8"
      width="10"
      height="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.6"
    />
    <rect
      x="6"
      y="12"
      width="8"
      height="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.6"
    />
    <rect
      x="6"
      y="16"
      width="6"
      height="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.6"
    />
  </svg>
);

const AnalyticsIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
    {/* Pixelated bar chart */}
    <rect
      x="3"
      y="14"
      width="4"
      height="8"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.8"
    />
    <rect
      x="9"
      y="10"
      width="4"
      height="12"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.6"
    />
    <rect
      x="15"
      y="6"
      width="4"
      height="16"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.4"
    />
    <rect
      x="3"
      y="4"
      width="16"
      height="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
    />
  </svg>
);

const SettingsIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
    {/* Pixelated gear/cog */}
    <circle
      cx="12"
      cy="12"
      r="8"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.3"
    />
    <circle
      cx="12"
      cy="12"
      r="5"
      fill="none"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="2"
    />
    <rect
      x="11"
      y="2"
      width="2"
      height="4"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      rx="1"
    />
    <rect
      x="11"
      y="18"
      width="2"
      height="4"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      rx="1"
    />
    <rect
      x="2"
      y="11"
      width="4"
      height="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      rx="1"
    />
    <rect
      x="18"
      y="11"
      width="4"
      height="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      rx="1"
    />
    <rect
      x="5"
      y="5"
      width="2"
      height="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
    />
    <rect
      x="17"
      y="5"
      width="2"
      height="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
    />
    <rect
      x="5"
      y="17"
      width="2"
      height="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
    />
    <rect
      x="17"
      y="17"
      width="2"
      height="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
    />
    <circle
      cx="12"
      cy="12"
      r="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
    />
  </svg>
);

const AddIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
    {/* Gold coin / gem + icon */}
    <circle cx="12" cy="12" r="10" fill="var(--theme-primary)" />
    <circle cx="12" cy="12" r="8" fill="#ffd700" />
    <circle cx="12" cy="12" r="6" fill="#ffec8b" />
    <text
      x="12"
      y="16"
      textAnchor="middle"
      fill="var(--theme-primary)"
      fontSize="14"
      fontWeight="bold"
    >
      +
    </text>
  </svg>
);

const links = [
  { to: "/", label: "Dashboard", icon: DashboardIcon },
  { to: "/summary", label: "Summary", icon: SummaryIcon },
  { to: "/analytics", label: "Analytics", icon: AnalyticsIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Navbar({
  onAddExpense,
  syncDot,
  onSignOut,
  userEmail,
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const activeClass = "bg-theme-primary/10 text-theme-primary";
  const inactiveClass =
    "text-theme-muted hover:bg-theme-background hover:text-theme-text";

  // Determine if we're on mobile (any route matches for bottom nav)
  const isMobile = () => {
    // Check if screen is small - we use CSS to hide/show, but for logic:
    return typeof window !== "undefined" && window.innerWidth < 640;
  };

  return (
    <>
      {/* Desktop Navbar - Top */}
      <nav className="navbar-theme sticky top-0 z-30 hidden sm:block">
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
              className="text-theme-primary"
            >
              Spending Tracker
            </span>
          </span>

          {/* Desktop Links */}
          <div className="flex items-center gap-0.5">
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
        </div>

        {/* Mobile dropdown (when hamburger clicked) */}
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

      {/* Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 navbar-theme">
        <div className="flex items-center justify-between h-16 px-2 relative">
          {/* Dashboard */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-2 transition-transform active:scale-95 ${isActive ? "text-theme-primary" : "text-theme-muted"}`
            }
            aria-current={location.pathname === "/" ? "page" : undefined}
          >
            <DashboardIcon active={location.pathname === "/"} />
            <span className="text-[10px] mt-0.5">Dashboard</span>
          </NavLink>

          {/* Summary */}
          <NavLink
            to="/summary"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-2 transition-transform active:scale-95 ${isActive ? "text-theme-primary" : "text-theme-muted"}`
            }
            aria-current={location.pathname === "/summary" ? "page" : undefined}
          >
            <SummaryIcon active={location.pathname === "/summary"} />
            <span className="text-[10px] mt-0.5">Summary</span>
          </NavLink>

          {/* Spacer for centering */}
          <div className="w-12" />

          {/* Analytics */}
          <NavLink
            to="/analytics"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-2 transition-transform active:scale-95 ${isActive ? "text-theme-primary" : "text-theme-muted"}`
            }
            aria-current={
              location.pathname === "/analytics" ? "page" : undefined
            }
          >
            <AnalyticsIcon active={location.pathname === "/analytics"} />
            <span className="text-[10px] mt-0.5">Analytics</span>
          </NavLink>

          {/* Settings */}
          <NavLink
            to="/settings"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-2 transition-transform active:scale-95 ${isActive ? "text-theme-primary" : "text-theme-muted"}`
            }
            aria-current={
              location.pathname === "/settings" ? "page" : undefined
            }
          >
            <SettingsIcon active={location.pathname === "/settings"} />
            <span className="text-[10px] mt-0.5">Settings</span>
          </NavLink>

          {/* Floating Add Button - Centered */}
          <button
            onClick={onAddExpense}
            className="absolute left-1/2 -translate-x-1/2 -top-3 w-14 h-14 rounded-full bg-theme-primary text-white text-2xl font-medium shadow-lg shadow-theme-primary/30 flex items-center justify-center transition-transform active:scale-90 hover:scale-105"
            aria-label="Add expense"
            style={{ bottom: "1px" }}
          >
            +
          </button>
        </div>
      </nav>
    </>
  );
}
