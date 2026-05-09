export function monotoneTangents(pts: { x: number; y: number }[]): number[] {
  const n = pts.length
  const tangents = new Array<number>(n).fill(0)
  if (n < 2) return tangents

  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x
    slopes.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx)
  }

  tangents[0] = slopes[0]
  tangents[n - 1] = slopes[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents[i] = 0
    } else {
      const h0 = pts[i].x - pts[i - 1].x
      const h1 = pts[i + 1].x - pts[i].x
      const w = (2 * h1 + h0) / (3 * (h0 + h1))
      tangents[i] = 1 / (w / slopes[i - 1] + (1 - w) / slopes[i])
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0
      tangents[i + 1] = 0
    } else {
      const a = tangents[i] / slopes[i]
      const b = tangents[i + 1] / slopes[i]
      const s = a * a + b * b
      if (s > 9) {
        const t = 3 / Math.sqrt(s)
        tangents[i] = t * a * slopes[i]
        tangents[i + 1] = t * b * slopes[i]
      }
    }
  }
  return tangents
}

export function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  const tangents = monotoneTangents(pts)
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3
    const cp1x = pts[i].x + dx
    const cp1y = pts[i].y + tangents[i] * dx
    const cp2x = pts[i + 1].x - dx
    const cp2y = pts[i + 1].y - tangents[i + 1] * dx
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`
  }
  return d
}

export function coloredMonotoneSegments(
  pts: { x: number; y: number }[],
  values: number[],
  successColor: string,
  dangerColor: string,
): { d: string; color: string }[] {
  if (pts.length < 2) return []
  const tangents = monotoneTangents(pts)
  return pts.slice(1).map((pt, i) => {
    const prev = pts[i]
    const dx = (pt.x - prev.x) / 3
    const cp1x = prev.x + dx
    const cp1y = prev.y + tangents[i] * dx
    const cp2x = pt.x - dx
    const cp2y = pt.y - tangents[i + 1] * dx
    const d = `M${prev.x.toFixed(2)},${prev.y.toFixed(2)} C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${pt.x.toFixed(2)},${pt.y.toFixed(2)}`
    const rising = values[i + 1] >= values[i]
    return { d, color: rising ? successColor : dangerColor }
  })
}
