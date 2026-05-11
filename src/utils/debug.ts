const DEBUG =
  import.meta.env.DEV || import.meta.env.VITE_LOG_LEVEL === 'debug'

export function debugLog(...args: unknown[]) {
  if (!DEBUG) return
  console.log(...args)
}

export function debugWarn(...args: unknown[]) {
  if (!DEBUG) return
  console.warn(...args)
}
