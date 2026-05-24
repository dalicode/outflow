import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils/cn'
import { getDropdownFloatingPosition, type FloatingPosition } from '../../utils/floatingPosition'
import SingleSelectTrigger from './SingleSelectTrigger'
import { type ComboboxOption, getFilteredOptions, hasExactMatch } from './comboboxUtils'

const DROPDOWN_GAP = 4
const DROPDOWN_PANEL_MAX_HEIGHT = 420
const SEARCH_SECTION_HEIGHT = 57
const CONTENT_TOP_PADDING = 3
const CONTENT_BOTTOM_PADDING = 5
const CONTENT_VERTICAL_PADDING = CONTENT_TOP_PADDING + CONTENT_BOTTOM_PADDING
const CONTENT_SIDE_PADDING = 3
const MAX_VISIBLE_OPTION_ROWS = 6
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
  ariaLabel?: string
  preserveOrder?: boolean
  searchable?: boolean
  triggerSize?: 'md' | 'sm'
  triggerClassName?: string
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
  ariaLabel,
  preserveOrder = false,
  searchable = true,
  triggerSize = 'md',
  triggerClassName,
  onChange,
  onCreate,
}: DesktopDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hasTyped, setHasTyped] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [panelStyle, setPanelStyle] = useState<FloatingPosition | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lastAutoHighlightQueryRef = useRef('')
  const isSmallTrigger = triggerSize === 'sm'
  const sectionLabelHeight = isSmallTrigger ? 28 : 30
  const optionRowHeight = isSmallTrigger ? 28 : 30
  const createHintHeight = isSmallTrigger ? 28 : 30
  const createRowHeight = isSmallTrigger ? 28 : 30
  const clearRowHeight = isSmallTrigger ? 28 : 30
  const emptyStateHeight = isSmallTrigger ? 56 : 60

  useEffect(() => {
    if (!autoFocus) return
    const timer = window.setTimeout(() => setIsOpen(true), 50)
    return () => window.clearTimeout(timer)
  }, [autoFocus])

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value),
    [options, value],
  )

  const filteredOptions = useMemo(() => {
    if (!preserveOrder) {
      return getFilteredOptions(options, query)
    }

    const activeOptions = options.filter((option) => !option.isArchived)
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return activeOptions
    }

    return activeOptions.filter((option) =>
      option.label.trim().toLowerCase().includes(normalizedQuery),
    )
  }, [options, preserveOrder, query])
  const topSectionHeight = searchable ? SEARCH_SECTION_HEIGHT : 0
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
  }, [allowClear, clearLabel, displayOptions, query, recentVisibleOptions, showCreateOption, value])

  const getDesiredContentViewportHeight = useCallback(() => {
    const visibleOptionRows = Math.min(
      MAX_VISIBLE_OPTION_ROWS,
      recentVisibleOptions.length + displayOptions.length,
    )

    let nonOptionHeight = 0
    if (showCreateHint) nonOptionHeight += createHintHeight
    if (recentVisibleOptions.length > 0) nonOptionHeight += sectionLabelHeight
    if (showRecentSection && displayOptions.length > 0) nonOptionHeight += sectionLabelHeight
    if (displayOptions.length === 0 && query.trim() && !showCreateOption) {
      nonOptionHeight += emptyStateHeight
    }
    if (showCreateOption) {
      nonOptionHeight += createRowHeight
      if (createError) nonOptionHeight += 24
    }
    if (allowClear && value != null) nonOptionHeight += clearRowHeight

    return Math.max(
      optionRowHeight + CONTENT_VERTICAL_PADDING,
      CONTENT_VERTICAL_PADDING + nonOptionHeight + visibleOptionRows * optionRowHeight,
    )
  }, [
    allowClear,
    clearRowHeight,
    createHintHeight,
    createRowHeight,
    createError,
    displayOptions.length,
    emptyStateHeight,
    optionRowHeight,
    query,
    recentVisibleOptions.length,
    sectionLabelHeight,
    showCreateHint,
    showCreateOption,
    showRecentSection,
    value,
  ])

  const getResolvedContentViewportHeight = useCallback(
    (availableHeight: number) => {
      const contentAvailable = Math.max(
        optionRowHeight + CONTENT_VERTICAL_PADDING,
        availableHeight - topSectionHeight,
      )
      return Math.min(getDesiredContentViewportHeight(), contentAvailable)
    },
    [getDesiredContentViewportHeight, optionRowHeight, topSectionHeight],
  )

  const updatePanelPosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const desiredPanelHeight = Math.min(
      DROPDOWN_PANEL_MAX_HEIGHT,
      topSectionHeight + getDesiredContentViewportHeight(),
    )
    const nextPanelStyle = getDropdownFloatingPosition(rect, {
      idealHeight: desiredPanelHeight,
      maxHeight: DROPDOWN_PANEL_MAX_HEIGHT,
      minUsableHeight: topSectionHeight + MIN_ROWS_BEFORE_FLIP * optionRowHeight,
      matchTriggerWidth: true,
      gap: DROPDOWN_GAP,
    })
    setPanelStyle(nextPanelStyle)
  }, [getDesiredContentViewportHeight, optionRowHeight, topSectionHeight])

  const contentMaxHeight = useMemo(() => {
    if (!panelStyle) return optionRowHeight * 4
    return getResolvedContentViewportHeight(panelStyle.availableHeight)
  }, [getResolvedContentViewportHeight, optionRowHeight, panelStyle])

  const panelHeight = useMemo(() => {
    if (!panelStyle) return topSectionHeight + contentMaxHeight
    return Math.min(topSectionHeight + contentMaxHeight, panelStyle.availableHeight)
  }, [contentMaxHeight, panelStyle, topSectionHeight])
  const visibleContentHeight = Math.max(
    optionRowHeight + CONTENT_VERTICAL_PADDING,
    panelHeight - topSectionHeight,
  )
  const panelTop = panelStyle
    ? panelStyle.placement === 'bottom'
      ? panelStyle.top
      : panelStyle.bottom != null
        ? window.innerHeight - panelStyle.bottom - panelHeight
        : 0
    : 0

  useLayoutEffect(() => {
    if (!isOpen) {
      setPanelStyle(null)
      setQuery('')
      setHasTyped(false)
      setHighlightedIndex(-1)
      setIsCreating(false)
      setCreateError(null)
      lastAutoHighlightQueryRef.current = ''
      return
    }
    updatePanelPosition()
    if (searchable) {
      searchInputRef.current?.focus()
    } else {
      panelRef.current?.focus()
    }
  }, [isOpen, searchable, updatePanelPosition])

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
    if (!isOpen || !hasTyped) return
    if (lastAutoHighlightQueryRef.current === query) return

    if (!query.trim()) {
      setHighlightedIndex(-1)
      lastAutoHighlightQueryRef.current = query
      return
    }

    const firstMatchIndex = navigableItems.findIndex(
      (item) => item.type === 'recent' || item.type === 'option',
    )
    const createIndex =
      firstMatchIndex === -1 ? navigableItems.findIndex((item) => item.type === 'create') : -1
    const nextIndex = firstMatchIndex !== -1 ? firstMatchIndex : createIndex

    setHighlightedIndex(nextIndex)
    lastAutoHighlightQueryRef.current = query
  }, [hasTyped, isOpen, query, navigableItems])

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
  const sectionLabelClassName = isSmallTrigger
    ? 'flex h-[28px] items-center px-2 text-[10px] font-medium text-theme-muted'
    : 'flex h-[30px] items-center px-2 text-[11px] font-medium text-theme-muted'
  const optionButtonClassName = isSmallTrigger
    ? 'flex h-[28px] w-full items-center gap-2 rounded-theme-small px-2 text-left text-[11px] transition-colors hover:bg-theme-background'
    : 'flex h-[30px] w-full items-center gap-2 rounded-theme-small px-2 text-left text-sm transition-colors hover:bg-theme-background'
  const emptyStateClassName = isSmallTrigger
    ? 'flex min-h-[56px] items-center justify-center px-3 py-2 text-center text-xs text-theme-muted'
    : 'flex min-h-[60px] items-center justify-center px-4 py-3 text-center text-sm text-theme-muted'
  const createHintClassName = isSmallTrigger
    ? 'flex min-h-[28px] items-center justify-center px-3 py-2 text-center text-[10px] text-theme-muted'
    : 'flex min-h-[30px] items-center justify-center px-4 py-2 text-center text-[11px] text-theme-muted'
  const createErrorClassName = isSmallTrigger
    ? 'px-2 pb-1 text-[10px] text-theme-danger'
    : 'px-2 pb-1 text-xs text-theme-danger'

  return (
    <div className="relative" ref={containerRef}>
      <SingleSelectTrigger
        ref={triggerRef}
        value={selectedOption?.label}
        placeholder={placeholder}
        isOpen={isOpen}
        onClick={() => !disabled && setIsOpen((v) => !v)}
        disabled={disabled}
        ariaLabel={ariaLabel}
        size={triggerSize}
        className={triggerClassName}
      />

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            tabIndex={-1}
            onKeyDown={searchable ? undefined : handleInputKeyDown}
            style={{
              position: 'fixed',
              top: panelStyle ? panelTop : 0,
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
            {searchable && (
              <div
                className="border-b border-theme-border bg-theme-background-muted py-2"
                style={{ paddingInline: CONTENT_SIDE_PADDING * 4 }}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setHasTyped(true)
                    setQuery(e.target.value)
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Search..."
                  className="w-full rounded-theme-small border border-theme-border bg-theme-background px-3 py-1.5 text-sm outline-none focus:border-theme-primary"
                />
              </div>
            )}

            <div
              ref={contentRef}
              className="overflow-y-auto overscroll-contain"
              style={{
                height: visibleContentHeight,
                maxHeight: visibleContentHeight,
                paddingTop: CONTENT_TOP_PADDING,
                paddingBottom: CONTENT_BOTTOM_PADDING,
              }}
            >
              <div className="min-h-full">
                {showRecentSection && (
                  <div
                    className="border-b border-theme-border pb-2"
                    style={{ paddingInline: CONTENT_SIDE_PADDING * 4 }}
                  >
                    <div className={sectionLabelClassName}>{recentLabel}</div>
                    {recentVisibleOptions.map((option) => (
                      <button
                        id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'recent' && item.id === option.id)}`}
                        key={option.id}
                        type="button"
                        onClick={() => handleSelect(option.id)}
                        className={cn(
                          optionButtonClassName,
                          isItemHighlighted({
                            type: 'recent',
                            id: option.id,
                            label: option.label,
                          }) && highlightedItemClassName,
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
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {showRecentSection && displayOptions.length > 0 && (
                  <div
                    className="border-b border-theme-border pt-2"
                    style={{ paddingInline: CONTENT_SIDE_PADDING * 4 }}
                  >
                    <div className={sectionLabelClassName}>All</div>
                    {displayOptions.map((option) => (
                      <button
                        id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'option' && item.id === option.id)}`}
                        key={option.id}
                        type="button"
                        onClick={() => handleSelect(option.id)}
                        className={cn(
                          optionButtonClassName,
                          isItemHighlighted({
                            type: 'option',
                            id: option.id,
                            label: option.label,
                          }) && highlightedItemClassName,
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
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!showRecentSection && displayOptions.length > 0 && (
                  <div style={{ paddingInline: CONTENT_SIDE_PADDING * 4 }}>
                    {displayOptions.map((option) => (
                      <button
                        id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'option' && item.id === option.id)}`}
                        key={option.id}
                        type="button"
                        onClick={() => handleSelect(option.id)}
                        className={cn(
                          optionButtonClassName,
                          isItemHighlighted({
                            type: 'option',
                            id: option.id,
                            label: option.label,
                          }) && highlightedItemClassName,
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
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {displayOptions.length === 0 && query.trim() && !showCreateOption && (
                  <div className={emptyStateClassName}>{emptyMessage}</div>
                )}

                {showCreateOption && (
                  <div
                    className="border-t border-theme-border"
                    style={{ paddingInline: CONTENT_SIDE_PADDING * 4 }}
                  >
                    <button
                      id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'create')}`}
                      type="button"
                      onClick={handleCreate}
                      disabled={isCreating}
                      className={cn(
                        optionButtonClassName,
                        'text-theme-primary disabled:opacity-50',
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
                        className={cn('shrink-0', isSmallTrigger ? 'h-3.5 w-3.5' : 'h-4 w-4')}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                      </svg>
                      <span className="min-w-0 flex-1 truncate">
                        Create &quot;{query.trim()}&quot;
                      </span>
                    </button>
                    {createError && <p className={createErrorClassName}>{createError}</p>}
                  </div>
                )}
                {showCreateHint && <div className={createHintClassName}>{createHint}</div>}

                {allowClear && value != null && (
                  <div
                    className="border-t border-theme-border"
                    style={{ paddingInline: CONTENT_SIDE_PADDING * 4 }}
                  >
                    <button
                      id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'clear')}`}
                      type="button"
                      onClick={handleClear}
                      className={cn(
                        optionButtonClassName,
                        'text-theme-danger',
                        isItemHighlighted({ type: 'clear', label: clearLabel }) &&
                          highlightedItemClassName,
                      )}
                      onMouseEnter={() =>
                        setHighlightedIndex(
                          navigableItems.findIndex((item) => item.type === 'clear'),
                        )
                      }
                    >
                      <span className="min-w-0 flex-1 truncate">{clearLabel}</span>
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
