import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ThemeColors } from '../features/analytics/AnalyticsCharts'
import ColoredCumulativeLine from '../features/analytics/incomeTrend/ColoredCumulativeLine'

const colors: ThemeColors = {
  primary: '#2563eb',
  secondary: '#7c3aed',
  success: '#16a34a',
  danger: '#dc2626',
  text: '#111827',
  muted: '#6b7280',
  surface: '#ffffff',
  background: '#f9fafb',
  grid: '#d1d5db',
  chartPalette: ['#2563eb', '#7c3aed'],
}

describe('ColoredCumulativeLine', () => {
  it('emits the clicked monthKey and toggles off the same key', () => {
    const onSelectMonthKey = vi.fn()

    const { container, rerender } = render(
      <svg>
        <ColoredCumulativeLine
          colors={colors}
          selectedMonthKey={null}
          onSelectMonthKey={onSelectMonthKey}
          formattedGraphicalItems={[
            {
              item: { props: { dataKey: 'thisYear' } },
              props: {
                points: [
                  {
                    x: 10,
                    y: 40,
                    value: 100,
                    payload: {
                      hasData: true,
                      monthIndex: 4,
                      monthKey: '2024-05',
                    },
                  },
                  {
                    x: 30,
                    y: 20,
                    value: 200,
                    payload: {
                      hasData: true,
                      monthIndex: 4,
                      monthKey: '2026-05',
                    },
                  },
                ],
              },
            },
          ]}
        />
      </svg>,
    )

    let circles = container.querySelectorAll('circle')
    fireEvent.click(circles[0])
    expect(onSelectMonthKey).toHaveBeenLastCalledWith('2024-05')

    rerender(
      <svg>
        <ColoredCumulativeLine
          colors={colors}
          selectedMonthKey="2024-05"
          onSelectMonthKey={onSelectMonthKey}
          formattedGraphicalItems={[
            {
              item: { props: { dataKey: 'thisYear' } },
              props: {
                points: [
                  {
                    x: 10,
                    y: 40,
                    value: 100,
                    payload: {
                      hasData: true,
                      monthIndex: 4,
                      monthKey: '2024-05',
                    },
                  },
                  {
                    x: 30,
                    y: 20,
                    value: 200,
                    payload: {
                      hasData: true,
                      monthIndex: 4,
                      monthKey: '2026-05',
                    },
                  },
                ],
              },
            },
          ]}
        />
      </svg>,
    )

    circles = container.querySelectorAll('circle')
    fireEvent.click(circles[0])
    expect(onSelectMonthKey).toHaveBeenLastCalledWith(null)
  })
})
