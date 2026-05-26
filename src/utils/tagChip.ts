import type { CSSProperties } from 'react'
import type { Tag } from '../types'

export interface TagSummaryData {
  primaryTag: Tag | null
  additionalCount: number
  summary: string
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getStableTagIdentity(tag: Pick<Tag, 'id' | 'name' | 'normalizedName'>): string {
  if (typeof tag.id === 'number') {
    return `id:${tag.id}`
  }

  const normalizedName = tag.normalizedName?.trim().toLowerCase()
  if (normalizedName) {
    return `name:${normalizedName}`
  }

  const fallbackName = normalizeTagName(tag.name)
  return `name:${fallbackName || 'untagged'}`
}

function hashIdentity(identity: string): number {
  let hash = 2166136261

  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }

  return hash >>> 0
}

export function getTagSummaryData(tags: Tag[]): TagSummaryData {
  if (tags.length === 0) {
    return {
      primaryTag: null,
      additionalCount: 0,
      summary: '',
    }
  }

  const primaryTag = tags[0]
  const additionalCount = Math.max(tags.length - 1, 0)

  return {
    primaryTag,
    additionalCount,
    summary: additionalCount > 0 ? `${primaryTag.name} +${additionalCount}` : primaryTag.name,
  }
}

export function getTagSummaryChipStyle(
  tag: Pick<Tag, 'id' | 'name' | 'normalizedName'>,
): CSSProperties {
  const identityHash = hashIdentity(getStableTagIdentity(tag))
  const hue = identityHash % 360
  const accentColor = `hsl(${hue} 72% 46%)`

  return {
    backgroundColor: `color-mix(in srgb, ${accentColor} 14%, var(--theme-surface))`,
    borderColor: `color-mix(in srgb, ${accentColor} 38%, var(--theme-border))`,
    color: `color-mix(in srgb, ${accentColor} 70%, var(--theme-text))`,
  }
}
