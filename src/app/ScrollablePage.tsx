import { useCallback, useEffect, useRef, useState } from 'react'
import PullToRefreshContainer from '../components/ui/PullToRefreshContainer'
import { useScrollActivity } from '../hooks/useScrollActivity'
import { cn } from '../lib/cn'

interface ScrollablePageProps {
  children: React.ReactNode
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
  onRouteChange?: () => void
  bottomSpacerClassName?: string
  onRefresh: () => Promise<void>
}

export default function ScrollablePage({
  children,
  onScroll,
  onRouteChange,
  bottomSpacerClassName,
  onRefresh,
}: ScrollablePageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  )
  const { isScrolling, markScrolling } = useScrollActivity({ enabled: isMobileViewport })
  const showBottomSpacer = bottomSpacerClassName !== 'h-0'

  useEffect(() => {
    ref.current?.scrollTo({ top: 0, behavior: 'auto' })
    onRouteChange?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRouteChange]) // location.key changes on back/forward too

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 640)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleScrollablePageScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      markScrolling()
      onScroll?.(event)
    },
    [markScrolling, onScroll],
  )

  return (
    <PullToRefreshContainer
      ref={ref}
      className={cn(
        'h-full',
        isMobileViewport && 'scrollbar-auto-hide',
        isScrolling && 'is-scrolling',
      )}
      onScroll={handleScrollablePageScroll}
      onRefresh={onRefresh}
    >
      {children}
      {showBottomSpacer && (
        <div
          className={cn('sm:hidden', bottomSpacerClassName ?? 'mobile-bottom-spacer')}
          aria-hidden="true"
        />
      )}
    </PullToRefreshContainer>
  )
}
