import { fireEvent, render, screen } from '@testing-library/react'
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
  it('marks the selected month as the current date in the strip', () => {
    render(
      <DashboardMonthStrip
        selectedYear={2026}
        selectedMonth={3}
        monthSpan={1}
        stripMaxVisible={7}
        monthStrip={[
          { year: 2026, month: 2, offset: -1 },
          { year: 2026, month: 3, offset: 0 },
          { year: 2026, month: 4, offset: 1 },
        ]}
        yearFirstIndices={new Map([[2026, 0]])}
        monthKeys={[{ key: '2026-04' }]}
        onSelectMonth={vi.fn()}
        onCurrent={vi.fn()}
        onStepBack={vi.fn()}
        onStepForward={vi.fn()}
        disableCurrent={false}
      />,
    )

    expect(screen.getByRole('button', { name: 'Apr 2026' })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('button', { name: 'Mar 2026' })).not.toHaveAttribute('aria-current')
  })

  it('calls onSelectMonth only when choosing a different month', () => {
    const onSelectMonth = vi.fn()

    render(
      <DashboardMonthStrip
        selectedYear={2026}
        selectedMonth={3}
        monthSpan={3}
        stripMaxVisible={7}
        monthStrip={[
          { year: 2026, month: 1, offset: -2 },
          { year: 2026, month: 2, offset: -1 },
          { year: 2026, month: 3, offset: 0 },
        ]}
        yearFirstIndices={new Map([[2026, 0]])}
        monthKeys={[{ key: '2026-02' }, { key: '2026-03' }, { key: '2026-04' }]}
        onSelectMonth={onSelectMonth}
        onCurrent={vi.fn()}
        onStepBack={vi.fn()}
        onStepForward={vi.fn()}
        disableCurrent={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Apr 2026' }))
    expect(onSelectMonth).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Mar 2026' }))
    expect(onSelectMonth).toHaveBeenCalledWith(2026, 2)
  })
})
