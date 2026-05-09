import { cn } from '../../utils/cn'

const SIZE_MAP = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
} as const

interface SpinnerProps {
  size?: keyof typeof SIZE_MAP
  className?: string
}

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      className={cn(
        SIZE_MAP[size],
        'border-2 border-theme-primary border-t-transparent rounded-full animate-spin inline-block',
        className,
      )}
      aria-hidden="true"
    />
  )
}
