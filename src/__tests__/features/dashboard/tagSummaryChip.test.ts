import { describe, expect, it } from 'vitest'
import { getStableTagIdentity, getTagSummaryChipStyle, getTagSummaryData } from '@/utils/tagChip'

describe('getTagSummaryData', () => {
  it('returns empty summary when no tags are present', () => {
    expect(getTagSummaryData([])).toEqual({
      primaryTag: null,
      additionalCount: 0,
      summary: '',
    })
  })

  it('keeps primary tag plus additional count summary shape', () => {
    const tags = [
      { id: 101, name: 'Work', isArchived: false },
      { id: 102, name: 'Travel', isArchived: false },
      { id: 103, name: 'Home', isArchived: false },
    ]

    expect(getTagSummaryData(tags)).toEqual({
      primaryTag: tags[0],
      additionalCount: 2,
      summary: 'Work +2',
    })
  })
})

describe('getStableTagIdentity', () => {
  it('prefers numeric tag id when present', () => {
    expect(
      getStableTagIdentity({
        id: 7,
        name: 'Work',
      }),
    ).toBe('id:7')
  })

  it('falls back to normalized or normalized-name text when id is missing', () => {
    expect(
      getStableTagIdentity({
        name: '  Team   Lunch ',
      }),
    ).toBe('name:team lunch')
    expect(
      getStableTagIdentity({
        name: 'Ignored',
        normalizedName: 'custom-normalized',
      }),
    ).toBe('name:custom-normalized')
  })
})

describe('getTagSummaryChipStyle', () => {
  it('uses deterministic colors from tag names', () => {
    const first = getTagSummaryChipStyle({ id: 22, name: 'Alpha' })
    const second = getTagSummaryChipStyle({ id: 999, name: 'Alpha' })

    expect(first).toEqual(second)
  })

  it('allows renamed tags to receive a new visual color', () => {
    const first = getTagSummaryChipStyle({ id: 22, name: 'Alpha' })
    const second = getTagSummaryChipStyle({ id: 22, name: 'Renamed Later' })

    expect(first).not.toEqual(second)
  })

  it('maps different tags across a varied accent palette', () => {
    const accents = new Set(
      Array.from({ length: 8 }, (_value, index) =>
        String(getTagSummaryChipStyle({ id: index + 1, name: `Tag ${index + 1}` }).backgroundColor),
      ),
    )

    expect(accents.size).toBeGreaterThanOrEqual(6)
  })

  it('avoids clustering sequential ids into neighboring cool hues', () => {
    const sequentialAccents = Array.from({ length: 4 }, (_value, index) =>
      String(getTagSummaryChipStyle({ id: index + 1, name: `Tag ${index + 1}` }).backgroundColor),
    )

    expect(new Set(sequentialAccents).size).toBe(4)
  })

  it('returns theme-aware color-mix values', () => {
    const style = getTagSummaryChipStyle({ name: 'Theme Test' })
    expect(String(style.backgroundColor)).toContain('color-mix')
    expect(String(style.backgroundColor)).toContain('var(--theme-surface)')
    expect(String(style.borderColor)).toContain('var(--theme-border)')
    expect(String(style.color)).toContain('var(--theme-text)')
  })
})
