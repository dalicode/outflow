import { describe, expect, it } from 'vitest'
import { coloredMonotoneSegments, monotonePath, monotoneTangents } from '@/utils/chartMath'

describe('chartMath', () => {
  describe('monotoneTangents', () => {
    it('returns empty for 2 points', () => {
      const tangents = monotoneTangents([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ])
      expect(tangents).toHaveLength(2)
      expect(tangents[0]).toBe(1)
      expect(tangents[1]).toBe(1)
    })

    it('returns array same length as input for 3 points', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
      ]
      const tangents = monotoneTangents(pts)
      expect(tangents).toHaveLength(3)
    })

    it('returns all zeros for a flat line', () => {
      const pts = [
        { x: 0, y: 5 },
        { x: 1, y: 5 },
        { x: 2, y: 5 },
      ]
      const tangents = monotoneTangents(pts)
      expect(tangents.every((t) => t === 0)).toBe(true)
    })
  })

  describe('monotonePath', () => {
    it('returns a string starting with M', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]
      const path = monotonePath(pts)
      expect(path).toMatch(/^M/)
    })

    it('returns empty string for single point', () => {
      expect(monotonePath([{ x: 0, y: 0 }])).toBe('')
    })
  })

  describe('coloredMonotoneSegments', () => {
    it('returns correct colors for rising values', () => {
      const pts = [
        { x: 0, y: 100 },
        { x: 1, y: 200 },
      ]
      const segments = coloredMonotoneSegments(pts, [100, 200], 'green', 'red')
      expect(segments).toHaveLength(1)
      expect(segments[0].color).toBe('green')
    })

    it('returns correct colors for falling values', () => {
      const pts = [
        { x: 0, y: 200 },
        { x: 1, y: 100 },
      ]
      const segments = coloredMonotoneSegments(pts, [200, 100], 'green', 'red')
      expect(segments).toHaveLength(1)
      expect(segments[0].color).toBe('red')
    })

    it('returns empty array for single point', () => {
      expect(coloredMonotoneSegments([{ x: 0, y: 0 }], [0], 'g', 'r')).toHaveLength(0)
    })
  })
})
