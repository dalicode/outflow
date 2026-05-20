import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils/cn'
import {
  getDropdownFloatingPosition,
  type FloatingPosition,
} from '../../utils/floatingPosition'
import SingleSelectTrigger from './SingleSelectTrigger'
import { type ComboboxOption, getFilteredOptions, hasExactMatch } from './comboboxUtils'

const DROPDOWN_GAP = 4
const DROPDOWN_PANEL_MAX_HEIGHT = 420
const SEARCH_SECTION_HEIGHT = 57
const SECTION_LABEL_HEIGHT = 30
const OPTION_ROW_HEIGHT = 30
const CREATE_HINT_HEIGHT = 30
const CREATE_ROW_HEIGHT = 30
const CLEAR_ROW_HEIGHT = 30
const EMPTY_STATE_HEIGHT = 60
const MAX_VISIBLE_OPTION_ROWS = 8
const MIN_ROWS_BEFORE_FLIP = 4

type NavigableItem =
  | { type: 'recent' | 'option'; id: string | number; label: string }
  | { type: 'create'; label: string }
  | { type: 'clear'; label: string }

interface DesktopDropdownProps {
  value?: string | number
  options: ComboboxOption[]
  recentOptions?: ComboboxOption[]
  recentLabel?: string
  placeholder: string
  emptyMessage: string
  createHint?: string
  allowCreate?: boolean
  allowClear?: boolean
  clearLabel?: string
  autoFocus?: boolean
  disabled?: boolean
  onChange: (id: string | number | undefined) => void
  onCreate?: (name: string) => Promise<string | number>
}

