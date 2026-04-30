import { useState, useEffect, useCallback, useRef } from "react";

export interface ContextMenuState {
  x: number;
  y: number;
  expenseId: number;
}

const MENU_WIDTH = 160;
const MENU_HEIGHT = 80;

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const open = useCallback((e: React.MouseEvent, expenseId: number) => {
    e.preventDefault();
    e.stopPropagation();

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = e.clientX;
    let y = e.clientY;

    if (x + MENU_WIDTH > vw) x = vw - MENU_WIDTH - 8;
    if (y + MENU_HEIGHT > vh) y = vh - MENU_HEIGHT - 8;

    setMenu({ x, y, expenseId });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    const handleScroll = () => close();
    const handleResize = () => close();

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [menu, close]);

  return { menu, open, close, menuRef };
}
