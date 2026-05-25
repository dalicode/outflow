import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FilterModal from '../features/dashboard/FilterModal'

vi.mock('../components/inputs/DatePicker', () => ({
  default: function MockDatePicker({
    value,
    onChange,
    placeholder,
  }: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }) {
    return (
      <input
        aria-label={placeholder ?? 'date'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  },
}))

vi.mock('../hooks/useViewportWidth', () => ({
  useViewportWidth: () => 1024,
}))

describe('FilterModal', () => {
  it('positions the desktop multiselect inside the viewport when opened above', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => {
      return {
        x: 40,
        y: 520,
        top: 520,
        bottom: 560,
        left: 40,
        right: 360,
        width: 320,
        height: 40,
        toJSON: () => ({}),
      } as DOMRect
    })
    vi.stubGlobal('innerHeight', 620)

    render(
      <FilterModal
        isOpen
        onClose={vi.fn()}
        onApply={vi.fn()}
        appliedFilters={{
          filterGlobal: '',
          filterDateFrom: '',
          filterDateTo: '',
          selectedCategories: new Set(),
          selectedPayees: new Set(),
          selectedTags: new Set(),
          filterDescription: '',
          filterAmount: '',
        }}
        categories={[
          { id: 1, name: 'Coffee', isArchived: false },
          { id: 2, name: 'Groceries', isArchived: false },
        ]}
        payees={[
          { id: 1, name: 'Cafe', isArchived: false },
          { id: 2, name: 'Market', isArchived: false },
        ]}
        tags={[
          { id: 1, name: 'Work', isArchived: false },
          { id: 2, name: 'Urgent', isArchived: false },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /select payees/i }))

    const search = screen.getByPlaceholderText('Search payees...') as HTMLInputElement
    const panel = search.closest('.fixed') as HTMLDivElement | null

    expect(panel?.style.top).toBe('')
    expect(Number.parseFloat(panel?.style.bottom ?? '0')).toBe(104)
    expect(panel?.style.maxHeight).toBe('360px')
  })
})
