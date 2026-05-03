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
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  mobileActionLabel?: string;
  onMobileAction?: () => void;
  mobileActionDisabled?: boolean;
  closeOnBackdropClick?: boolean;
  showCloseButton?: boolean;
  bodyClassName?: string;
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
  description,
  children,
  footer,
  size = "md",
  mobileActionLabel,
  onMobileAction,
  mobileActionDisabled,
  closeOnBackdropClick = true,
  showCloseButton = true,
  bodyClassName,
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
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose, closeOnBackdropClick],
  );

  if (!isOpen) return null;

  const isFullScreenMobile = size === "xl" || size === "full";
  const hasHeader = title || description;

  const modalContent = (
    <div
      className={cn(
        "fixed left-0 top-0 right-0 bottom-0 z-50",
        "flex items-start justify-center",
        isFullScreenMobile
          ? "bg-theme-surface sm:bg-black/40 sm:pt-[10vh]"
          : "bg-black/40 p-4 pt-[20vh]",
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      aria-describedby={description ? "modal-description" : undefined}
    >
      <div
        className={cn(
          "m-0 flex flex-col overflow-hidden bg-theme-surface",
          isFullScreenMobile
            ? "h-[100dvh] w-screen rounded-none sm:h-auto sm:max-h-[80vh] sm:w-full sm:rounded-theme-large sm:border border-theme-border sm:shadow-xl"
            : "h-auto max-h-[85vh] w-full rounded-theme-large border border-theme-border shadow-lg",
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
              <h2
                id="modal-title"
                className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-theme-text"
              >
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
        {hasHeader && (
          <div
            className={cn(
              "flex shrink-0 flex-col",
              isFullScreenMobile && "hidden sm:flex",
              !footer ? "p-5 pb-0" : "p-5 pb-0",
            )}
          >
            <div className="flex items-center justify-between">
              {title ? (
                <h3 id="modal-title" className="text-base font-semibold text-theme-text">
                  {title}
                </h3>
              ) : (
                <div />
              )}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xl leading-none text-theme-muted hover:text-theme-text"
                  aria-label="Close"
                >
                  &times;
                </button>
              )}
            </div>
            {description && (
              <p id="modal-description" className="mt-1 text-xs text-theme-muted">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Content */}
        <div
          className={cn(
            "flex-1 overflow-x-hidden overflow-y-auto scrollbar-auto-hide min-h-0",
            isScrolling && "is-scrolling",
            isFullScreenMobile ? "p-4" : "p-5",
            hasHeader && "pt-4",
            bodyClassName,
          )}
          onScroll={handleScroll}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className={cn(
              "shrink-0 border-t border-theme-border bg-theme-surface",
              "px-4 py-3 sm:px-5",
              "pb-[max(env(safe-area-inset-bottom),0.75rem)]",
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
