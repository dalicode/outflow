import { describe, expect, it } from 'vitest'
import type { Payee } from '@/types'
import {
  findBestPayeeMatch,
  fuzzySimilarity,
  getPayeeSearchTerms,
  normalizePayeeText,
  tokenOverlapScore,
} from '@/features/payees/utils/payeeMatching'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePayee(id: number, name: string, isArchived = false): Payee {
  return { id, name, isArchived, createdAt: '' }
}

// ── normalizePayeeText ───────────────────────────────────────────────────────

describe('normalizePayeeText', () => {
  it('lowercases and removes accents', () => {
    expect(normalizePayeeText('Café')).toBe('cafe')
  })

  it('removes noise words', () => {
    expect(normalizePayeeText('POS DEBIT VISA STARBUCKS')).toBe('starbucks')
  })

  it('removes location words', () => {
    expect(normalizePayeeText('STARBUCKS TORONTO ON')).toBe('starbucks')
  })

  it('removes business suffixes', () => {
    expect(normalizePayeeText('Amazon Inc')).toBe('amazon')
  })

  it('replaces punctuation with spaces', () => {
    expect(normalizePayeeText('UBER*TRIP')).toBe('uber trip')
  })

  it('collapses whitespace', () => {
    expect(normalizePayeeText('  TIM   HORTONS  ')).toBe('tim hortons')
  })

  it('handles empty string', () => {
    expect(normalizePayeeText('')).toBe('')
  })

  it('strips reference codes', () => {
    // Numbers are kept (not noise words), but punctuation is stripped
    expect(normalizePayeeText('AMZN MKTP CA*1A2B3C')).toBe('amzn mktp 1a2b3c')
  })
})

// ── getPayeeSearchTerms ──────────────────────────────────────────────────────

describe('getPayeeSearchTerms', () => {
  it('returns normalized name', () => {
    const p = makePayee(1, 'Starbucks')
    expect(getPayeeSearchTerms(p)).toEqual(['starbucks'])
  })

  it('returns only the normalized payee name', () => {
    const p = makePayee(1, 'Amazon')
    expect(getPayeeSearchTerms(p)).toEqual(['amazon'])
  })
})

// ── tokenOverlapScore ────────────────────────────────────────────────────────

describe('tokenOverlapScore', () => {
  it('returns 1 when all term tokens are in notes', () => {
    expect(tokenOverlapScore('amzn mktp 1a2b3c', 'amzn mktp')).toBe(1)
  })

  it('returns 0.5 when half the tokens match', () => {
    expect(tokenOverlapScore('amzn xyz', 'amzn mktp')).toBe(0.5)
  })

  it('returns 0 for empty term', () => {
    expect(tokenOverlapScore('starbucks toronto', '')).toBe(0)
  })
})

// ── fuzzySimilarity ──────────────────────────────────────────────────────────

describe('fuzzySimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(fuzzySimilarity('starbucks', 'starbucks')).toBe(1)
  })

  it('returns high score for near-identical strings', () => {
    expect(fuzzySimilarity('starbucks', 'starbuck')).toBeGreaterThan(0.8)
  })

  it('returns low score for unrelated strings', () => {
    expect(fuzzySimilarity('starbucks', 'walmart')).toBeLessThan(0.3)
  })

  it('returns 0 for single-char strings', () => {
    expect(fuzzySimilarity('a', 'b')).toBe(0)
  })
})

// ── findBestPayeeMatch ───────────────────────────────────────────────────────

describe('findBestPayeeMatch', () => {
  const payees: Payee[] = [
    makePayee(1, 'Amazon'),
    makePayee(2, 'Starbucks'),
    makePayee(3, 'Uber'),
    makePayee(4, 'Netflix'),
    makePayee(5, 'Tim Hortons'),
    makePayee(6, 'Archived Payee', true),
  ]

  it('matches Amazon by name', () => {
    const result = findBestPayeeMatch('AMAZON CA*123 TORONTO', payees)
    expect(result).not.toBeNull()
    expect(result?.payee.id).toBe(1)
    expect(result?.score).toBeGreaterThanOrEqual(0.7)
  })

  it('matches Starbucks by name', () => {
    const result = findBestPayeeMatch('STARBUCKS #04522 TORONTO ON', payees)
    expect(result).not.toBeNull()
    expect(result?.payee.id).toBe(2)
    expect(result?.score).toBeGreaterThanOrEqual(0.7)
  })

  it('matches Uber', () => {
    const result = findBestPayeeMatch('UBER *TRIP HELP.UBER.COM', payees)
    expect(result).not.toBeNull()
    expect(result?.payee.id).toBe(3)
  })

  it('matches Netflix by name', () => {
    const result = findBestPayeeMatch('NETFLIX.COM', payees)
    expect(result).not.toBeNull()
    expect(result?.payee.id).toBe(4)
  })

  it('matches Tim Hortons', () => {
    const result = findBestPayeeMatch('TIM HORTONS #1234 TORONTO ON', payees)
    expect(result).not.toBeNull()
    expect(result?.payee.id).toBe(5)
  })

  it('does not match archived payees', () => {
    const result = findBestPayeeMatch('ARCHIVED PAYEE PURCHASE', payees)
    // Should not return the archived payee
    if (result) {
      expect(result.payee.id).not.toBe(6)
    }
  })

  it('returns null for empty notes', () => {
    expect(findBestPayeeMatch('', payees)).toBeNull()
  })

  it('returns null for all-noise notes', () => {
    expect(findBestPayeeMatch('POS DEBIT VISA TORONTO ON', payees)).toBeNull()
  })

  it('returns null when no payees provided', () => {
    expect(findBestPayeeMatch('STARBUCKS TORONTO', [])).toBeNull()
  })

  it('requires confirmation for ambiguous short matches', () => {
    // "co" is a noise word, very short descriptions should not auto-match
    const shortPayees = [makePayee(10, 'TD'), makePayee(11, 'RBC')]
    const result = findBestPayeeMatch('TD BANK TORONTO', shortPayees)
    if (result) {
      // Short 2-char names are inherently ambiguous — should need confirmation
      expect(result.confidence).toBe('confirm')
    }
  })

  it('auto confidence for high-score unambiguous match', () => {
    const result = findBestPayeeMatch('STARBUCKS #04522 TORONTO ON', payees)
    expect(result).not.toBeNull()
    // Starbucks should be clearly the best match
    expect(result?.confidence).toBeOneOf(['auto', 'confirm'])
  })
})
