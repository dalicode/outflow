import {
  useEffect,
  useCallback,
  useState,
  type ReactNode,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";
import { useFocusTrap } from "../../hooks/useFocusTrap";

let modalDepth = 0;
// Shared flag: true while a modal is programmatically calling history.back()
// to clean up its own entry. Prevents other modals from responding to that pop.
let programmaticBack = false;
let bodyScrollLockCount = 0;
let lockedScrollY = 0;
let previousBodyStyles: Partial<CSSStyleDeclaration> | null = null;

function lockBodyScroll(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  bodyScrollLockCount += 1;
  if (bodyScrollLockCount > 1) return;

  const bodyStyle = document.body.style;
  lockedScrollY = window.scrollY;
  previousBodyStyles = {
    overflow: bodyStyle.overflow,
    position: bodyStyle.position,
    top: bodyStyle.top,
    left: bodyStyle.left,
    right: bodyStyle.right,
    width: bodyStyle.width,
    touchAction: bodyStyle.touchAction,
  };

  bodyStyle.overflow = "hidden";
  bodyStyle.position = "fixed";
  bodyStyle.top = `-${lockedScrollY}px`;
  bodyStyle.left = "0";
  bodyStyle.right = "0";
  bodyStyle.width = "100%";
  bodyStyle.touchAction = "none";
}

function unlockBodyScroll(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (bodyScrollLockCount === 0) return;

  bodyScrollLockCount -= 1;
  if (bodyScrollLockCount > 0) return;

  const bodyStyle = document.body.style;
  const restore = previousBodyStyles;

  bodyStyle.overflow = restore?.overflow ?? "";
  bodyStyle.position = restore?.position ?? "";
  bodyStyle.top = restore?.top ?? "";
  bodyStyle.left = restore?.left ?? "";
  bodyStyle.right = restore?.right ?? "";
  bodyStyle.width = restore?.width ?? "";
  bodyStyle.touchAction = restore?.touchAction ?? "";

  window.scrollTo(0, lockedScrollY);
  previousBodyStyles = null;
}

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  mobileFullScreen?: boolean;
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

const desktopPlacementMap: Record<ModalSize, string> = {
  sm: "sm:items-start sm:pt-[15vh]",
  md: "sm:items-start sm:pt-[15vh]",
  lg: "sm:items-center sm:pt-4",
  xl: "sm:items-center sm:pt-4",
  full: "sm:items-center sm:pt-4",
};

interface ViewportMetrics {
  width: number;
  height: number;
  offsetTop: number;
  keyboardInset: number;
}

function getViewportMetrics(): ViewportMetrics {
  if (typeof window === "undefined") {
    return { width: 0, height: 0, offsetTop: 0, keyboardInset: 0 };
  }

  const viewport = window.visualViewport;
  if (!viewport) {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      offsetTop: 0,
      keyboardInset: 0,
    };
  }

  const keyboardInset = Math.max(
    0,
    window.innerHeight - viewport.height - viewport.offsetTop,
  );

  return {
    width: viewport.width,
    height: viewport.height,
    offsetTop: viewport.offsetTop,
    keyboardInset,
  };
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  mobileFullScreen = false,
  mobileActionLabel,
  onMobileAction,
  mobileActionDisabled,
  closeOnBackdropClick = true,
  showCloseButton = true,
  bodyClassName,
}: ModalProps) {
  const containerRef = useFocusTrap(isOpen);
  // Whether this modal instance has pushed a history entry
  const pushedRef = useRef(false);
  // The depth level this modal was assigned when it opened
  const myDepthRef = useRef(0);
  // Whether we're currently closing via history.back() to avoid double-close
  const closingViaBackRef = useRef(false);

  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewportMetrics, setViewportMetrics] =
    useState<ViewportMetrics>(getViewportMetrics);

  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 800);
  }, []);

  // ── Push a history entry when the modal opens ──────────────────────────────
  useEffect(() => {
    if (isOpen && !pushedRef.current) {
      myDepthRef.current = ++modalDepth;
      history.pushState({ modal: myDepthRef.current }, "");
      pushedRef.current = true;
    }
  }, [isOpen]);

  // ── Handle native back button — only the topmost modal responds ────────────
  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      if (!isOpen || !pushedRef.current) return;
      if (myDepthRef.current !== modalDepth) return; // not topmost
      if (programmaticBack) return; // another modal is cleaning up its entry

      e.stopImmediatePropagation();
      modalDepth = Math.max(0, modalDepth - 1);
      pushedRef.current = false;
      closingViaBackRef.current = true;
      onClose();
      setTimeout(() => { closingViaBackRef.current = false; }, 0);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [isOpen, onClose]);

  // ── Handle Escape key ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.stopPropagation();
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Clean up when modal closes (via button/backdrop/escape) ───────────────
  // If we pushed a history entry and the modal is closing NOT via popstate,
  // we need to call history.back() to remove our entry from the stack.
  useEffect(() => {
    if (!isOpen && pushedRef.current) {
      pushedRef.current = false;
      modalDepth = Math.max(0, myDepthRef.current - 1);

      if (!closingViaBackRef.current) {
        closingViaBackRef.current = true;
        programmaticBack = true;
        history.back();
        setTimeout(() => {
          closingViaBackRef.current = false;
          programmaticBack = false;
        }, 100);
      }
    }
  }, [isOpen]);

  // ── Close handler used by buttons/backdrop/escape ─────────────────────────
  const closeModal = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        closeModal();
      }
    },
    [closeModal, closeOnBackdropClick],
  );

  useEffect(() => {
    if (!isOpen) return;

    const updateViewportMetrics = () => {
      setViewportMetrics(getViewportMetrics());
    };

    updateViewportMetrics();

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updateViewportMetrics);
    viewport?.addEventListener("scroll", updateViewportMetrics);
    window.addEventListener("resize", updateViewportMetrics);

    return () => {
      viewport?.removeEventListener("resize", updateViewportMetrics);
      viewport?.removeEventListener("scroll", updateViewportMetrics);
      window.removeEventListener("resize", updateViewportMetrics);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isOpen]);

  const isFullScreenMobile =
    mobileFullScreen || size === "xl" || size === "full";
  const hasHeader = title || description;
  const isMobileViewport = viewportMetrics.width < 640;
  const mobileCardMaxHeight = Math.max(0, viewportMetrics.height - 24);
  const hasMobileAction = isFullScreenMobile && Boolean(onMobileAction);
  const desktopPlacementClass = desktopPlacementMap[size];

  const overlayStyle =
    isMobileViewport && !isFullScreenMobile
      ? {
          top: `${viewportMetrics.offsetTop}px`,
          height: `${viewportMetrics.height}px`,
        }
      : undefined;

  const modalCardStyle = isMobileViewport
    ? isFullScreenMobile
      ? { height: `${viewportMetrics.height}px` }
      : { maxHeight: `${mobileCardMaxHeight}px` }
    : undefined;

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={cn(
        "fixed left-0 top-0 right-0 bottom-0 z-50",
        "flex justify-center",
        isFullScreenMobile
          ? "items-stretch bg-theme-surface sm:bg-black/40"
          : "items-center bg-black/40 p-3 sm:p-4",
        desktopPlacementClass,
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      aria-describedby={description ? "modal-description" : undefined}
      style={overlayStyle}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className={cn(
          "m-0 flex flex-col overflow-hidden bg-theme-surface",
          isFullScreenMobile
            ? "h-full w-screen rounded-none sm:h-auto sm:max-h-[80vh] sm:w-full sm:rounded-theme-large sm:border border-theme-border sm:shadow-xl"
            : "h-auto w-full rounded-theme-large border border-theme-border shadow-lg sm:max-h-[85vh]",
          sizeMap[size],
        )}
        style={modalCardStyle}
      >
        {/* Mobile full-screen header */}
        {isFullScreenMobile && (
          <div className="flex shrink-0 items-center justify-between border-b border-theme-border px-4 py-3 sm:hidden">
            <button
              type="button"
              onClick={closeModal}
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
            <div className="w-14" aria-hidden="true" />
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
                  onClick={closeModal}
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
            "flex-1 overflow-x-hidden overflow-y-auto scrollbar-auto-hide overscroll-contain min-h-0",
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
        {hasMobileAction && (
          <div
            className={cn(
              "shrink-0 border-t border-theme-border bg-theme-surface sm:hidden",
              "px-4 py-3",
              "pb-[max(env(safe-area-inset-bottom),0.75rem)]",
            )}
          >
            <button
              type="button"
              onClick={onMobileAction}
              disabled={mobileActionDisabled}
              className={cn(
                "btn-modal-primary min-h-12 w-full text-base",
                mobileActionDisabled && "cursor-not-allowed opacity-50",
              )}
            >
              {mobileActionLabel}
            </button>
          </div>
        )}
        {footer && (
          <div
            className={cn(
              "shrink-0 border-t border-theme-border bg-theme-surface",
              hasMobileAction && "hidden sm:block",
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
