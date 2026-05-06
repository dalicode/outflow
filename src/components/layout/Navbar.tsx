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
import { useHaptics } from "../../hooks/useHaptics";

interface NavIconProps {
  active: boolean;
}

const DashboardIcon = ({ active }: NavIconProps) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none">
    {/* Receipt / transactions icon */}
    <rect
      x="4"
      y="2"
      width="16"
      height="20"
      rx="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.15"
    />
    <line
      x1="8"
      y1="7"
      x2="16"
      y2="7"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <line
      x1="8"
      y1="11"
      x2="16"
      y2="11"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <line
      x1="8"
      y1="15"
      x2="12"
      y2="15"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <circle
      cx="17"
      cy="17"
      r="4"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
    />
    <path
      d="M15.5 17h3M17 15.5v3"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const SummaryIcon = ({ active }: NavIconProps) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none">
    {/* Wallet icon */}
    <rect
      x="2"
      y="6"
      width="20"
      height="14"
      rx="2"
      fill={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      opacity="0.15"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="1.75"
    />
    <path
      d="M2 10h20"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M6 4l4-2 4 2"
      stroke={active ? "var(--theme-primary)" : "var(--theme-muted)"}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="15"
      y="13"
      width="5"
      height="4"
      rx="1"
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
  const mobileDragThreshold = 8;
  const mobileCollapsedHeight = 76;
  const mobilePrimaryHeight = 88;
  const mobileExpandedHeight = 156;
  const mobileNavOverscan = 48;
  const stageHeights = [
    mobileCollapsedHeight,
    mobilePrimaryHeight,
    mobileExpandedHeight,
  ] as const;
  const [collapsed, setCollapsed] = useState(true);
  const [mobileStage, setMobileStage] = useState<0 | 1 | 2>(1);
  const [mobileNavHeight, setMobileNavHeight] = useState<number>(
    stageHeights[1],
  );
  const [mobileAutoHidden, setMobileAutoHidden] = useState(false);
  const [isMobileDragging, setIsMobileDragging] = useState(false);
  const mobileDragStartYRef = useRef<number | null>(null);
  const startHeightRef = useRef<number>(stageHeights[1]);
  const expandedSinceLastScrollRef = useRef(false);
  const mobileDragDistanceRef = useRef(0);
  const location = useLocation();
  const isOnDashboard = location.pathname === ROUTES.DASHBOARD;
  const justNavigatedRef = useRef(false);
  const haptics = useHaptics();

  const prevLocationKeyRef = useRef(location.key);

  // Reset auto-hide state on every navigation (including back/forward) so
  // pages that don't scroll always show the navbar
  useEffect(() => {
    if (prevLocationKeyRef.current === location.key) return;
    prevLocationKeyRef.current = location.key;
    justNavigatedRef.current = true;
    expandedSinceLastScrollRef.current = false;
    setMobileAutoHidden(false);
    setMobileStage(1);
    setMobileNavHeight(stageHeights[1]);
  }, [location.pathname, location.key]);

  const handleNavLinkClick = useCallback(
    (pageKey: NavItemConfig["pageKey"], e: React.MouseEvent) => {
      haptics.selection();
      if (pageKey !== "dashboard" || !isOnDashboard) return;
      e.preventDefault();
      onCycleDashboardView?.();
    },
    [haptics, isOnDashboard, onCycleDashboardView],
  );

  const sidebarWidth = collapsed ? "w-14" : "w-44";
  const mobilePrimaryItems = NAV_ITEMS.filter(({ pageKey }) =>
    ["summary", "dashboard"].includes(pageKey),
  );
  const mobileSecondaryItems = NAV_ITEMS.filter(({ pageKey }) =>
    ["analytics", "payees", "settings"].includes(pageKey),
  );
  const shouldAutoHideAfterScroll = !isScrolling && scrollDirection === "down";
  const isMobileNavBlocked = hidden;
  const isMobileNavCollapsed = mobileAutoHidden;
  const mobileExpansionProgress =
    (mobileNavHeight - mobileCollapsedHeight) /
    (mobileExpandedHeight - mobileCollapsedHeight);
  const mobileNavStyle = {
    "--mobile-nav-height": `${mobileNavHeight}px`,
    "--mobile-nav-wrapper-height": `${mobileNavHeight + mobileNavOverscan}px`,
    "--mobile-nav-overscan": `${mobileNavOverscan}px`,
    "--mobile-nav-collapsed-height": `${mobileCollapsedHeight}px`,
    "--mobile-nav-progress": `${mobileExpansionProgress}`,
  } as CSSProperties;
  const renderMobileNavLink = ({
    pageKey,
    basePath,
    label,
    icon: Icon,
  }: NavItemConfig) => {
    const isCurrent = location.pathname === basePath;

    return (
      <NavLink
        key={pageKey}
        to={basePath}
        end
        aria-label={label}
        data-testid={`nav-${pageKey}`}
        onClick={(e) => handleNavLinkClick(pageKey, e)}
        className={({ isActive }) =>
          cn(
            "mobile-nav-link nav-item-hover",
            isActive ? "text-theme-primary" : "text-theme-muted",
          )
        }
      >
        <Icon active={isCurrent} />
        <span className="mobile-nav-label">{label}</span>
      </NavLink>
    );
  };
  const handleMobileHandleClick = () => {
    if (isMobileNavBlocked) return;
    if (mobileStage !== 2 || isMobileNavCollapsed) {
      return;
    }

    setMobileAutoHidden(false);
    setMobileStage(1);
    setMobileNavHeight(stageHeights[1]);
    expandedSinceLastScrollRef.current = false;
  };
  const handleMobileContainerPointerDown: PointerEventHandler<
    HTMLDivElement
  > = (event) => {
    if (isMobileNavBlocked) return;
    mobileDragStartYRef.current = event.clientY;
    startHeightRef.current = isMobileNavCollapsed
      ? stageHeights[0]
      : mobileNavHeight;
    mobileDragDistanceRef.current = 0;
  };
  const handleMobileContainerPointerMove: PointerEventHandler<
    HTMLDivElement
  > = (event) => {
    if (mobileDragStartYRef.current === null) return;
    const rawDelta = mobileDragStartYRef.current - event.clientY;
    mobileDragDistanceRef.current = Math.abs(rawDelta);
    if (
      !isMobileDragging &&
      mobileDragDistanceRef.current <= mobileDragThreshold
    ) {
      return;
    }
    if (!isMobileDragging) {
      setIsMobileDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (rawDelta > 0 && isMobileNavCollapsed) {
      setMobileAutoHidden(false);
    }
    const newHeight = Math.max(
      mobileCollapsedHeight,
      Math.min(mobileExpandedHeight, startHeightRef.current + rawDelta),
    );
    setMobileNavHeight(newHeight);
  };
  const handleMobileContainerPointerUp: PointerEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (mobileDragStartYRef.current === null) return;
    if (!isMobileDragging) {
      mobileDragStartYRef.current = null;
      mobileDragDistanceRef.current = 0;
      return;
    }

    const nearestStage = ([0, 1, 2] as const).reduce((prev, curr) =>
      Math.abs(stageHeights[curr] - mobileNavHeight) <
      Math.abs(stageHeights[prev] - mobileNavHeight)
        ? curr
        : prev,
    );

    setMobileStage(nearestStage);
    setMobileNavHeight(stageHeights[nearestStage]);
    setMobileAutoHidden(nearestStage === 0);
    expandedSinceLastScrollRef.current = nearestStage > 0;

    mobileDragStartYRef.current = null;
    mobileDragDistanceRef.current = 0;
    setIsMobileDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };
  const handleMobileContainerPointerCancel: PointerEventHandler<
    HTMLDivElement
  > = (event) => {
    mobileDragStartYRef.current = null;
    setMobileNavHeight(stageHeights[mobileStage]);
    mobileDragDistanceRef.current = 0;
    setIsMobileDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  useEffect(() => {
    if (justNavigatedRef.current) {
      justNavigatedRef.current = false;
      return;
    }

    if (scrollDirection === "up") {
      if (!isScrolling && !hidden) {
        setMobileAutoHidden(false);
        setMobileStage(1);
        setMobileNavHeight(stageHeights[1]);
      }
      expandedSinceLastScrollRef.current = false;
      return;
    }

    // A new scroll event arrived — clear the expansion guard
    if (isScrolling) {
      expandedSinceLastScrollRef.current = false;
    }

    // Don't auto-hide while a drag is in progress
    if (mobileDragStartYRef.current !== null) return;

    // Don't auto-hide if the nav was just expanded and no new scroll has
    // happened yet — the stale scrollDirection="down" would immediately
    // re-collapse it
    if (expandedSinceLastScrollRef.current) return;

    if (isScrolling) return;
    if (scrollDirection !== "down" && !hidden) return;

    setMobileAutoHidden(shouldAutoHideAfterScroll);
    setMobileStage(0);
    setMobileNavHeight(stageHeights[0]);
  }, [hidden, isScrolling, scrollDirection, shouldAutoHideAfterScroll]);

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
              onClick={() => {
                haptics.selection();
                setCollapsed(true);
              }}
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
              onClick={() => {
                haptics.selection();
                setCollapsed(false);
              }}
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
            return (
              <NavLink
                key={pageKey}
                to={basePath}
                end
                data-testid={`nav-${pageKey}`}
                onClick={(e) => handleNavLinkClick(pageKey, e)}
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
            onClick={(e) => {
              haptics.selection();
              onAddExpense(e);
            }}
            data-testid="btn-add-expense"
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
              onClick={(e) => {
                haptics.selection();
                onSignOut(e);
              }}
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
        className="fixed inset-x-0 bottom-[calc(-1*var(--mobile-nav-overscan))] z-30 h-[var(--mobile-nav-wrapper-height)] pointer-events-none sm:hidden"
        style={mobileNavStyle}
      >
        <nav
          className={cn(
            "absolute inset-x-0 top-0",
            isMobileNavBlocked ? "pointer-events-none" : "pointer-events-auto",
            "mobile-nav-bounce",
            isMobileNavCollapsed &&
              "translate-y-[calc(100%-18px)] overflow-hidden",
          )}
        >
          <div
            className="mobile-nav-container"
            data-stage={mobileStage}
            data-dragging={isMobileDragging ? "true" : "false"}
            onPointerDown={handleMobileContainerPointerDown}
            onPointerMove={handleMobileContainerPointerMove}
            onPointerUp={handleMobileContainerPointerUp}
            onPointerCancel={handleMobileContainerPointerCancel}
          >
            <button
              type="button"
              onClick={handleMobileHandleClick}
              className="mobile-nav-handle"
              aria-label={
                mobileStage === 0
                  ? "Expand navigation"
                  : mobileStage === 1
                    ? "Expand more"
                    : "Collapse navigation"
              }
            >
              <span />
            </button>

            <div className="mobile-nav-row mobile-nav-row-primary">
              {renderMobileNavLink(mobilePrimaryItems[0])}
              <button
                onClick={(e) => {
                  haptics.selection();
                  onAddExpense(e);
                }}
                data-testid="btn-add-expense"
                className={cn(
                  "mobile-add-btn",
                  isMobileNavCollapsed && "opacity-0",
                )}
                aria-label="Add expense"
              >
                <PlusIcon />
              </button>
              {renderMobileNavLink(mobilePrimaryItems[1])}
            </div>

            <div className="mobile-nav-row mobile-nav-row-secondary">
              {mobileSecondaryItems.map(renderMobileNavLink)}
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}
