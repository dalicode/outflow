/**
 * Payee Matching Engine
 * ─────────────────────
 * Hybrid matcher: normalization → exact → contains → token overlap → fuzzy.
 * Returns a confidence score and whether the match needs user confirmation.
 */

import type { Payee } from '../../../types'

// ── Noise word sets ──────────────────────────────────────────────────────────

const NOISE_WORDS = new Set([
  // Transaction noise
  'pos',
  'debit',
  'credit',
  'visa',
  'mastercard',
  'amex',
  'interac',
  'purchase',
  'payment',
  'online',
  'web',
  'mobile',
  'tap',
  'contactless',
  'recurring',
  'preauth',
  'pre',
  'auth',
  'transaction',
  'transfer',
  'e-transfer',
  'etransfer',
  'bill',
  'autopay',
  'auto',
  // Location noise (Toronto / Canada)
  'toronto',
  'ontario',
  'canada',
  'on',
  'ca',
  'qc',
  'bc',
  'ab',
  'north',
  'south',
  'east',
  'west',
  'downtown',
  'uptown',
  // Business suffixes
  'inc',
  'ltd',
  'limited',
  'corp',
  'corporation',
  'co',
  'company',
  'llc',
  'llp',
  'lp',
  'plc',
  'gmbh',
  'bv',
  // Common filler
  'the',
  'and',
  'or',
  'of',
  'at',
  'in',
  'for',
  'to',
  'a',
  'an',
])

// ── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a raw transaction description or payee name for matching.
 * - Lowercase
 * - Remove accents
 * - Replace punctuation/special chars with spaces
 * - Remove noise words
 * - Collapse whitespace
 */
export function normalizePayeeText(value: string): string {
  if (!value || typeof value !== 'string') return ''
  return (
    value
      .toLowerCase()
      // Remove accents
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Replace punctuation and special chars with spaces
      .replace(/[^a-z0-9\s]/g, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
      // Remove noise words (whole words only)
      .split(' ')
      .filter((t) => t.length > 0 && !NOISE_WORDS.has(t))
      .join(' ')
  )
}

// ── Search terms for a payee ─────────────────────────────────────────────────

/**
 * Returns the normalized search term for a payee name.
 */
export function getPayeeSearchTerms(payee: Payee): string[] {
  const name = typeof payee.name === 'string' ? payee.name : String(payee.name ?? '')
  return [normalizePayeeText(name)].filter(Boolean)
}

// ── Token overlap score ──────────────────────────────────────────────────────

/**
 * Fraction of the payee term's tokens that appear in the description tokens.
 * e.g. term="amzn mktp", desc="amzn mktp ca 1a2b3c" → 1.0
 */
export function tokenOverlapScore(description: string, term: string): number {
  const descTokens = new Set(description.split(' ').filter(Boolean))
  const termTokens = term.split(' ').filter(Boolean)
  if (termTokens.length === 0) return 0
  const matches = termTokens.filter((t) => descTokens.has(t)).length
  return matches / termTokens.length
}

// ── Fuzzy similarity (Dice coefficient on bigrams) ───────────────────────────

function bigrams(s: string): Set<string> {
  const result = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) {
    result.add(s.slice(i, i + 2))
  }
  return result
}

/**
 * Dice coefficient bigram similarity between two strings.
 * Returns 0–1. Fast and works well for short merchant names.
 */
export function fuzzySimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const ba = bigrams(a)
  const bb = bigrams(b)
  let intersection = 0
  for (const bg of ba) {
    if (bb.has(bg)) intersection++
  }
  return (2 * intersection) / (ba.size + bb.size)
}

// ── Score a single payee against a description ───────────────────────────────

export interface PayeeMatchScore {
  payee: Payee
  score: number
  /** The term that produced the best score */
  matchedTerm: string
}

/**
 * Score a single payee against a normalized description.
 * Returns the best score across all search terms.
 *
 * Scoring tiers:
 *   1.00  exact normalized match
 *   0.95  description contains the full term as a substring
 *   token overlap × 0.85 (scaled)
 *   fuzzy similarity × 0.75 (scaled, fallback)
 */
export function scorePayeeMatch(normalizedDesc: string, payee: Payee): PayeeMatchScore {
  const terms = getPayeeSearchTerms(payee)
  let best = 0
  let bestTerm = ''

  for (const term of terms) {
    if (!term) continue
    let score = 0

    if (normalizedDesc === term) {
      score = 1.0
    } else if (normalizedDesc.includes(term) && term.length >= 3) {
      // Longer terms get higher contains-score to avoid short false positives
      const lengthBonus = Math.min(1, term.length / 8)
      score = 0.88 + lengthBonus * 0.07 // 0.88–0.95
    } else {
      const overlap = tokenOverlapScore(normalizedDesc, term)
      const fuzzy = fuzzySimilarity(normalizedDesc, term)

      // Token overlap is more reliable for bank descriptions
      score = Math.max(overlap * 0.85, fuzzy * 0.75)
    }

    if (score > best) {
      best = score
      bestTerm = term
    }
  }

  return { payee, score: best, matchedTerm: bestTerm }
}

// ── Confidence thresholds ────────────────────────────────────────────────────

export const CONFIDENCE = {
  AUTO: 0.9, // auto-suggest, no confirmation needed
  CONFIRM: 0.7, // suggest but require user confirmation
  AMBIGUITY_GAP: 0.2, // if top-2 scores are within this gap, require confirmation
} as const

export type MatchConfidence = 'auto' | 'confirm' | 'none'

export interface PayeeMatchResult {
  payee: Payee
  score: number
  matchedTerm: string
  confidence: MatchConfidence
}

// ── Find best match ──────────────────────────────────────────────────────────

/**
 * Find the best payee match for a raw transaction description.
 *
 * @param description  Raw description string (e.g. "AMZN MKTP CA*1A2B TORONTO")
 * @param payees       Active (non-archived) payees
 * @returns            Best match with confidence level, or null if no match
 */
export function findBestPayeeMatch(description: string, payees: Payee[]): PayeeMatchResult | null {
  if (!description.trim() || payees.length === 0) return null

  const normalizedDesc = normalizePayeeText(description)
  if (!normalizedDesc) return null

  // Score all active payees
  const scores = payees
    .filter((p) => !p.isArchived)
    .map((p) => scorePayeeMatch(normalizedDesc, p))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scores.length === 0) return null

  const best = scores[0]
  const second = scores[1]

  // Below minimum threshold — no match
  if (best.score < CONFIDENCE.CONFIRM) return null

  // Determine confidence
  let confidence: MatchConfidence
  const isAmbiguous = second !== undefined && best.score - second.score < CONFIDENCE.AMBIGUITY_GAP

  if (best.score >= CONFIDENCE.AUTO && !isAmbiguous) {
    confidence = 'auto'
  } else {
    confidence = 'confirm'
  }

  return {
    payee: best.payee,
    score: best.score,
    matchedTerm: best.matchedTerm,
    confidence,
  }
}
