import { describe, expect, it } from 'vitest'
import { TEXT } from '../utils/textStyles'

describe('TEXT styles', () => {
  it('exports all expected text style keys', () => {
    const expectedKeys = [
      'disabled',
      'placeholder',
      'empty',
      'muted',
      'sublabel',
      'danger',
      'primaryHover',
    ]
    expectedKeys.forEach((key) => {
      expect(TEXT[key as keyof typeof TEXT]).toBeDefined()
    })
  })

  it('uses theme-muted for disabled text', () => {
    expect(TEXT.disabled).toBe('text-theme-muted')
  })

  it('uses theme-muted for placeholder text', () => {
    expect(TEXT.placeholder).toBe('text-theme-muted')
  })

  it('uses theme-muted for empty states', () => {
    expect(TEXT.empty).toBe('text-theme-muted')
  })

  it('uses theme-muted for muted text', () => {
    expect(TEXT.muted).toBe('text-theme-muted')
  })

  it('uses theme-muted for sublabels', () => {
    expect(TEXT.sublabel).toBe('text-theme-muted')
  })

  it('uses theme-danger for danger text', () => {
    expect(TEXT.danger).toBe('text-theme-danger')
  })

  it('uses theme-primary for primary hover', () => {
    expect(TEXT.primaryHover).toBe('text-theme-primary')
  })
})
