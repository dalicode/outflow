import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "../utils/cn";

type ToastTone = "default" | "success" | "warning" | "danger";

interface ToastItem {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, "id">) => string;
  showUndoToast: (
    message: string,
    onUndo: () => void | Promise<void>,
    options?: {
      actionLabel?: string;
      tone?: ToastTone;
      durationMs?: number;
    },
  ) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function getToastToneStyle(tone: ToastTone | undefined): {
  borderColor: string;
  backgroundColor: string;
  boxShadow: string;
} {
  if (tone === "success") {
    return {
      borderColor: "color-mix(in srgb, var(--theme-success) 32%, var(--theme-border))",
      backgroundColor:
        "color-mix(in srgb, var(--theme-success) 8%, var(--theme-surface))",
      boxShadow:
        "0 14px 32px color-mix(in srgb, var(--theme-success) 10%, transparent)",
    };
  }

  if (tone === "danger") {
    return {
      borderColor: "color-mix(in srgb, var(--theme-danger) 32%, var(--theme-border))",
      backgroundColor:
        "color-mix(in srgb, var(--theme-danger) 8%, var(--theme-surface))",
      boxShadow:
        "0 14px 32px color-mix(in srgb, var(--theme-danger) 10%, transparent)",
    };
  }

  return {
    borderColor: "var(--theme-border)",
    backgroundColor: "var(--theme-surface)",
    boxShadow: "0 14px 32px color-mix(in srgb, var(--theme-border) 28%, transparent)",
  };
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom)+0.5rem)] z-[80] flex justify-center px-3 sm:bottom-4 sm:justify-end sm:px-6">
      <div className="flex w-full max-w-md flex-col gap-2">
        {toasts.map((toast) => {
          const toneStyle = getToastToneStyle(toast.tone);

          return (
            <div
              key={toast.id}
              style={toneStyle}
              className={cn(
                "pointer-events-auto flex items-center justify-between gap-3 rounded-theme-medium border px-3 py-2.5 text-theme-text backdrop-blur-sm",
              )}
            >
              <p className="min-w-0 flex-1 text-sm leading-5">{toast.message}</p>
              <div className="flex items-center gap-2 shrink-0">
                {toast.onAction && (
                  <button
                    type="button"
                    onClick={() => {
                      onDismiss(toast.id);
                      void Promise.resolve(toast.onAction?.());
                    }}
                    className={cn(
                      "text-sm font-semibold",
                      toast.tone === "danger"
                        ? "text-theme-danger"
                        : "text-theme-primary",
                    )}
                  >
                    {toast.actionLabel ?? "Undo"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDismiss(toast.id)}
                  className="text-theme-muted hover:text-theme-text"
                  aria-label="Dismiss notification"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = makeId();
      setToasts((current) => [...current, { ...toast, id }]);

      const durationMs = toast.durationMs ?? 5000;
      const timer = setTimeout(() => dismissToast(id), durationMs);
      timersRef.current.set(id, timer);

      return id;
    },
    [dismissToast],
  );

  const showUndoToast = useCallback<ToastContextValue["showUndoToast"]>(
    (message, onUndo, options) =>
      showToast({
        message,
        onAction: onUndo,
        actionLabel: options?.actionLabel ?? "Undo",
        tone: options?.tone ?? "success",
        durationMs: options?.durationMs ?? 5000,
      }),
    [showToast],
  );

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, showUndoToast, dismissToast }),
    [dismissToast, showToast, showUndoToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToasts(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  return {
    showToast: () => "",
    showUndoToast: () => "",
    dismissToast: () => undefined,
  };
}
