import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DashboardMonthStrip from '../features/dashboard/DashboardMonthStrip'

vi.mock('../hooks/useHaptics', () => ({
  useHaptics: () => ({
    selection: vi.fn(),
    light: vi.fn(),
    medium: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('DashboardMonthStrip', () => {
  it('uses selected pill styling in single-month mode', () => {
    const monthStrip = [
      { year: 2026, month: 2, offset: -1 },
      { year: 2026, month: 3, offset: 0 },
      { year: 2026, month: 4, offset: 1 },
    ]

    const { container } = render(
      <DashboardMonthStrip
        selectedYear={2026}
        selectedMonth={3}
        monthSpan={1}
        stripMaxVisible={7}
        monthStrip={monthStrip}
        yearFirstIndices={new Map([[2026, 0]])}
        monthKeys={[{ key: '2026-04' }]}
        onSelectMonth={vi.fn()}
        onCurrent={vi.fn()}
        onStepBack={vi.fn()}
        onStepForward={vi.fn()}
        disableCurrent={false}
      />,
    )

    expect(container.querySelectorAll('.month-pill-selected').length).toBe(1)
    expect(container.querySelectorAll('.month-pill-span-active').length).toBe(0)
  })

  it('uses span-active styling in multi-month mode without selected backgrounds', () => {
    const monthStrip = [
      { year: 2026, month: 1, offset: -2 },
      { year: 2026, month: 2, offset: -1 },
      { year: 2026, month: 3, offset: 0 },
      { year: 2026, month: 4, offset: 1 },
      { year: 2026, month: 5, offset: 2 },
    ]

    const { container } = render(
      <DashboardMonthStrip
        selectedYear={2026}
        selectedMonth={3}
        monthSpan={3}
        stripMaxVisible={7}
        monthStrip={monthStrip}
        yearFirstIndices={new Map([[2026, 0]])}
        monthKeys={[{ key: '2026-02' }, { key: '2026-03' }, { key: '2026-04' }]}
        onSelectMonth={vi.fn()}
        onCurrent={vi.fn()}
        onStepBack={vi.fn()}
        onStepForward={vi.fn()}
        disableCurrent={false}
      />,
    )

    expect(container.querySelectorAll('.month-pill-span-active').length).toBe(3)
    expect(container.querySelectorAll('.month-pill-selected').length).toBe(0)
  })
})
