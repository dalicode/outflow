interface OutflowMarkProps {
  className?: string
}

export default function OutflowMark({ className = '' }: OutflowMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      aria-label="Outflow"
    >
      {/* Outer ring */}
      <circle
        cx="28"
        cy="28"
        r="22"
        stroke="currentColor"
        strokeWidth="5"
        fill="none"
        opacity="0.9"
      />
      {/* Inner dot */}
      <circle cx="28" cy="28" r="8" fill="currentColor" opacity="0.9" />
      {/* Flow tail */}
      <path
        d="M44 44 L58 58"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M49 60 L58 58 L56 49"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  )
}
