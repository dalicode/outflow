import type { Payee } from '../../../types'
import {
  CONFIDENCE,
  getPayeeSearchTerms,
  normalizePayeeText,
  scorePayeeMatch,
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

function getMatchReason(score: number, termCount: number): string {
  if (score >= 0.99) return 'Exact merchant match'
  if (score >= 0.9) return 'Strong merchant match'
  if (score >= 0.75) return termCount > 1 ? 'Alias overlap' : 'Description overlap'
  return 'Possible match'
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
      const scoredMatch = scorePayeeMatch(normalizedDesc, payee)
      return {
        payee: scoredMatch.payee,
        score: scoredMatch.score,
        matchedTerm: scoredMatch.matchedTerm,
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
        reason: getMatchReason(entry.score, getPayeeSearchTerms(entry.payee).length),
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
      reason: getMatchReason(entry.score, getPayeeSearchTerms(entry.payee).length),
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