export default function DesktopDropdown({
  value,
  options,
  recentOptions,
  recentLabel = 'Recent',
  placeholder,
  emptyMessage,
  createHint = 'Type a new name to add it.',
  allowCreate = false,
  allowClear = false,
  clearLabel = 'Clear selection',
  autoFocus = false,
  disabled,
  onChange,
  onCreate,
}: DesktopDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [panelStyle, setPanelStyle] = useState<FloatingPosition | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!autoFocus) return
    const timer = window.setTimeout(() => setIsOpen(true), 50)
    return () => window.clearTimeout(timer)
  }, [autoFocus])

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value),
    [options, value],
  )

  const filteredOptions = useMemo(() => getFilteredOptions(options, query), [options, query])
  const showRecentSection = Boolean(recentOptions?.length && !query.trim())
  const recentVisibleOptions = showRecentSection
    ? (recentOptions ?? []).filter((option) => !option.isArchived)
    : []
  const recentIds = useMemo(
    () => new Set(recentVisibleOptions.map((option) => option.id)),
    [recentVisibleOptions],
  )
  const displayOptions = showRecentSection
    ? filteredOptions.filter((option) => !recentIds.has(option.id))
    : filteredOptions

  const showCreateOption = allowCreate && onCreate && query.trim() && !hasExactMatch(options, query)
  const showCreateHint = allowCreate && onCreate && !query.trim()
  const navigableItems = useMemo<NavigableItem[]>(() => {
    const items: NavigableItem[] = [
      ...recentVisibleOptions.map((option) => ({
        type: 'recent' as const,
        id: option.id,
        label: option.label,
      })),
      ...displayOptions.map((option) => ({
        type: 'option' as const,
        id: option.id,
        label: option.label,
      })),
    ]

    if (showCreateOption) {
      items.push({ type: 'create', label: `Create "${query.trim()}"` })
    }

    if (allowClear && value != null) {
      items.push({ type: 'clear', label: clearLabel })
    }

    return items
  }, [
    allowClear,
    clearLabel,
    displayOptions,
    query,
    recentVisibleOptions,
    showCreateOption,
    value,
  ])

  const getDesiredContentViewportHeight = useCallback(() => {
    const visibleOptionRows = Math.min(
      MAX_VISIBLE_OPTION_ROWS,
      recentVisibleOptions.length + displayOptions.length,
    )

    let nonOptionHeight = 0
    if (showCreateHint) nonOptionHeight += CREATE_HINT_HEIGHT
    if (recentVisibleOptions.length > 0) nonOptionHeight += SECTION_LABEL_HEIGHT
    if (showRecentSection && displayOptions.length > 0) nonOptionHeight += SECTION_LABEL_HEIGHT
    if (displayOptions.length === 0 && query.trim() && !showCreateOption) {
      nonOptionHeight += EMPTY_STATE_HEIGHT
    }
    if (showCreateOption) {
      nonOptionHeight += CREATE_ROW_HEIGHT
      if (createError) nonOptionHeight += 24
    }
    if (allowClear && value != null) nonOptionHeight += CLEAR_ROW_HEIGHT

    return Math.max(OPTION_ROW_HEIGHT, nonOptionHeight + visibleOptionRows * OPTION_ROW_HEIGHT)
  }, [
    allowClear,
    createError,
    displayOptions.length,
    query,
    recentVisibleOptions.length,
    showCreateHint,
    showCreateOption,
    showRecentSection,
    value,
  ])

  const getResolvedContentViewportHeight = useCallback(
    (availableHeight: number) => {
      const contentAvailable = Math.max(OPTION_ROW_HEIGHT, availableHeight - SEARCH_SECTION_HEIGHT)
      return Math.min(getDesiredContentViewportHeight(), contentAvailable)
    },
    [getDesiredContentViewportHeight],
  )

  const updatePanelPosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const desiredPanelHeight = Math.min(
      DROPDOWN_PANEL_MAX_HEIGHT,
      SEARCH_SECTION_HEIGHT + getDesiredContentViewportHeight(),
    )
    const nextPanelStyle = getDropdownFloatingPosition(rect, {
      idealHeight: desiredPanelHeight,
      maxHeight: DROPDOWN_PANEL_MAX_HEIGHT,
      minUsableHeight: SEARCH_SECTION_HEIGHT + MIN_ROWS_BEFORE_FLIP * OPTION_ROW_HEIGHT,
      matchTriggerWidth: true,
      gap: DROPDOWN_GAP,
    })
    setPanelStyle(nextPanelStyle)
  }, [getDesiredContentViewportHeight])

  const contentMaxHeight = useMemo(() => {
    if (!panelStyle) return OPTION_ROW_HEIGHT * 4
    return getResolvedContentViewportHeight(panelStyle.availableHeight)
  }, [getResolvedContentViewportHeight, panelStyle])

  const panelHeight = useMemo(() => {
    if (!panelStyle) return SEARCH_SECTION_HEIGHT + contentMaxHeight
    return Math.min(SEARCH_SECTION_HEIGHT + contentMaxHeight, panelStyle.availableHeight)
  }, [contentMaxHeight, panelStyle])
  const visibleContentHeight = Math.max(OPTION_ROW_HEIGHT, panelHeight - SEARCH_SECTION_HEIGHT)
  const panelTop = panelStyle
    ? panelStyle.placement === 'bottom'
      ? panelStyle.top
      : panelStyle.bottom != null
        ? window.innerHeight - panelStyle.bottom - panelHeight
        : 0
    : 0

  useEffect(() => {
    if (!isOpen) {
      setPanelStyle(null)
      setQuery('')
      setHighlightedIndex(-1)
      setIsCreating(false)
      setCreateError(null)
      return
    }
    updatePanelPosition()
    searchInputRef.current?.focus()
  }, [isOpen, updatePanelPosition])

  useEffect(() => {
    if (!isOpen) return
    const handleScrollOrResize = () => {
      updatePanelPosition()
    }
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [isOpen, updatePanelPosition])

  useEffect(() => {
    if (!isOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (navigableItems.length === 0) {
      if (highlightedIndex !== -1) {
        setHighlightedIndex(-1)
      }
      return
    }
    if (highlightedIndex < 0 || highlightedIndex >= navigableItems.length) {
      setHighlightedIndex(-1)
    }
  }, [highlightedIndex, isOpen, navigableItems.length])

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return

    const optionEl = document.getElementById(`desktop-dropdown-option-${highlightedIndex}`)
    optionEl?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, isOpen])

  useEffect(() => {
    if (!isOpen || !contentRef.current) return
    contentRef.current.scrollTop = 0
  }, [isOpen])

  const handleSelect = (id: string | number) => {
    onChange(id)
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange(undefined)
    setIsOpen(false)
  }

  const handleCreate = async () => {
    if (!onCreate || !query.trim()) return
    setIsCreating(true)
    setCreateError(null)
    try {
      const id = await onCreate(query.trim())
      onChange(id)
      setIsOpen(false)
      setQuery('')
    } catch (err) {
      setCreateError((err as Error).message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        if (navigableItems.length === 0) return
        setHighlightedIndex((prev) => {
          if (prev === -1 || prev >= navigableItems.length - 1) return 0
          return prev + 1
        })
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        if (navigableItems.length === 0) return
        setHighlightedIndex((prev) => {
          if (prev === -1 || prev <= 0) return navigableItems.length - 1
          return prev - 1
        })
        break
      }
      case 'Enter': {
        e.preventDefault()
        const highlightedItem = navigableItems[highlightedIndex]
        if (!highlightedItem) {
          if (!query.trim() && value != null) {
            handleClear()
          }
          break
        }
        if (highlightedItem.type === 'create') {
          void handleCreate()
        } else if (highlightedItem.type === 'clear') {
          handleClear()
        } else {
          handleSelect(highlightedItem.id)
        }
        break
      }
      case 'Escape': {
        e.preventDefault()
        setIsOpen(false)
        break
      }
      default:
        break
    }
  }

  const isItemHighlighted = (item: NavigableItem): boolean => {
    const highlightedItem = navigableItems[highlightedIndex]
    if (!highlightedItem || highlightedItem.type !== item.type) return false

    if (item.type === 'create' || item.type === 'clear') return true

    return (highlightedItem as { id: string | number }).id === (item as { id: string | number }).id
  }

  const highlightedItemClassName =
    'bg-theme-primary-muted text-theme-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--theme-primary)_28%,transparent)]'

  return (
    <div className="relative" ref={triggerRef}>
      <SingleSelectTrigger
        value={selectedOption?.label}
        placeholder={placeholder}
        isOpen={isOpen}
        onClick={() => !disabled && setIsOpen((v) => !v)}
        disabled={disabled}
      />

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: panelStyle ? panelTop : 0,
              bottom: panelStyle?.placement === 'top' ? panelStyle.bottom : undefined,
              left: panelStyle?.left ?? 0,
              width: panelStyle?.width ?? 0,
              height: panelStyle ? panelHeight : DROPDOWN_PANEL_MAX_HEIGHT,
              maxHeight: panelStyle?.availableHeight ?? DROPDOWN_PANEL_MAX_HEIGHT,
              zIndex: 9999,
            }}
            className={cn(
              'flex overflow-hidden rounded-theme-medium border border-theme-border bg-theme-background text-theme-text shadow-xl shadow-black/10 ring-1 ring-[color:color-mix(in_srgb,var(--theme-primary)_10%,transparent)]',
              'flex-col',
            )}
          >
            <div className="border-b border-theme-border bg-theme-background-muted p-2">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setHighlightedIndex(-1)
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Search..."
                className="w-full rounded-theme-small border border-theme-border bg-theme-background px-2.5 py-1.5 text-sm outline-none focus:border-theme-primary"
              />
            </div>

            <div
              ref={contentRef}
              className="overflow-y-auto overscroll-contain"
              style={{ height: visibleContentHeight, maxHeight: visibleContentHeight }}
            >
              <div className="min-h-full">
                {showRecentSection && (
                  <div className="border-b border-theme-border px-2">
                    <div className="flex h-[30px] items-center px-2 text-[11px] font-medium text-theme-muted">
                      {recentLabel}
                    </div>
                    {recentVisibleOptions.map((option) => (
                      <button
                        id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'recent' && item.id === option.id)}`}
                        key={option.id}
                        type="button"
                        onClick={() => handleSelect(option.id)}
                        className={cn(
                          'flex h-[30px] w-full items-center gap-2 rounded-theme-small px-2 text-left text-sm transition-colors hover:bg-theme-background',
                          isItemHighlighted({ type: 'recent', id: option.id, label: option.label }) &&
                            highlightedItemClassName,
                          option.id === value && 'font-semibold text-theme-primary',
                        )}
                        onMouseEnter={() =>
                          setHighlightedIndex(
                            navigableItems.findIndex(
                              (item) => item.type === 'recent' && item.id === option.id,
                            ),
                          )
                        }
                      >
                        {option.isArchived && (
                          <span className="text-xs text-theme-muted">(archived)</span>
                        )}
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {showRecentSection && displayOptions.length > 0 && (
                  <div className="border-b border-theme-border px-2">
                    <div className="flex h-[30px] items-center px-2 text-[11px] font-medium text-theme-muted">
                      All
                    </div>
                    {displayOptions.map((option) => (
                      <button
                        id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'option' && item.id === option.id)}`}
                        key={option.id}
                        type="button"
                        onClick={() => handleSelect(option.id)}
                        className={cn(
                          'flex h-[30px] w-full items-center gap-2 rounded-theme-small px-2 text-left text-sm transition-colors hover:bg-theme-background',
                          isItemHighlighted({ type: 'option', id: option.id, label: option.label }) &&
                            highlightedItemClassName,
                          option.id === value && 'font-semibold text-theme-primary',
                        )}
                        onMouseEnter={() =>
                          setHighlightedIndex(
                            navigableItems.findIndex(
                              (item) => item.type === 'option' && item.id === option.id,
                            ),
                          )
                        }
                      >
                        {option.isArchived && (
                          <span className="text-xs text-theme-muted">(archived)</span>
                        )}
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!showRecentSection && displayOptions.length > 0 && (
                  <div className="px-2">
                    {displayOptions.map((option) => (
                      <button
                        id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'option' && item.id === option.id)}`}
                        key={option.id}
                        type="button"
                        onClick={() => handleSelect(option.id)}
                        className={cn(
                          'flex h-[30px] w-full items-center gap-2 rounded-theme-small px-2 text-left text-sm transition-colors hover:bg-theme-background',
                          isItemHighlighted({ type: 'option', id: option.id, label: option.label }) &&
                            highlightedItemClassName,
                          option.id === value && 'font-semibold text-theme-primary',
                        )}
                        onMouseEnter={() =>
                          setHighlightedIndex(
                            navigableItems.findIndex(
                              (item) => item.type === 'option' && item.id === option.id,
                            ),
                          )
                        }
                      >
                        {option.isArchived && (
                          <span className="text-xs text-theme-muted">(archived)</span>
                        )}
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {displayOptions.length === 0 && query.trim() && !showCreateOption && (
                  <div className="flex min-h-[60px] items-center justify-center px-4 py-3 text-center text-sm text-theme-muted">
                    {emptyMessage}
                  </div>
                )}

                {showCreateOption && (
                  <div className="border-t border-theme-border px-2">
                    <button
                      id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'create')}`}
                      type="button"
                      onClick={handleCreate}
                      disabled={isCreating}
                      className={cn(
                        'flex h-[30px] w-full items-center gap-2 rounded-theme-small px-2 text-left text-sm text-theme-primary transition-colors hover:bg-theme-background disabled:opacity-50',
                        isItemHighlighted({ type: 'create', label: `Create "${query.trim()}"` }) &&
                          highlightedItemClassName,
                      )}
                      onMouseEnter={() =>
                        setHighlightedIndex(
                          navigableItems.findIndex((item) => item.type === 'create'),
                        )
                      }
                    >
                      <svg
                        className="h-4 w-4 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                      </svg>
                      <span>Create &quot;{query.trim()}&quot;</span>
                    </button>
                    {createError && (
                      <p className="px-2 pb-1 text-xs text-theme-danger">{createError}</p>
                    )}
                  </div>
                )}
                {showCreateHint && (
                  <div className="flex min-h-[30px] items-center justify-center px-4 py-2 text-center text-[11px] text-theme-muted">
                    {createHint}
                  </div>
                )}

                {allowClear && value != null && (
                  <div className="border-t border-theme-border px-2">
                    <button
                      id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'clear')}`}
                      type="button"
                      onClick={handleClear}
                      className={cn(
                        'flex h-[30px] w-full items-center gap-2 rounded-theme-small px-2 text-left text-sm text-theme-danger transition-colors hover:bg-theme-background',
                        isItemHighlighted({ type: 'clear', label: clearLabel }) &&
                          highlightedItemClassName,
                      )}
                      onMouseEnter={() =>
                        setHighlightedIndex(
                          navigableItems.findIndex((item) => item.type === 'clear'),
                        )
                      }
                    >
                      <span>{clearLabel}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
