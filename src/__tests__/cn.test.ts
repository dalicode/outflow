import { describe, expect, it } from 'vitest'
import { cn } from '../lib/cn'

describe('cn', () => {
  it('merges multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional arrays', () => {
    const isActive = true
    const isLarge = false
    expect(cn('base', isActive && 'active', isLarge && 'large')).toBe('base active')
  })

  it('merges tailwind conflicts (later wins)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('ignores undefined and null values', () => {
    expect(cn('base', undefined, null, 'extra')).toBe('base extra')
  })

  it('handles nested arrays', () => {
    expect(cn(['a', 'b'], ['c', undefined])).toBe('a b c')
  })

  it('returns empty string for no args', () => {
    expect(cn()).toBe('')
  })
})
