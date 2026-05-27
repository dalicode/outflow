import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getFilteredOptions } from '../../components/inputs/comboboxUtils'
import DatePicker from '../../components/inputs/DatePicker'
import Modal from '../../components/ui/Modal'
import ModalFooter from '../../components/ui/ModalFooter'
import { useViewportWidth } from '../../hooks/useViewportWidth'
import type { Category, Payee, Tag } from '../../types'
import { cn } from '../../utils/cn'
import { getDropdownFloatingPosition, type FloatingPosition } from '../../utils/floatingPosition'
import { toggleInSet } from '../../utils/setUtils'

interface FilterDraft {
  filterGlobal: string
  filterDateFrom: string
  filterDateTo: string
  selectedCategories: Set<string>
  selectedPayees: Set<string>
  selectedTags: Set<string>
  filterNotes: string
  filterAmount: string
}

interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  appliedFilters: FilterDraft
  onApply: (filters: FilterDraft) => void
  categories: Category[]
  payees: Payee[]
  tags: Tag[]
}

const EMPTY_DRAFT: FilterDraft = {
  filterGlobal: '',
  filterDateFrom: '',
  filterDateTo: '',
  selectedCategories: new Set(),
  selectedPayees: new Set(),
  selectedTags: new Set(),
  filterNotes: '',
  filterAmount: '',
}

