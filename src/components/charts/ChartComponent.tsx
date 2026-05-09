import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import EmptyState from '../../components/ui/EmptyState'
import { useSettings } from '../../context/settingsContext'

interface ChartComponentProps {
  totalFixed: number
  variableExpenses: number
  savings: number
  onSliceClick?: (type: 'fixed' | 'variable' | 'savings') => void
  activeSlice?: 'fixed' | 'variable' | 'savings' | null
}

const SLICE_KEYS: Record<string, 'fixed' | 'variable' | 'savings'> = {
  'Fixed Expenses': 'fixed',
  'Variable Expenses': 'variable',
  Savings: 'savings',
}

export default function ChartComponent({
  totalFixed,
  variableExpenses,
  savings,
  onSliceClick,
  activeSlice,
}: ChartComponentProps) {
  const { currentTheme, currency } = useSettings()

  const data = [
    { name: 'Fixed Expenses', value: totalFixed, key: 'fixed' as const },
    { name: 'Variable Expenses', value: variableExpenses, key: 'variable' as const },
    { name: 'Savings', value: savings, key: 'savings' as const },
  ].filter((d) => d.value > 0)

  const colors = [currentTheme.colors.primary, currentTheme.colors.secondary]

  if (data.length === 0) {
    return <EmptyState message="No data to display yet." padding="py-6" />
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            cursor={onSliceClick ? 'pointer' : 'default'}
            onClick={(_, index) => {
              if (!onSliceClick) return
              const entry = data[index]
              if (entry) onSliceClick(entry.key)
            }}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  /saving/i.test(entry.name)
                    ? currentTheme.colors.success
                    : colors[i % colors.length]
                }
                stroke={activeSlice === entry.key ? currentTheme.colors.text : 'transparent'}
                strokeWidth={activeSlice === entry.key ? 3 : 0}
                style={{
                  filter: activeSlice && activeSlice !== entry.key ? 'opacity(0.4)' : 'opacity(1)',
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => currency(v)} />
          <Legend
            onClick={(e) => {
              if (!onSliceClick || !e?.value) return
              const key = SLICE_KEYS[e.value]
              if (key) onSliceClick(key)
            }}
            wrapperStyle={{ cursor: onSliceClick ? 'pointer' : 'default' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
