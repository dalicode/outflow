import type { MatchConfidence } from '../../utils/payeeMatching'
import type { Payee } from '../../types'

interface PayeeSuggestionBannerProps {
  payeeId: string
  payeeSuggestion: Payee | null
  payeeSuggestionConfidence: MatchConfidence | null
  onAcceptSuggestion: () => void
  onDismissSuggestion: () => void
}

export default function PayeeSuggestionBanner({
  payeeId,
  payeeSuggestion,
  payeeSuggestionConfidence,
  onAcceptSuggestion,
  onDismissSuggestion,
}: PayeeSuggestionBannerProps) {
  if (!payeeSuggestion || payeeId || payeeSuggestionConfidence !== 'confirm') {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2 text-xs">
      <span className="text-theme-muted">
        Suggested payee: <span className="font-medium text-theme-text">{payeeSuggestion.name}</span>
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onAcceptSuggestion}
          className="font-medium text-theme-primary hover:opacity-80"
        >
          Use
        </button>
        <button
          type="button"
          onClick={onDismissSuggestion}
          className="text-theme-muted hover:text-theme-text"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
