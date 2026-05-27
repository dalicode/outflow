import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TagMultiSelect from '@/components/inputs/TagMultiSelect'

const showToastMock = vi.hoisted(() => vi.fn())

vi.mock('@/context/toastContext', () => ({
  useToasts: () => ({
    showToast: showToastMock,
  }),
}))

const baseTags = [
  { id: 1, name: 'Work' },
  { id: 2, name: 'Home' },
  { id: 3, name: 'Fitness' },
]

function TestHarness({
  initialSelectedTagIds = [],
  onCreate = vi.fn(async (name: string) => (name === 'New Tag' ? 99 : 100)),
}: {
  initialSelectedTagIds?: number[]
  onCreate?: (name: string) => Promise<number>
}) {
  const [selectedTagIds, setSelectedTagIds] = React.useState<number[]>(initialSelectedTagIds)
  return (
    <TagMultiSelect
      tags={baseTags}
      selectedTagIds={selectedTagIds}
      onChange={setSelectedTagIds}
      onCreate={onCreate}
    />
  )
}

describe('TagMultiSelect', () => {
  beforeEach(() => {
    showToastMock.mockClear()
  })

  const getTagInput = () => screen.getByRole('textbox')

  it('opens and filters dropdown while typing', () => {
    render(<TestHarness />)
    const input = screen.getByPlaceholderText('Select tags')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'wo' } })

    expect(screen.getByRole('option', { name: 'Work' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Home' })).not.toBeInTheDocument()
  })

  it('clears typed text on blur outside but keeps selected chips', () => {
    render(
      <div>
        <TestHarness initialSelectedTagIds={[1]} />
        <button type="button">Outside</button>
      </div>,
    )

    const input = getTagInput()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'ho' } })
    fireEvent.blur(input, { relatedTarget: screen.getByRole('button', { name: 'Outside' }) })

    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Remove tag Work' })).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('clicking existing tag adds chip and continued typing works', () => {
    render(<TestHarness />)
    const input = screen.getByPlaceholderText('Select tags')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'wo' } })
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Work' }))

    expect(screen.getByRole('button', { name: 'Remove tag Work' })).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    const followUpInput = getTagInput()
    expect(followUpInput).toHaveAttribute('placeholder', '')
    fireEvent.change(followUpInput, { target: { value: 'ho' } })
    expect(screen.getByRole('option', { name: 'Home' })).toBeInTheDocument()
  })

  it('clicking an existing tag option selects it', async () => {
    render(<TestHarness />)
    const input = screen.getByPlaceholderText('Select tags')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'wo' } })

    fireEvent.click(screen.getByRole('option', { name: 'Work' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove tag Work' })).toBeInTheDocument()
    })
  })

  it('Enter with exact existing match selects tag without creating', async () => {
    const onCreate = vi.fn(async () => 50)
    render(<TestHarness onCreate={onCreate} />)

    const input = screen.getByPlaceholderText('Select tags')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'work' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove tag Work' })).toBeInTheDocument()
    })
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('Enter with new tag calls onCreate and clears input', async () => {
    const onCreate = vi.fn(async () => 99)
    render(<TestHarness onCreate={onCreate} />)

    const input = screen.getByPlaceholderText('Select tags')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'New Tag' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith('New Tag')
    })
    await waitFor(() => {
      expect(screen.getByDisplayValue('')).toBeInTheDocument()
    })
  })

  it('Backspace on empty input removes last selected chip', () => {
    render(<TestHarness initialSelectedTagIds={[1, 2]} />)
    const input = getTagInput()
    fireEvent.keyDown(input, { key: 'Backspace' })

    expect(screen.queryByText('Home')).not.toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('chip remove button removes only that chip', () => {
    render(<TestHarness initialSelectedTagIds={[1, 2]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag Work' }))

    expect(screen.queryByRole('button', { name: 'Remove tag Work' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove tag Home' })).toBeInTheDocument()
  })

  it('renders selected chips with the shared expense-view tag styling', () => {
    render(<TestHarness initialSelectedTagIds={[1]} />)

    const chip = screen.getByText('Work').closest('span')
    expect(chip).toHaveStyle({
      backgroundColor: expect.stringContaining('color-mix'),
      borderColor: expect.stringContaining('var(--theme-border)'),
      color: expect.stringContaining('var(--theme-text)'),
    })
  })

  it('shows selected matches in the dropdown and prevents selecting them again', () => {
    render(<TestHarness initialSelectedTagIds={[1]} />)
    const input = getTagInput()
    fireEvent.focus(input)
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'w' } })

    const selectedOption = screen.getByRole('option', { name: /Work Selected/ })
    expect(selectedOption).toBeInTheDocument()

    fireEvent.mouseDown(selectedOption)

    expect(showToastMock).toHaveBeenCalledWith({
      message: 'Work is already selected.',
      tone: 'warning',
    })
    expect(screen.getByRole('button', { name: 'Remove tag Work' })).toBeInTheDocument()
  })

  it('keeps archived selected tags visible but excludes them from selection and exact-match reuse', async () => {
    const onCreate = vi.fn(async () => 55)
    render(
      <TagMultiSelect
        tags={[
          { id: 1, name: 'Work', isArchived: false },
          { id: 2, name: 'Old Tag', isArchived: true },
        ]}
        selectedTagIds={[2]}
        onChange={vi.fn()}
        onCreate={onCreate}
      />,
    )

    expect(screen.getByRole('button', { name: 'Remove tag Old Tag' })).toBeInTheDocument()

    const input = getTagInput()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Old Tag' } })

    expect(screen.queryByRole('option', { name: 'Old Tag' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Create "Old Tag"' })).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith('Old Tag')
    })
  })
})
