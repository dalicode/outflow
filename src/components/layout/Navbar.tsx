import { useState, type ReactNode, type MouseEventHandler } from "react";
import { NavLink, useLocation } from "react-router-dom";


interface NavIconProps {
  active: boolean;
}

const DashboardIcon = ({ active }: NavIconProps) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none">
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

const SummaryIcon = ({ active }: NavIconProps) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none">
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

const AnalyticsIcon = ({ active }: NavIconProps) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none">
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

const SettingsIcon = ({ active }: NavIconProps) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none">
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

const PlusIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SignOutIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-5 h-5 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const links = [
  { to: "/", label: "Dashboard", icon: DashboardIcon },
  { to: "/summary", label: "Summary", icon: SummaryIcon },
  { to: "/analytics", label: "Analytics", icon: AnalyticsIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

interface NavbarProps {
  onAddExpense: MouseEventHandler<HTMLButtonElement>;
  syncDot?: ReactNode;
  onSignOut?: MouseEventHandler<HTMLButtonElement>;
  userEmail?: string;
}

export default function Navbar({
  onAddExpense,
  syncDot,
  onSignOut,
  userEmail,
}: NavbarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const location = useLocation();

  const sidebarWidth = collapsed ? "w-14" : "w-44";

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden sm:flex flex-col h-screen sticky top-0 bg-theme-surface border-r border-theme-border z-40 transition-all duration-200 ease-in-out ${sidebarWidth}`}
      >
        {/* Brand + Collapse toggle */}
        <div className="px-3 pt-4 pb-2 flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <img src="/icon.svg" alt="" className="w-7 h-7 shrink-0" />
              <span className="text-lg font-bold text-theme-primary tracking-tight">
                Outflow
              </span>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center w-full">
              <img src="/icon.svg" alt="" className="w-9 h-9 shrink-0" />
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-md text-theme-muted hover:text-theme-text hover:bg-theme-background transition-colors shrink-0"
              aria-label="Collapse sidebar"
              title="Collapse"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
        </div>

        {/* Expand toggle (visible only when collapsed) */}
        {collapsed && (
          <div className="flex justify-center pb-2">
            <button
              onClick={() => setCollapsed(false)}
              className="p-1.5 rounded-md text-theme-muted hover:text-theme-text hover:bg-theme-background transition-colors"
              aria-label="Expand sidebar"
              title="Expand"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}

        {/* Nav Links */}
        <nav className="flex-1 px-2 space-y-1">
          {links.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            return (
              <NavLink
                key={to}
                to={to}
                end
                className={`
                  flex items-center rounded-lg transition-colors duration-150
                  ${collapsed ? "justify-center py-2.5 px-2" : "gap-3 py-2.5 px-3 mx-2"}
                  ${
                    isActive
                      ? "bg-theme-primary/5 text-theme-primary font-semibold"
                      : "text-theme-muted hover:text-theme-text hover:bg-theme-background"
                  }
                `}
              >
                <Icon active={isActive} />
                {!collapsed && (
                  <span className="text-sm font-medium truncate">{label}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Actions Footer */}
        <div className="pb-4 space-y-1">
          {/* Add expense */}
          <button
            onClick={onAddExpense}
            className={`
                  w-full flex items-center rounded-lg text-theme-primary transition-all duration-150 hover:bg-theme-primary/5 active:scale-95
                  ${collapsed ? "justify-center py-2.5 px-2" : "gap-3 py-2.5 px-3 mx-2"}
                `}
            aria-label="Add expense"
          >
            <PlusIcon />
            {!collapsed && (
              <span className="text-sm font-medium truncate">Add</span>
            )}
          </button>

          {syncDot && (
            <div
              className={`${collapsed ? "flex justify-center py-2" : "px-3 py-2 mx-2"}`}
            >
              {syncDot}
            </div>
          )}

          {onSignOut && (
            <button
              onClick={onSignOut}
              className={`
                w-full flex items-center rounded-lg transition-colors duration-150 text-theme-muted hover:text-theme-danger hover:bg-theme-danger/5
                ${collapsed ? "justify-center py-2.5 px-2 mx-1" : "gap-3 py-2.5 px-3 mx-2"}
              `}
              title={userEmail}
            >
              <SignOutIcon />
              {!collapsed && (
                <div className="text-left overflow-hidden">
                  <span className="text-sm font-medium block truncate">
                    Sign out
                  </span>
                  {userEmail && (
                    <span className="text-[0.6875rem] text-theme-muted block truncate">
                      {userEmail}
                    </span>
                  )}
                </div>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-4 left-4 right-4 z-30">
        <div className="bg-theme-surface/95 backdrop-blur-md rounded-2xl shadow-lg border border-theme-border flex items-center h-14 px-2">
          {links.slice(0, 2).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  isActive ? "text-theme-primary" : "text-theme-muted"
                }`
              }
            >
              <Icon active={location.pathname === to} />
              <span className="text-[10px] mt-0.5 font-medium">{label}</span>
            </NavLink>
          ))}

          <button
            onClick={onAddExpense}
            className="-mt-4 !mx-0 w-14 h-14 rounded-full bg-theme-primary text-white shadow-lg shadow-theme-primary/30 flex flex-col items-center justify-center transition-transform active:scale-90 hover:scale-105 z-10 shrink-0"
            aria-label="Add expense"
          >
            <PlusIcon />
          </button>

          {links.slice(2).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  isActive ? "text-theme-primary" : "text-theme-muted"
                }`
              }
            >
              <Icon active={location.pathname === to} />
              <span className="text-[10px] mt-0.5 font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
