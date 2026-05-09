export const CATEGORY_COLOR_PALETTE = [
  {
    name: 'Blue',
    hex: '#2563EB',
    tailwind: 'blue-600',
  },
  {
    name: 'Sky',
    hex: '#0284C7',
    tailwind: 'sky-600',
  },
  {
    name: 'Cyan',
    hex: '#0891B2',
    tailwind: 'cyan-600',
  },
  {
    name: 'Indigo',
    hex: '#4F46E5',
    tailwind: 'indigo-600',
  },
  {
    name: 'Violet',
    hex: '#7C3AED',
    tailwind: 'violet-600',
  },
  {
    name: 'Purple',
    hex: '#9333EA',
    tailwind: 'purple-600',
  },
  {
    name: 'Fuchsia',
    hex: '#C026D3',
    tailwind: 'fuchsia-600',
  },
  {
    name: 'Pink',
    hex: '#DB2777',
    tailwind: 'pink-600',
  },
  {
    name: 'Orange',
    hex: '#EA580C',
    tailwind: 'orange-600',
  },
  {
    name: 'Amber',
    hex: '#D97706',
    tailwind: 'amber-600',
  },
  {
    name: 'Yellow',
    hex: '#CA8A04',
    tailwind: 'yellow-600',
  },
  {
    name: 'Royal Blue',
    hex: '#1D4ED8',
    tailwind: 'blue-700',
  },
  {
    name: 'Electric Blue',
    hex: '#3B82F6',
    tailwind: 'blue-500',
  },
  {
    name: 'Deep Sky',
    hex: '#0369A1',
    tailwind: 'sky-700',
  },
  {
    name: 'Bright Sky',
    hex: '#0EA5E9',
    tailwind: 'sky-500',
  },
  {
    name: 'Deep Cyan',
    hex: '#0E7490',
    tailwind: 'cyan-700',
  },
  {
    name: 'Bright Cyan',
    hex: '#06B6D4',
    tailwind: 'cyan-500',
  },
  {
    name: 'Deep Indigo',
    hex: '#4338CA',
    tailwind: 'indigo-700',
  },
  {
    name: 'Bright Indigo',
    hex: '#6366F1',
    tailwind: 'indigo-500',
  },
  {
    name: 'Deep Violet',
    hex: '#6D28D9',
    tailwind: 'violet-700',
  },
  {
    name: 'Bright Violet',
    hex: '#8B5CF6',
    tailwind: 'violet-500',
  },
  {
    name: 'Deep Purple',
    hex: '#7E22CE',
    tailwind: 'purple-700',
  },
  {
    name: 'Bright Purple',
    hex: '#A855F7',
    tailwind: 'purple-500',
  },
  {
    name: 'Deep Fuchsia',
    hex: '#A21CAF',
    tailwind: 'fuchsia-700',
  },
  {
    name: 'Bright Fuchsia',
    hex: '#D946EF',
    tailwind: 'fuchsia-500',
  },
  {
    name: 'Deep Pink',
    hex: '#BE185D',
    tailwind: 'pink-700',
  },
  {
    name: 'Bright Pink',
    hex: '#EC4899',
    tailwind: 'pink-500',
  },
  {
    name: 'Deep Orange',
    hex: '#C2410C',
    tailwind: 'orange-700',
  },
  {
    name: 'Bright Orange',
    hex: '#F97316',
    tailwind: 'orange-500',
  },
  {
    name: 'Deep Amber',
    hex: '#B45309',
    tailwind: 'amber-700',
  },
  {
    name: 'Bright Amber',
    hex: '#F59E0B',
    tailwind: 'amber-500',
  },
  {
    name: 'Deep Yellow',
    hex: '#A16207',
    tailwind: 'yellow-700',
  },
  {
    name: 'Bright Yellow',
    hex: '#EAB308',
    tailwind: 'yellow-500',
  },
] as const

export const GREEN_TO_RED_SCALE = [
  {
    name: 'Excellent Green',
    hex: '#16A34A',
    tailwind: 'green-600',
  },
  {
    name: 'Strong Green',
    hex: '#22C55E',
    tailwind: 'green-500',
  },
  {
    name: 'Lime Green',
    hex: '#65A30D',
    tailwind: 'lime-600',
  },
  {
    name: 'Yellow Green',
    hex: '#A3A30D',
    tailwind: null,
  },
  {
    name: 'Yellow',
    hex: '#CA8A04',
    tailwind: 'yellow-600',
  },
  {
    name: 'Amber',
    hex: '#D97706',
    tailwind: 'amber-600',
  },
  {
    name: 'Orange',
    hex: '#EA580C',
    tailwind: 'orange-600',
  },
  {
    name: 'Deep Orange',
    hex: '#C2410C',
    tailwind: 'orange-700',
  },
  {
    name: 'Soft Red',
    hex: '#DC2626',
    tailwind: 'red-600',
  },
  {
    name: 'Deep Red',
    hex: '#B91C1C',
    tailwind: 'red-700',
  },
] as const

export function mixHex(startHex: string, endHex: string, amount: number): string {
  const normalize = (hex: string) => {
    const trimmed = hex.replace('#', '')
    return trimmed.length === 3
      ? trimmed
          .split('')
          .map((char) => char + char)
          .join('')
      : trimmed
  }

  const parse = (hex: string) => {
    const full = normalize(hex)
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ] as const
  }

  const [sr, sg, sb] = parse(startHex)
  const [er, eg, eb] = parse(endHex)
  const ratio = Math.min(1, Math.max(0, amount))
  const mix = (start: number, end: number) => Math.round(start + (end - start) * ratio)

  return `rgb(${mix(sr, er)}, ${mix(sg, eg)}, ${mix(sb, eb)})`
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export function getCategoryColor(name: string): string {
  return CATEGORY_COLOR_PALETTE[hashString(name) % CATEGORY_COLOR_PALETTE.length].hex
}
