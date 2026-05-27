import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '../lib/cn'

type ToastTone = 'default' | 'success' | 'warning' | 'danger'

interface ToastItem {
  id: string
  message: string
  actionLabel?: string
  onAction?: () => void | Promise<void>
  tone?: ToastTone
  durationMs?: number
  isUndo?: boolean
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id' | 'isUndo'>) => string
  showUndoToast: (
    message: string,
    onUndo: () => void | Promise<void>,
    options?: {
      actionLabel?: string
      tone?: ToastTone
      durationMs?: number
    },
  ) => string
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DESKTOP_BP = 640
const ROUTINE_DURATION = 4000
const UNDO_DURATION = 8000

function getToastToneStyle(tone: ToastTone | undefined): {
  borderColor: string
  backgroundColor: string
  boxShadow: string
  iconClassName: string
  actionClassName: string
} {
  if (tone === 'success') {
    return {
      borderColor: 'color-mix(in srgb, var(--theme-success) 32%, var(--theme-border))',
      backgroundColor: 'color-mix(in srgb, var(--theme-success) 8%, var(--theme-surface))',
      boxShadow: '0 14px 32px color-mix(in srgb, var(--theme-success) 10%, transparent)',
      iconClassName: 'text-theme-success',
      actionClassName: 'text-theme-success',
    }
  }

  if (tone === 'warning') {
    return {
      borderColor: 'color-mix(in srgb, var(--theme-warning) 34%, var(--theme-border))',
      backgroundColor: 'color-mix(in srgb, var(--theme-warning) 10%, var(--theme-surface))',
      boxShadow: '0 14px 32px color-mix(in srgb, var(--theme-warning) 12%, transparent)',
      iconClassName: 'text-theme-warning',
      actionClassName: 'text-theme-warning',
    }
  }

  if (tone === 'danger') {
    return {
      borderColor: 'color-mix(in srgb, var(--theme-danger) 32%, var(--theme-border))',
      backgroundColor: 'color-mix(in srgb, var(--theme-danger) 8%, var(--theme-surface))',
      boxShadow: '0 14px 32px color-mix(in srgb, var(--theme-danger) 10%, transparent)',
      iconClassName: 'text-theme-danger',
      actionClassName: 'text-theme-danger',
    }
  }

  return {
    borderColor: 'var(--theme-border)',
    backgroundColor: 'color-mix(in srgb, var(--theme-surface) 94%, var(--theme-background))',
    boxShadow: '0 14px 32px color-mix(in srgb, var(--theme-border) 28%, transparent)',
    iconClassName: 'text-theme-primary',
    actionClassName: 'text-theme-primary',
  }
}

function ToastToneIcon({ tone, className }: { tone: ToastTone | undefined; className: string }) {
  if (tone === 'success') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7 9 18l-5-5" />
      </svg>
    )
  }

  if (tone === 'warning') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v4m0 4h.01M10.29 3.86l-7.4 12.84A2 2 0 0 0 4.62 20h14.76a2 2 0 0 0 1.73-3.3L13.71 3.86a2 2 0 0 0-3.42 0Z"
        />
      </svg>
    )
  }

  if (tone === 'danger') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M12 8v5m0 3h.01" />
      </svg>
    )
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 10a6 6 0 0 0-11.49-2H6a4 4 0 0 0 0 8h12a3 3 0 0 0 0-6Z"
      />
    </svg>
  )
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < DESKTOP_BP : false,
  )
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < DESKTOP_BP)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

interface ToastInstance {
  item: ToastItem
  remainingMs: number
  durationMs: number
  paused: boolean
  pauseStartAt: number
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  const isMobile = useIsMobile()
  const instancesRef = useRef<Map<string, ToastInstance>>(new Map())
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const touchRef = useRef<{ y: number; id: string } | null>(null)
  const [touchDeltas, setTouchDeltas] = useState<Record<string, number>>({})

  // Compute which toasts are visible based on stacking rules
  useEffect(() => {
    const active = toasts.filter((t) => t.id)
    if (isMobile) {
      // Mobile: show at most 1. Undo toasts take priority.
      const undoToast = active.find((t) => t.isUndo)
      if (undoToast) {
        setVisibleIds([undoToast.id])
      } else if (active.length > 0) {
        setVisibleIds([active[active.length - 1].id])
      } else {
        setVisibleIds([])
      }
    } else {
      // Desktop: show up to 3, newest on top
      setVisibleIds(
        active
          .slice(-3)
          .map((t) => t.id)
          .reverse(),
      )
    }
  }, [toasts, isMobile])

  // Start/restart timers for visible toasts
  useEffect(() => {
    for (const id of visibleIds) {
      if (timersRef.current.has(id)) continue
      if (instancesRef.current.has(id)) continue

      const toast = toasts.find((t) => t.id === id)
      if (!toast) continue

      const durationMs = toast.durationMs ?? (toast.isUndo ? UNDO_DURATION : ROUTINE_DURATION)
      instancesRef.current.set(id, {
        item: toast,
        remainingMs: durationMs,
        durationMs,
        paused: false,
        pauseStartAt: 0,
      })
      timersRef.current.set(
        id,
        setTimeout(() => onDismiss(id), durationMs),
      )
    }
  }, [visibleIds, toasts, onDismiss])

