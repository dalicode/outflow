import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type MouseEventHandler,
  type PointerEventHandler,
  type CSSProperties,
} from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../../utils/cn";
import { ROUTES } from "../../constants/routes";

interface NavIconProps {
  active: boolean;
}

const DashboardIcon = ({ active }: NavIconProps) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none">
    {/* Receipt / transactions icon */}
    <rect
      x="4" y="2" width="16" height="20" rx="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.15"
    />
    <line x1="8" y1="7" x2="16" y2="7"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="1.75" strokeLinecap="round"
    />
    <line x1="8" y1="11" x2="16" y2="11"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="1.75" strokeLinecap="round"
    />
    <line x1="8" y1="15" x2="12" y2="15"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="1.75" strokeLinecap="round"
    />
    <circle
      cx="17" cy="17" r="4"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
    />
    <path
      d="M15.5 17h3M17 15.5v3"
      stroke="white"
      strokeWidth="1.5" strokeLinecap="round"
    />
  </svg>
);

const SummaryIcon = ({ active }: NavIconProps) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none">
    {/* Wallet icon */}
    <rect
      x="2" y="6" width="20" height="14" rx="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.15"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="1.75"
    />
    <path
      d="M2 10h20"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="1.75" strokeLinecap="round"
    />
    <path
      d="M6 4l4-2 4 2"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    />
    <rect
      x="15" y="13" width="5" height="4" rx="1"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
    />
  </svg>
);

const AnalyticsIcon = ({ active }: NavIconProps) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none">
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
  <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none">
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
    className="w-6 h-6 shrink-0"
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

const PayeesIcon = ({ active }: NavIconProps) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none">
    <circle
      cx="9"
      cy="8"
      r="3"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
    />
    <path
      d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle
      cx="17"
      cy="8"
      r="2.5"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.6"
    />
    <path
      d="M14 20c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.6"
    />
  </svg>
);

interface NavItemConfig {
  pageKey: "dashboard" | "summary" | "analytics" | "payees" | "settings";
  basePath: string;
  label: string;
  icon: React.ComponentType<NavIconProps>;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    pageKey: "summary",
    basePath: ROUTES.SUMMARY,
    label: "Budget",
    icon: SummaryIcon,
  },
  {
    pageKey: "dashboard",
    basePath: ROUTES.DASHBOARD,
    label: "Dashboard",
    icon: DashboardIcon,
  },
  {
    pageKey: "analytics",
    basePath: ROUTES.ANALYTICS,
    label: "Analytics",
    icon: AnalyticsIcon,
  },
  {
    pageKey: "payees",
    basePath: ROUTES.PAYEES,
    label: "Payees",
    icon: PayeesIcon,
  },
  {
    pageKey: "settings",
    basePath: ROUTES.SETTINGS,
    label: "Settings",
    icon: SettingsIcon,
  },
];

interface NavbarProps {
  onAddExpense: MouseEventHandler<HTMLButtonElement>;
  syncDot?: ReactNode;
  onSignOut?: MouseEventHandler<HTMLButtonElement>;
  userEmail?: string;
  scrollDirection?: "up" | "down" | null;
  isScrolling?: boolean;
  hidden?: boolean;
  onCycleDashboardView?: () => void;
}

