interface AddEntityButtonProps {
  label: string
}

export default function AddEntityButton({ label }: AddEntityButtonProps) {
  return (
    <button
      type="submit"
      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-theme-medium border border-theme-border bg-theme-background px-3 text-sm font-medium text-theme-text transition-colors hover:bg-theme-border sm:h-10 sm:min-h-0 sm:w-10 sm:shrink-0 sm:self-center sm:px-0"
      aria-label={label}
      title={label}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4 shrink-0"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
      <span className="sm:hidden">{label}</span>
    </button>
  )
}