  if (toasts.length === 0 && visibleIds.length === 0) return null

  return (
    <div
      className={cn(
        'pointer-events-none fixed z-[80] flex justify-center px-3',
        isMobile
          ? 'inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] pt-1'
          : 'top-4 right-4 justify-end sm:justify-end sm:px-6',
      )}
    >
      <div className={cn('flex flex-col gap-2', isMobile ? 'w-full max-w-md' : 'w-full max-w-md')}>
        {visibleIds.map((id) => {
          const toast = toasts.find((t) => t.id === id)
          if (!toast) return null
          const toneStyle = getToastToneStyle(toast.tone)
          const delta = touchDeltas[id] ?? 0

          return (
            <div
              key={id}
              style={{
                ...toneStyle,
                transform: delta ? `translateY(${delta}px)` : undefined,
                transition: delta ? 'none' : 'transform 0.15s ease',
              }}
              className={cn(
                'pointer-events-auto rounded-theme-medium border text-theme-text backdrop-blur-md',
                toast.isUndo ? 'toast-card toast-card-action' : 'toast-card',
                isMobile ? 'toast-enter-mobile' : 'toast-enter-desktop',
              )}
              onMouseEnter={() => {
                const inst = instancesRef.current.get(id)
                if (!inst) return
                inst.paused = true
                inst.pauseStartAt = Date.now()
                const timer = timersRef.current.get(id)
                if (timer) {
                  clearTimeout(timer)
                  timersRef.current.delete(id)
                }
              }}
              onMouseLeave={() => {
                const inst = instancesRef.current.get(id)
                if (!inst) return
                inst.paused = false
                const elapsed = Date.now() - inst.pauseStartAt
                inst.remainingMs = Math.max(0, inst.remainingMs - elapsed)
                const timer = timersRef.current.get(id)
                if (timer) clearTimeout(timer)
                if (inst.remainingMs > 0) {
                  timersRef.current.set(
                    id,
                    setTimeout(() => onDismiss(id), inst.remainingMs),
                  )
                } else {
                  onDismiss(id)
                }
              }}
              onTouchStart={(e) => {
                touchRef.current = { y: e.touches[0].clientY, id }
              }}
              onTouchMove={(e) => {
                if (!touchRef.current || touchRef.current.id !== id) return
                const touch = touchRef.current
                setTouchDeltas((prev) => ({
                  ...prev,
                  [id]: e.touches[0].clientY - touch.y,
                }))
              }}
              onTouchEnd={() => {
                touchRef.current = null
                if ((touchDeltas[id] ?? 0) < -60) {
                  onDismiss(id)
                }
                setTouchDeltas((prev) => {
                  const next = { ...prev }
                  delete next[id]
                  return next
                })
              }}
            >
              <div className="flex items-center gap-2.5 px-3 py-2">
                <div className="toast-icon-shell shrink-0">
                  <ToastToneIcon
                    tone={toast.tone}
                    className={cn('h-4 w-4', toneStyle.iconClassName)}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="min-w-0 text-sm leading-5">{toast.message}</p>
                  {toast.onAction && (
                    <div className="mt-1 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          onDismiss(toast.id)
                          void Promise.resolve(toast.onAction?.())
                        }}
                        className={cn('text-sm font-semibold', toneStyle.actionClassName)}
                      >
                        {toast.actionLabel ?? 'Undo'}
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(toast.id)}
                  className="shrink-0 self-center text-theme-muted transition-colors hover:text-theme-text"
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
          )
        })}
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const enqueueToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = makeId()
    setToasts((current) => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < DESKTOP_BP
      if (!isMobile) {
        if (current.length >= 3) {
          return [...current.slice(1), { ...toast, id }]
        }
        return [...current, { ...toast, id }]
      }
      if (toast.isUndo) {
        return [{ ...toast, id }]
      }
      // Mobile: don't replace an active undo toast with a routine toast
      const activeUndo = current.some((t) => t.isUndo)
      if (activeUndo && !toast.onAction) {
        return [...current, { ...toast, id }]
      }
      return [{ ...toast, id }]
    })
    return id
  }, [])

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id' | 'isUndo'>) => enqueueToast({ ...toast, isUndo: false }),
    [enqueueToast],
  )

  const showUndoToast = useCallback<ToastContextValue['showUndoToast']>(
    (message, onUndo, options) =>
      enqueueToast({
        message,
        onAction: onUndo,
        actionLabel: options?.actionLabel ?? 'Undo',
        tone: options?.tone ?? 'success',
        durationMs: options?.durationMs ?? UNDO_DURATION,
        isUndo: true,
      }),
    [enqueueToast],
  )

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer)
      }
      timersRef.current.clear()
    },
    [],
  )

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, showUndoToast, dismissToast }),
    [dismissToast, showToast, showUndoToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToasts(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (ctx) return ctx
  return {
    showToast: () => '',
    showUndoToast: () => '',
    dismissToast: () => undefined,
  }
}
