import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTORS = [
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(", ");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
  return Array.from(elements).filter(
    (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"),
  );
}

export function useFocusTrap(isActive: boolean): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store and restore focus
  useEffect(() => {
    if (isActive) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      return;
    }
    // Restore focus when deactivating (modal closes)
    if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        previousFocusRef.current?.focus();
      }, 0);
    }
  }, [isActive]);

  // Move focus into modal when it opens
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Use requestAnimationFrame to ensure DOM is fully rendered
    const rafId = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const focusable = getFocusableElements(containerRef.current);
      if (focusable.length > 0) {
        // Focus the first focusable element
        focusable[0].focus();
      } else {
        // Fallback: focus the container itself
        containerRef.current.focus();
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [isActive]);

  // Handle Tab/Shift+Tab cycling
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !containerRef.current) return;

      const focusable = getFocusableElements(containerRef.current);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        // Shift+Tab: if on first, go to last
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if on last, go to first
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive]);

  return containerRef;
}
