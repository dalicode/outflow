import type { ReactNode, MouseEventHandler } from "react";
import DesktopSidebar from "./DesktopSidebar";
import MobileBottomNav from "./MobileBottomNav";

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

export default function Navbar(props: NavbarProps) {
  return (
    <>
      <DesktopSidebar
        onAddExpense={props.onAddExpense}
        syncDot={props.syncDot}
        onSignOut={props.onSignOut}
        userEmail={props.userEmail}
        onCycleDashboardView={props.onCycleDashboardView}
      />
      <MobileBottomNav
        onAddExpense={props.onAddExpense}
        scrollDirection={props.scrollDirection}
        isScrolling={props.isScrolling}
        hidden={props.hidden}
        onCycleDashboardView={props.onCycleDashboardView}
      />
    </>
  );
}

export type { NavbarProps };
