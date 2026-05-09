import { ROUTES } from "../../constants/routes";

interface NavIconProps {
  active: boolean;
}

const DashboardIcon = ({ active }: NavIconProps) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" fill="none">
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

export type { NavIconProps, NavItemConfig };
export {
  DashboardIcon,
  SummaryIcon,
  AnalyticsIcon,
  SettingsIcon,
  PlusIcon,
  SignOutIcon,
  PayeesIcon,
  NAV_ITEMS,
};
