import Spinner from './Spinner'
import { cn } from '../../lib/cn'

interface PageSectionFallbackProps {
  title?: string
  minHeightClassName?: string
  size?: 'md' | 'lg'
}

export default function PageSectionFallback({
  title = 'Loading…',
  minHeightClassName = 'min-h-72',
  size = 'md',
}: PageSectionFallbackProps) {
  return (
    <div
      className={cn('w-full mx-auto px-4 py-6', size === 'lg' ? 'max-w-6xl' : 'max-w-4xl')}
      data-testid="page-section-fallback"
    >
      <div
        className={cn(
          'rounded-theme-large border border-theme-border bg-theme-surface flex flex-col items-center justify-center gap-3 px-5',
          minHeightClassName,
        )}
      >
        <Spinner />
        <p className="text-sm font-medium text-theme-text">{title}</p>
      </div>
    </div>
  )
}
