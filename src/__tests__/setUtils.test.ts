import { describe, expect, it } from 'vitest'
import { toggleInSet } from '../utils/setUtils'

describe('toggleInSet', () => {
  it('adds a value not in the set', () => {
    const result = toggleInSet(new Set(['a']), 'b')
    expect(result.has('b')).toBe(true)
    expect(result.has('a')).toBe(true)
  })
  it('removes a value already in the set', () => {
    const result = toggleInSet(new Set(['a', 'b']), 'a')
    expect(result.has('a')).toBe(false)
    expect(result.has('b')).toBe(true)
  })
  it('returns a new Set, not the original', () => {
    const original = new Set(['a'])
    const result = toggleInSet(original, 'b')
    expect(result).not.toBe(original)
  })
})