function MultiSelectDropdown({
  label,
  items,
  selected,
  onToggle,
  onClear,
}: {
  label: string
  items: Array<{ id?: number; name: string }>
  selected: Set<string>
  onToggle: (name: string) => void
  onClear: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobilePickerOpen, setIsMobilePickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isMobile = useViewportWidth() < 640
  const [panelStyle, setPanelStyle] = useState<FloatingPosition | null>(null)

  const updatePanelPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    setPanelStyle(
      getDropdownFloatingPosition(rect, {
        idealHeight: 320,
        maxHeight: 360,
        minUsableHeight: 180,
        matchTriggerWidth: true,
        gap: 4,
      }),
    )
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setPanelStyle(null)
      return
    }

    updatePanelPosition()

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return
      }
      setIsOpen(false)
    }

    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, updatePanelPosition])

  useEffect(() => {
    if (!isMobilePickerOpen) return

    setQuery('')
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus()
    }, 100)

    return () => window.clearTimeout(timer)
  }, [isMobilePickerOpen])

  const options = items.map((item) => ({
    id: item.id ?? item.name,
    label: item.name,
    name: item.name,
  }))

  const filteredOptions = getFilteredOptions(options, query)
  const selectedNames = items.filter((item) => selected.has(item.name)).map((item) => item.name)

  const summary =
    selectedNames.length === 0
      ? `Select ${label.toLowerCase()}`
      : selectedNames.length <= 2
        ? selectedNames.join(', ')
        : `${selectedNames.length} selected`

  const handleTriggerClick = () => {
    if (isMobile) {
      setIsOpen(false)
      setIsMobilePickerOpen(true)
      return
    }

    setIsOpen((open) => !open)
  }

  const optionItems = (
    <div>
      {filteredOptions.map((option) => {
        const isChecked = selected.has(option.name)
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.name)}
            className={cn(
              'flex min-h-10 w-full items-center gap-3 border-b border-theme-border px-2 py-1.5 text-left text-sm transition-colors sm:min-h-8 sm:py-1',
              'hover:bg-theme-border',
              isChecked && 'bg-theme-primary-subtle',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                isChecked
                  ? 'border-theme-primary bg-theme-primary'
                  : 'border-theme-border bg-theme-background',
              )}
            >
              {isChecked && (
                <svg
                  className="h-3 w-3 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="min-w-0 truncate text-theme-text">{option.label}</span>
          </button>
        )
      })}

      {filteredOptions.length === 0 && (
        <p className="px-2.5 py-3 text-center text-xs text-theme-muted">No matches found.</p>
      )}
    </div>
  )

  const desktopOptionList = <div className="mt-2 min-h-0 flex-1 overflow-y-auto">{optionItems}</div>

  const mobileOptionList = <div className="min-h-0 flex-1 overflow-y-auto p-2">{optionItems}</div>

  const selectionFooter = (
    <div className="flex items-center justify-between border-t border-theme-border px-1 pt-2">
      <span className="text-xs text-theme-muted">{selected.size} selected</span>
      <div className="flex items-center gap-3">
        {selected.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-theme-primary hover:opacity-80"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setIsOpen(false)
            setIsMobilePickerOpen(false)
          }}
          className="text-xs font-medium text-theme-primary hover:opacity-80"
        >
          Done
        </button>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="relative flex flex-col">
      <label className="mb-1 block text-sm text-theme-muted">{label}</label>
      <div className="rounded-theme-medium border border-theme-border bg-theme-background">
        <button
          ref={triggerRef}
          type="button"
          onClick={handleTriggerClick}
          className={cn(
            'flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-semibold transition-colors',
            isOpen && 'border-b border-theme-border',
          )}
        >
          <span
            className={cn(
              'min-w-0 truncate',
              selectedNames.length === 0 ? 'text-theme-muted' : 'text-theme-text',
            )}
          >
            {summary}
          </span>
          <svg
            className={cn(
              'h-4 w-4 shrink-0 text-theme-muted transition-transform',
              isOpen && 'rotate-180',
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      <Modal
        isOpen={isMobilePickerOpen}
        onClose={() => setIsMobilePickerOpen(false)}
        title={label}
        size="full"
        mobileActionLabel="Done"
        onMobileAction={() => setIsMobilePickerOpen(false)}
        bodyClassName="overflow-hidden p-0"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-theme-border p-3">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="input-md w-full"
            />
          </div>
          {mobileOptionList}
          <div className="shrink-0 px-3 pb-3">{selectionFooter}</div>
        </div>
      </Modal>
      {isOpen &&
        panelStyle &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[70] flex overflow-hidden rounded-theme-medium border border-theme-border bg-theme-background p-2 shadow-lg"
            style={{
              top: panelStyle.top,
              bottom: panelStyle.placement === 'top' ? panelStyle.bottom : undefined,
              left: panelStyle.left,
              width: panelStyle.width,
              maxHeight: panelStyle.maxHeight,
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="input-md w-full"
              />

              {desktopOptionList}
              <div className="mt-2 shrink-0">{selectionFooter}</div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export default function FilterModal({
  isOpen,
  onClose,
  appliedFilters,
  onApply,
  categories,
  payees,
  tags,
}: FilterModalProps) {
  const [draft, setDraft] = useState<FilterDraft>(EMPTY_DRAFT)
  const draftRef = useRef<FilterDraft>(EMPTY_DRAFT)

  // Sync draft from applied filters when opening
  useEffect(() => {
    if (isOpen) {
      const nextDraft = {
        filterGlobal: appliedFilters.filterGlobal,
        filterDateFrom: appliedFilters.filterDateFrom,
        filterDateTo: appliedFilters.filterDateTo,
        selectedCategories: new Set(appliedFilters.selectedCategories),
        selectedPayees: new Set(appliedFilters.selectedPayees),
        selectedTags: new Set(appliedFilters.selectedTags),
        filterNotes: appliedFilters.filterNotes,
        filterAmount: appliedFilters.filterAmount,
      }
      draftRef.current = nextDraft
      setDraft(nextDraft)
    }
  }, [
    isOpen,
    appliedFilters.filterGlobal,
    appliedFilters.filterDateFrom,
    appliedFilters.filterDateTo,
    appliedFilters.selectedCategories,
    appliedFilters.selectedPayees,
    appliedFilters.selectedTags,
    appliedFilters.filterNotes,
    appliedFilters.filterAmount,
  ])

  const set = (field: keyof FilterDraft) => (val: string) =>
    setDraft((d) => {
      const nextDraft = { ...d, [field]: val }
      draftRef.current = nextDraft
      return nextDraft
    })

  const toggleCategory = (name: string) =>
    setDraft((d) => {
      const nextDraft = {
        ...d,
        selectedCategories: toggleInSet(d.selectedCategories, name),
      }
      draftRef.current = nextDraft
      return nextDraft
    })

  const togglePayee = (name: string) =>
    setDraft((d) => {
      const nextDraft = {
        ...d,
        selectedPayees: toggleInSet(d.selectedPayees, name),
      }
      draftRef.current = nextDraft
      return nextDraft
    })
  const toggleTag = (name: string) =>
    setDraft((d) => {
      const nextDraft = {
        ...d,
        selectedTags: toggleInSet(d.selectedTags, name),
      }
      draftRef.current = nextDraft
      return nextDraft
    })

  const handleClearAll = () => {
    draftRef.current = EMPTY_DRAFT
    setDraft(EMPTY_DRAFT)
  }

  const handleDone = () => {
    onApply(draftRef.current)
    onClose()
  }

  const activeCategories = categories.filter((c) => !c.isArchived)
  const activePayees = payees
    .filter((p) => !p.isArchived)
    .sort((a, b) => a.name.localeCompare(b.name))
  const selectableTags = tags
    .filter((tag) => tag.id != null)
    .map((tag) => ({ id: tag.id, name: tag.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Transactions"
      size="md"
      mobileFullScreen
      footer={
        <ModalFooter>
          <button
            onClick={handleClearAll}
            data-testid="btn-clear-all-filters"
            className="btn-cancel-sm flex-1"
          >
            Clear all
          </button>
          <button
            onClick={handleDone}
            data-testid="btn-apply-filters"
            className="btn-modal-primary flex-1"
          >
            Done
          </button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-theme-muted mb-1">Search</label>
          <input
            type="text"
            value={draft.filterGlobal}
            onChange={(e) => set('filterGlobal')(e.target.value)}
            placeholder="Notes, category, payee, tag, or amount..."
            className="input-md w-full"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-theme-muted mb-1">Date from</label>
            <DatePicker
              value={draft.filterDateFrom}
              onChange={(iso) => set('filterDateFrom')(iso)}
              placeholder="From"
            />
          </div>
          <div>
            <label className="block text-sm text-theme-muted mb-1">Date to</label>
            <DatePicker
              value={draft.filterDateTo}
              onChange={(iso) => set('filterDateTo')(iso)}
              placeholder="To"
            />
          </div>
        </div>

        <MultiSelectDropdown
          label="Payees"
          items={activePayees}
          selected={draft.selectedPayees}
          onToggle={togglePayee}
          onClear={() =>
            setDraft((d) => {
              const nextDraft = { ...d, selectedPayees: new Set<string>() }
              draftRef.current = nextDraft
              return nextDraft
            })
          }
        />

        <MultiSelectDropdown
          label="Categories"
          items={activeCategories}
          selected={draft.selectedCategories}
          onToggle={toggleCategory}
          onClear={() =>
            setDraft((d) => {
              const nextDraft = { ...d, selectedCategories: new Set<string>() }
              draftRef.current = nextDraft
              return nextDraft
            })
          }
        />
        <MultiSelectDropdown
          label="Tags"
          items={selectableTags}
          selected={draft.selectedTags}
          onToggle={toggleTag}
          onClear={() =>
            setDraft((d) => {
              const nextDraft = { ...d, selectedTags: new Set<string>() }
              draftRef.current = nextDraft
              return nextDraft
            })
          }
        />

        <div>
          <label className="block text-sm text-theme-muted mb-1">Notes</label>
          <input
            type="text"
            value={draft.filterNotes}
            onChange={(e) => set('filterNotes')(e.target.value)}
            placeholder="Contains..."
            className="input-md w-full"
          />
        </div>

        <div>
          <label className="block text-sm text-theme-muted mb-1">Amount</label>
          <input
            type="text"
            value={draft.filterAmount}
            onChange={(e) => set('filterAmount')(e.target.value)}
            placeholder="e.g. 12.50"
            className="input-md w-full"
          />
        </div>
      </div>
    </Modal>
  )
}
