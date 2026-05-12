import { DEFAULT_PAYEES } from '../../../services/defaults'
import type { Payee } from '../../../types'
import {
  CONFIDENCE,
  normalizePayeeText,
  fuzzySimilarity,
  tokenOverlapScore,
} from '../../../utils/payeeMatching'

export type ImportPayeeConfidence = 'confident' | 'needs_review' | 'no_match'

export interface ImportPayeeCandidate {
  payeeId: number
  name: string
  score: number
  reason: string
}

export interface ImportPayeeMatchResult {
  rowId: string
  description: string
  date?: string
  amount?: number
  suggestedPayeeId?: number
  suggestedPayeeName?: string
  confidence: ImportPayeeConfidence
  candidatePayees: ImportPayeeCandidate[]
}

// Review UI expects these to be present for display.
export type ImportPayeeReviewRow = Omit<ImportPayeeMatchResult, 'date' | 'amount'> & {
  date: string
  amount: number
}

export interface ImportPayeeMatchSummary {
  rowsFound: number
  validRows: number
  skippedRows: number
  likelyPayeesFound: number
  confidentMatches: number
  uncertainMatches: number
  unmatchedExpenses: number
  newPayeesSuggested: number
}

export interface ImportRowInput {
  rowId: string
  description: string
}

const DEFAULT_PAYEE_TERMS = DEFAULT_PAYEES.map((payee) => ({
  name: payee.name,
  terms: [...new Set([payee.name, ...(payee.aliases ?? [])].map(normalizePayeeText).filter(Boolean))],
}))

function getMatchReason(score: number, termCount: number): string {
  if (score >= 0.99) return 'Exact merchant match'
  if (score >= 0.9) return 'Strong merchant match'
  if (score >= 0.75) return termCount > 1 ? 'Alias overlap' : 'Description overlap'
  return 'Possible match'
}

function scoreTerm(normalizedDesc: string, term: string): number {
  if (!term) return 0
  if (normalizedDesc === term) return 1
  if (normalizedDesc.includes(term) && term.length >= 3) {
    const lengthBonus = Math.min(1, term.length / 8)
    return 0.88 + lengthBonus * 0.07
  }

  const overlap = tokenOverlapScore(normalizedDesc, term)
  const fuzzy = fuzzySimilarity(normalizedDesc, term)
  return Math.max(overlap * 0.85, fuzzy * 0.75)
}

function getImportSearchTerms(payee: Payee): string[] {
  const canonical = typeof payee.name === 'string' ? payee.name : String(payee.name ?? '')
  const normalizedCanonical = normalizePayeeText(canonical)
  const defaultTerms = DEFAULT_PAYEE_TERMS.find(
    (entry) => entry.name.toLowerCase() === canonical.toLowerCase(),
  )?.terms
  return [...new Set([normalizedCanonical, ...(defaultTerms ?? [])].filter(Boolean))]
}

export function findCanonicalDefaultPayeeName(description: string): string | null {
  const normalizedDesc = normalizePayeeText(description)
  if (!normalizedDesc) return null

  let bestName: string | null = null
  let bestScore = 0

  for (const payee of DEFAULT_PAYEE_TERMS) {
    for (const term of payee.terms) {
      const score = scoreTerm(normalizedDesc, term)
      if (score > bestScore) {
        bestScore = score
        bestName = payee.name
      }
    }
  }

  return bestScore >= CONFIDENCE.CONFIRM ? bestName : null
}

export function findCanonicalDefaultPayeeNames(descriptions: string[]): string[] {
  return [...new Set(descriptions.map(findCanonicalDefaultPayeeName).filter((name): name is string => Boolean(name)))]
}

export function findBestImportPayeeMatch(
  description: string,
  payees: Payee[],
  rowId: string,
): ImportPayeeMatchResult | null {
  if (!description.trim() || payees.length === 0) return null

  const normalizedDesc = normalizePayeeText(description)
  if (!normalizedDesc) return null

  const scored = payees
    .filter((payee) => !payee.isArchived)
    .map((payee) => {
      const terms = getImportSearchTerms(payee)
      let bestScore = 0
      let matchedTerm = ''
      for (const term of terms) {
        const score = scoreTerm(normalizedDesc, term)
        if (score > bestScore) {
          bestScore = score
          matchedTerm = term
        }
      }
      return {
        payee,
        score: bestScore,
        matchedTerm,
        termCount: terms.length,
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return {
      rowId,
      description,
      confidence: 'no_match',
      candidatePayees: [],
    }
  }

  const top = scored[0]
  const second = scored[1]
  const ambiguous = second != null && top.score - second.score < CONFIDENCE.AMBIGUITY_GAP

  if (top.score < CONFIDENCE.CONFIRM) {
    return {
      rowId,
      description,
      confidence: 'no_match',
      candidatePayees: scored.slice(0, 3).map((entry) => ({
        payeeId: entry.payee.id as number,
        name: entry.payee.name,
        score: entry.score,
        reason: getMatchReason(entry.score, entry.termCount),
      })),
    }
  }

  const confidence: ImportPayeeConfidence =
    top.score >= CONFIDENCE.AUTO && !ambiguous ? 'confident' : 'needs_review'

  return {
    rowId,
    description,
    suggestedPayeeId: top.payee.id as number,
    suggestedPayeeName: top.payee.name,
    confidence,
    candidatePayees: scored.slice(0, 3).map((entry) => ({
      payeeId: entry.payee.id as number,
      name: entry.payee.name,
      score: entry.score,
      reason: getMatchReason(entry.score, entry.termCount),
    })),
  }
}

export function getImportPayeeMatchSummary(
  rows: ImportRowInput[],
  payees: Payee[],
): ImportPayeeMatchSummary {
  let likelyPayeesFound = 0
  let confidentMatches = 0
  let uncertainMatches = 0
  let unmatchedExpenses = 0

  for (const row of rows) {
    const match = findBestImportPayeeMatch(row.description, payees, row.rowId)
    if (!match || match.confidence === 'no_match') {
      unmatchedExpenses++
      continue
    }

    likelyPayeesFound++
    if (match.confidence === 'confident') {
      confidentMatches++
    } else {
      uncertainMatches++
    }
  }

  return {
    rowsFound: rows.length,
    validRows: rows.length,
    skippedRows: 0,
    likelyPayeesFound,
    confidentMatches,
    uncertainMatches,
    unmatchedExpenses,
    newPayeesSuggested: 0,
  }
}
