import { useState, useRef, useEffect } from "react";
import { cn } from "../../utils/cn";

interface MobileSelectionBannerProps {
  count: number;
  onEdit: () => void;
  onDelete: () => void;
  onDeselectAll: () => void;
}

export default function MobileSelectionBanner({
  count,
  onEdit,
  onDelete,
  onDeselectAll,
}: MobileSelectionBannerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <div className="mobile-banner">
      <span className="text-sm font-semibold text-theme-text">
        {count} selected
      </span>

      <div className="flex items-center gap-3">
        <button
          onClick={onEdit}
          className={cn(
            "text-sm font-medium px-3 py-1.5 rounded-theme-medium transition-colors",
            "text-theme-primary hover:bg-theme-primary-subtle",
          )}
        >
          Edit
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="p-2 rounded-theme-medium hover:bg-theme-background transition-colors"
            aria-label="More options"
          >
            <svg
              className="w-5 h-5 text-theme-text"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="6" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="18" r="2" />
            </svg>
          </button>

          {menuOpen && (
            <div
              className="context-menu"
              style={{
                position: "absolute",
                right: 0,
                bottom: "calc(100% + 8px)",
              }}
            >
              <button
                className="context-menu-item w-full text-left context-menu-item-danger"
                onClick={() => {
                  onDelete();
                  setMenuOpen(false);
                }}
              >
                Delete
              </button>
              <button
                className="context-menu-item w-full text-left"
                onClick={() => {
                  onDeselectAll();
                  setMenuOpen(false);
                }}
              >
                Deselect all
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
