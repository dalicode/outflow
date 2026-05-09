export function normalizeName(name: string): string {
  if (!name || typeof name !== 'string') return String(name ?? '')
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
