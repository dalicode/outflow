export function fmtCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0'
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${Math.round(n)}`
}

export function fmtFull(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '$0.00'
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0%'
  return `${n.toFixed(1)}%`
}

export function fmtDelta(n: number): string {
  const abs = fmtCompact(Math.abs(n))
  return n >= 0 ? `+$${abs}` : `−$${abs}`
}
