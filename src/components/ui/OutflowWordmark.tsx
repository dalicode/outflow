interface OutflowWordmarkProps {
  className?: string
}

export default function OutflowWordmark({ className = '' }: OutflowWordmarkProps) {
  return (
    <svg
      viewBox="0 0 520 80"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      aria-label="Outflow"
    >
      {/* Outflow mark: circle with flowing tail */}
      <g transform="translate(8, 8)">
        {/* Outer ring */}
        <circle
          cx="32"
          cy="32"
          r="28"
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          opacity="0.9"
        />
        {/* Inner dot */}
        <circle cx="32" cy="32" r="10" fill="currentColor" opacity="0.9" />
        {/* Flow tail */}
        <path
          d="M52 52 L68 68"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M58 70 L68 68 L66 58"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </g>

      {/* Outflow wordmark */}
      <text
        x="100"
        y="62"
        fill="currentColor"
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontWeight: 800,
          fontSize: '64px',
          letterSpacing: '-0.04em',
        }}
      >
        Outflow
      </text>
    </svg>
  )
}