export default function Navbar({
  onAddExpense,
  syncDot,
  onSignOut,
  userEmail,
  scrollDirection,
  isScrolling = false,
  hidden = false,
  onCycleDashboardView,
}: NavbarProps) {
  const mobileCollapsedHeight = 72;
  const mobileExpandedHeight = 144;
  const mobileDragRange = mobileExpandedHeight - mobileCollapsedHeight;
  const [collapsed, setCollapsed] = useState(true);
  const [peekExpanded, setPeekExpanded] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [mobileDragOffset, setMobileDragOffset] = useState(0);
  const [mobileAutoHidden, setMobileAutoHidden] = useState(false);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileDragStartYRef = useRef<number | null>(null);
  const mobileDragMovedRef = useRef(false);
  const location = useLocation();
  const isOnDashboard = location.pathname === ROUTES.DASHBOARD;

  const handleDashboardClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isOnDashboard) return; // let NavLink navigate normally
      e.preventDefault();
      onCycleDashboardView?.();
    },
    [isOnDashboard, onCycleDashboardView],
  );

  useEffect(() => {
    if (!peekExpanded) return;
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => {
      setPeekExpanded(false);
    }, 3000);
    return () => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    };
  }, [peekExpanded]);

  const sidebarWidth = collapsed ? "w-14" : "w-44";
  const mobilePrimaryItems = NAV_ITEMS.filter(({ pageKey }) =>
    ["summary", "dashboard"].includes(pageKey),
  );
  const mobileSecondaryItems = NAV_ITEMS.filter(({ pageKey }) =>
    ["analytics", "payees", "settings"].includes(pageKey),
  );
  const mobileBaseHeight = mobileExpanded
    ? mobileExpandedHeight
    : mobileCollapsedHeight;
  const mobileVisibleHeight = Math.max(
    mobileCollapsedHeight,
    Math.min(mobileExpandedHeight, mobileBaseHeight + mobileDragOffset),
  );
  const mobileExpansionProgress =
    (mobileVisibleHeight - mobileCollapsedHeight) / mobileDragRange;
  const mobileNavStyle = {
    "--mobile-nav-height": `${mobileVisibleHeight}px`,
    "--mobile-nav-progress": `${mobileExpansionProgress}`,
  } as CSSProperties;
  const shouldAutoHideAfterScroll = !isScrolling && scrollDirection === "down";
  const isMobileNavHidden = !peekExpanded && (hidden || mobileAutoHidden);
  const renderMobileNavLink = ({
    pageKey,
    basePath,
    label,
    icon: Icon,
  }: NavItemConfig) => {
    const isCurrent = location.pathname === basePath;
    const isDashboard = pageKey === "dashboard";

    return (
      <NavLink
        key={pageKey}
        to={basePath}
        end
        aria-label={label}
        onClick={isDashboard ? handleDashboardClick : undefined}
        className={({ isActive }) =>
          cn(
            "mobile-nav-link nav-item-hover",
            isActive ? "text-theme-primary" : "text-theme-muted",
            isMobileNavHidden && "opacity-0",
          )
        }
      >
        <Icon active={isCurrent} />
        <span className="mobile-nav-label">{label}</span>
      </NavLink>
    );
  };
  const handleMobileHandleClick = () => {
    if (isMobileNavHidden) return;
    if (mobileDragMovedRef.current) {
      mobileDragMovedRef.current = false;
      return;
    }

    setMobileAutoHidden(false);
    if (mobileExpanded) {
      setMobileExpanded(false);
      setPeekExpanded(true);
    } else {
      setPeekExpanded((expanded) => !expanded);
    }
    setMobileDragOffset(0);
  };
  const handleMobileHandlePointerDown: PointerEventHandler<
    HTMLButtonElement
  > = (event) => {
    if (isMobileNavHidden) return;
    mobileDragStartYRef.current = event.clientY;
    mobileDragMovedRef.current = false;
    setMobileAutoHidden(false);
    setPeekExpanded(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handleMobileHandlePointerMove: PointerEventHandler<
    HTMLButtonElement
  > = (event) => {
    if (mobileDragStartYRef.current === null) return;
    const deltaY = mobileDragStartYRef.current - event.clientY;
    if (Math.abs(deltaY) > 8) {
      mobileDragMovedRef.current = true;
    }
    setMobileDragOffset(deltaY);
  };
  const handleMobileHandlePointerUp: PointerEventHandler<HTMLButtonElement> = (
    event,
  ) => {
    if (mobileDragStartYRef.current === null) return;

    const dragDistance = mobileDragStartYRef.current - event.clientY;
    if (dragDistance > 18 || mobileExpansionProgress > 0.55) {
      setMobileExpanded(true);
      setPeekExpanded(true);
    } else if (dragDistance < -18 || mobileExpansionProgress < 0.45) {
      setMobileExpanded(false);
      setPeekExpanded(true);
    }

    setMobileDragOffset(0);
    mobileDragMovedRef.current = false;
    mobileDragStartYRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  const handleMobileHandlePointerCancel: PointerEventHandler<
    HTMLButtonElement
  > = (event) => {
    mobileDragStartYRef.current = null;
    mobileDragMovedRef.current = false;
    setMobileDragOffset(0);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  useEffect(() => {
    if (scrollDirection === "up") {
      if (!isScrolling && !hidden) {
        setMobileAutoHidden(false);
      }
      return;
    }

    if (peekExpanded && !mobileExpanded && !mobileAutoHidden) return;
    if (isScrolling) return;
    if (mobileDragStartYRef.current !== null) return;
    if (scrollDirection !== "down" && !hidden) return;

    setMobileAutoHidden(shouldAutoHideAfterScroll);
    setMobileExpanded(false);
    setMobileDragOffset(0);
    setPeekExpanded(false);
  }, [
    hidden,
    isScrolling,
    mobileAutoHidden,
    mobileExpanded,
    peekExpanded,
    scrollDirection,
    shouldAutoHideAfterScroll,
  ]);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn("navbar-desktop group", sidebarWidth)}>
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
              className="navbar-toggle-btn nav-item-hover opacity-0 group-hover:opacity-100 transition-opacity duration-200"
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
              className="navbar-toggle-btn nav-item-hover opacity-0 group-hover:opacity-100 transition-opacity duration-200"
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
          {NAV_ITEMS.map(({ pageKey, basePath, label, icon: Icon }) => {
            const isActive = location.pathname === basePath;
            const isDashboard = pageKey === "dashboard";
            return (
              <NavLink
                key={pageKey}
                to={basePath}
                end
                onClick={isDashboard ? handleDashboardClick : undefined}
                className={cn(
                  "flex items-center rounded-theme-medium nav-item-hover",
                  collapsed
                    ? "justify-center py-2.5 px-2"
                    : "gap-3 py-2.5 px-3 mx-2",
                  isActive
                    ? "bg-theme-primary-subtle text-theme-primary font-semibold nav-item-indicator"
                    : "text-theme-muted hover:text-theme-text hover:bg-theme-background",
                )}
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
            className={cn(
              "w-full flex items-center rounded-theme-medium text-theme-primary nav-item-hover hover:bg-theme-primary-subtle active:scale-95",
              collapsed
                ? "justify-center py-2.5 px-2"
                : "gap-3 py-2.5 px-3 mx-2",
            )}
            aria-label="Add expense"
          >
            <PlusIcon />
            {!collapsed && (
              <span className="text-sm font-medium truncate">Add</span>
            )}
          </button>

          {syncDot && (
            <div
              className={cn(
                collapsed ? "flex justify-center py-2" : "px-3 py-2 mx-2",
              )}
            >
              {syncDot}
            </div>
          )}

          {onSignOut && (
            <button
              onClick={onSignOut}
              className={cn(
                "w-full flex items-center rounded-theme-medium nav-item-hover text-theme-muted hover:text-theme-danger hover:bg-theme-danger-subtle",
                collapsed
                  ? "justify-center py-2.5 px-2 mx-1"
                  : "gap-3 py-2.5 px-3 mx-2",
              )}
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
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 pointer-events-none sm:hidden",
          mobileExpanded ? "h-48" : "h-32",
        )}
      >
        {/* Static background coverage layer — only as tall as the nav */}
        <div className="absolute inset-x-0 bottom-0 h-[calc(0.5rem+env(safe-area-inset-bottom))] bg-theme-background" />

        {/* Animated navbar UI */}
        <nav
          className={cn(
            "absolute inset-x-0 bottom-0",
            isMobileNavHidden ? "pointer-events-none" : "pointer-events-auto",
            "mobile-nav-bounce",
            isMobileNavHidden &&
              "translate-y-[calc(100%-18px)] overflow-hidden",
          )}
        >
          <div
            className="mobile-nav-container"
            data-expanded={mobileExpanded ? "true" : "false"}
            data-dragging={
              mobileDragStartYRef.current !== null ? "true" : "false"
            }
            style={mobileNavStyle}
          >
            <button
              type="button"
              onClick={handleMobileHandleClick}
              onPointerDown={handleMobileHandlePointerDown}
              onPointerMove={handleMobileHandlePointerMove}
              onPointerUp={handleMobileHandlePointerUp}
              onPointerCancel={handleMobileHandlePointerCancel}
              className="mobile-nav-handle"
              aria-label={
                mobileExpanded ? "Collapse navigation" : "Expand navigation"
              }
              aria-expanded={mobileExpanded}
            >
              <span />
            </button>

            <div className="mobile-nav-row mobile-nav-row-primary">
              {renderMobileNavLink(mobilePrimaryItems[0])}
              <button
                onClick={onAddExpense}
                className={cn(
                  "mobile-add-btn",
                  isMobileNavHidden && "opacity-0",
                )}
                aria-label="Add expense"
              >
                <PlusIcon />
              </button>
              {renderMobileNavLink(mobilePrimaryItems[1])}
            </div>

            {mobileExpansionProgress > 0 && (
              <div className="mobile-nav-row mobile-nav-row-secondary">
                {mobileSecondaryItems.map(renderMobileNavLink)}
              </div>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
