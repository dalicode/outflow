import { useEffect, useCallback, type ReactNode, useRef } from "react";
import { cn } from "../../utils/cn";

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  size?: ModalSize;
}

const sizeMap: Record<ModalSize, string> = {
  sm: "w-[85vw] sm:max-w-sm",
  md: "w-[90vw] sm:max-w-md",
  lg: "w-[90vw] sm:max-w-lg",
  xl: "w-[92vw] sm:max-w-xl",
  full: "w-[95vw] sm:max-w-3xl",
};

function BackArrowIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: ModalProps) {
  const pushedRef = useRef(false);

  // Push history state when opening so native back button closes the modal
  useEffect(() => {
    if (isOpen && !pushedRef.current) {
      history.pushState({ modal: true }, "");
      pushedRef.current = true;
    }
  }, [isOpen]);

  // Handle popstate (native back button)
  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      if (isOpen) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [isOpen, onClose]);

  // Handle Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Clean up pushed state if modal closes without popstate
  useEffect(() => {
    if (!isOpen && pushedRef.current) {
      pushedRef.current = false;
      // Only go back if the top state is ours (avoid interfering with router)
      if (history.state?.modal) {
        history.back();
      }
    }
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  const isFullScreenMobile = size === "xl" || size === "full";

  return (
    <div
      className={cn(
        "fixed inset-0 z-30",
        isFullScreenMobile
          ? "sm:bg-black/40 sm:flex sm:items-center sm:justify-center"
          : "bg-black/40 flex items-center justify-center",
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "bg-theme-surface flex flex-col",
          isFullScreenMobile
            ? "h-full w-full sm:h-auto sm:max-h-[85vh] sm:rounded-xl sm:border border-theme-border sm:shadow-lg sm:p-5"
            : "rounded-xl border border-theme-border shadow-lg p-5 max-h-[85vh]",
          sizeMap[size],
        )}
      >
        {/* Mobile full-screen header */}
        {isFullScreenMobile && (
          <div className="flex sm:hidden items-center justify-between px-4 py-3 border-b border-theme-border shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 text-theme-primary font-medium text-sm"
              aria-label="Go back"
            >
              <BackArrowIcon />
              Back
            </button>
            {title && (
              <h2 className="text-base font-semibold text-theme-text absolute left-1/2 -translate-x-1/2">
                {title}
              </h2>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-theme-muted hover:text-theme-text text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Desktop (and mobile card) header */}
        {title && (
          <div
            className={cn(
              "flex justify-between items-center shrink-0",
              isFullScreenMobile && "hidden sm:flex",
              !isFullScreenMobile && "",
            )}
          >
            <h3 className="text-base font-semibold text-theme-text">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-theme-muted hover:text-theme-text text-xl leading-none"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        )}

        {/* Content */}
        <div
          className={cn(
            "flex-1 overflow-y-auto",
            isFullScreenMobile ? "p-4 sm:p-0" : "",
            (title || isFullScreenMobile) && "mt-4 sm:mt-4",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
