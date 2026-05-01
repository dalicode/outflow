import {
  useEffect,
  useCallback,
  useState,
  type ReactNode,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  size?: ModalSize;
  mobileActionLabel?: string;
  onMobileAction?: () => void;
  mobileActionDisabled?: boolean;
}

const sizeMap: Record<ModalSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  full: "sm:max-w-3xl",
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  mobileActionLabel,
  onMobileAction,
  mobileActionDisabled,
}: ModalProps) {
  const pushedRef = useRef(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 800);
  }, []);

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

  const modalContent = (
    <div
      className={cn(
        "fixed left-0 top-0 right-0 bottom-0 z-50",
        "flex items-center justify-center",
        isFullScreenMobile
          ? "bg-theme-surface sm:bg-black/40"
          : "bg-black/40 p-4",
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "m-0 flex flex-col overflow-hidden bg-theme-surface",
          isFullScreenMobile
            ? "h-[100dvh] w-screen rounded-none sm:h-auto sm:max-h-[90vh] sm:w-full sm:rounded-xl sm:border sm:border-theme-border sm:shadow-xl"
            : "h-auto max-h-[85vh] w-full rounded-xl border border-theme-border shadow-lg",
          sizeMap[size],
        )}
      >
        {/* Mobile full-screen header */}
        {isFullScreenMobile && (
          <div className="flex shrink-0 items-center justify-between border-b border-theme-border px-4 py-3 sm:hidden">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 text-sm font-medium text-theme-primary"
              aria-label="Cancel"
            >
              Cancel
            </button>
            {title && (
              <h2 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-theme-text">
                {title}
              </h2>
            )}
            {onMobileAction ? (
              <button
                type="button"
                onClick={onMobileAction}
                disabled={mobileActionDisabled}
                className={cn(
                  "text-sm font-semibold",
                  mobileActionDisabled
                    ? "text-theme-muted opacity-50 cursor-not-allowed"
                    : "text-theme-primary",
                )}
              >
                {mobileActionLabel}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-medium text-theme-muted hover:text-theme-text"
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Desktop header (and mobile card header for non-fullscreen) */}
        {title && (
          <div
            className={cn(
              "flex shrink-0 items-center justify-between p-5 pb-0",
              isFullScreenMobile && "hidden sm:flex",
            )}
          >
            <h3 className="text-base font-semibold text-theme-text">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-xl leading-none text-theme-muted hover:text-theme-text"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        )}

        {/* Content */}
        <div
          className={cn(
            "flex-1 overflow-x-hidden overflow-y-auto scrollbar-auto-hide",
            isScrolling && "is-scrolling",
            isFullScreenMobile ? "p-4" : "p-5",
            title && "pt-4",
          )}
          onScroll={handleScroll}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
