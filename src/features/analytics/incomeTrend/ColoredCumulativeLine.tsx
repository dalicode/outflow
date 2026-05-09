import { coloredMonotoneSegments } from '../../../utils/chartMath'
import type { ThemeColors } from '../AnalyticsCharts'

interface PointPayload {
  hasData: boolean
  monthIndex: number
}

interface LayoutPoint {
  x: number
  y: number
  value: number
  payload: PointPayload
}

export interface ColoredCumulativeLineProps {
  formattedGraphicalItems?: Array<{
    item: { props: { dataKey: string } }
    props: { points: LayoutPoint[] }
  }>
  colors: ThemeColors
  selectedMonth: number | null
  onSelectMonth: (i: number | null) => void
}

export default function ColoredCumulativeLine({
  formattedGraphicalItems,
  colors,
  selectedMonth,
  onSelectMonth,
}: ColoredCumulativeLineProps) {
  const lineItem = formattedGraphicalItems?.find((item) => item.item.props.dataKey === 'thisYear')
  const points = lineItem?.props.points

  if (!points || points.length < 2) return null

  const values = points.map((p) => p.value)
  const pts = points.map((p) => ({ x: p.x, y: p.y }))
  const segments = coloredMonotoneSegments(pts, values, colors.success, colors.danger)

  return (
    <g>
      {segments.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          fill="none"
          stroke={seg.color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {points.map((p, i) => {
        const isSelected = p.payload.monthIndex === selectedMonth
        if (!p.payload.hasData) {
          return (
            <circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={colors.background}
              stroke={colors.muted}
              strokeWidth={1.5}
              opacity={0.4}
            />
          )
        }
        const rising = values[i] >= (values[i - 1] ?? values[i])
        return (
          <circle
            key={`dot-${i}`}
            cx={p.x}
            cy={p.y}
            r={isSelected ? 6 : 3}
            fill={rising ? colors.success : colors.danger}
            stroke={colors.background}
            strokeWidth={isSelected ? 2 : 0}
            style={{ cursor: 'pointer' }}
            onClick={() =>
              onSelectMonth(selectedMonth === p.payload.monthIndex ? null : p.payload.monthIndex)
            }
          />
        )
      })}
    </g>
  )
}
