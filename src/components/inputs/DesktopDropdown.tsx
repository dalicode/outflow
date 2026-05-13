import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { type ComboboxOption, getFilteredOptions, hasExactMatch } from './comboboxUtils'
import { cn } from '../../utils/cn'
import SingleSelectTrigger from './SingleSelectTrigger'

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
  const [panelStyle, setPanelStyle] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
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

  const updatePanelPosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPanelStyle({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
    })
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setPanelStyle(null)
      setQuery('')
      setHighlightedIndex(0)
      setIsCreating(false)
      setCreateError(null)
      return
    }
    updatePanelPosition()
    setHighlightedIndex(0)
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
      setHighlightedIndex(0)
    }
  }, [highlightedIndex, isOpen, navigableItems.length])

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return

    const optionEl = document.getElementById(`desktop-dropdown-option-${highlightedIndex}`)
    optionEl?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, isOpen])

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
        setHighlightedIndex((prev) => (prev >= navigableItems.length - 1 ? 0 : prev + 1))
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        if (navigableItems.length === 0) return
        setHighlightedIndex((prev) => (prev <= 0 ? navigableItems.length - 1 : prev - 1))
        break
      }
      case 'Enter': {
        e.preventDefault()
        const highlightedItem = navigableItems[highlightedIndex]
        if (!highlightedItem) return
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

    return highlightedItem.id === item.id
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
              position: 'absolute',
              top: panelStyle?.top ?? 0,
              left: panelStyle?.left ?? 0,
              width: panelStyle?.width ?? 0,
              zIndex: 9999,
            }}
            className="rounded-theme-medium border border-theme-border bg-theme-background text-theme-text shadow-xl shadow-black/10 ring-1 ring-[color:color-mix(in_srgb,var(--theme-primary)_10%,transparent)]"
          >
            <div className="border-b border-theme-border bg-theme-background-muted p-2">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setHighlightedIndex(0)
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Search..."
                className="w-full rounded-theme-small border border-theme-border bg-theme-background px-2.5 py-1.5 text-sm outline-none focus:border-theme-primary"
              />
            </div>

            <div className="max-h-60 overflow-y-auto">
              {showRecentSection && (
                <div className="border-b border-theme-border px-2 py-1">
                  <div className="px-2 py-1 text-xs font-medium text-theme-muted">
                    {recentLabel}
                  </div>
                  {recentVisibleOptions.map((option) => (
                    <button
                      id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'recent' && item.id === option.id)}`}
                      key={option.id}
                      type="button"
                      onClick={() => handleSelect(option.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-theme-small px-2 py-1.5 text-left text-sm transition-colors hover:bg-theme-background',
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
                <div className="border-b border-theme-border px-2 py-1">
                  <div className="px-2 py-1 text-xs font-medium text-theme-muted">All</div>
                  {displayOptions.map((option) => (
                    <button
                      id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'option' && item.id === option.id)}`}
                      key={option.id}
                      type="button"
                      onClick={() => handleSelect(option.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-theme-small px-2 py-1.5 text-left text-sm transition-colors hover:bg-theme-background',
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
                <div className="px-2 py-1">
                  {displayOptions.map((option) => (
                    <button
                      id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'option' && item.id === option.id)}`}
                      key={option.id}
                      type="button"
                      onClick={() => handleSelect(option.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-theme-small px-2 py-1.5 text-left text-sm transition-colors hover:bg-theme-background',
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
                <div className="px-4 py-6 text-center text-sm text-theme-muted">{emptyMessage}</div>
              )}

              {showCreateOption && (
                <div className="border-t border-theme-border px-2 py-1">
                  <button
                    id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'create')}`}
                    type="button"
                    onClick={handleCreate}
                    disabled={isCreating}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-theme-small px-2 py-1.5 text-left text-sm text-theme-primary transition-colors hover:bg-theme-background disabled:opacity-50',
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
                <div className="px-4 py-3 text-center text-xs text-theme-muted">{createHint}</div>
              )}

              {allowClear && value != null && (
                <div className="border-t border-theme-border px-2 py-1">
                  <button
                    id={`desktop-dropdown-option-${navigableItems.findIndex((item) => item.type === 'clear')}`}
                    type="button"
                    onClick={handleClear}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-theme-small px-2 py-1.5 text-left text-sm text-theme-danger transition-colors hover:bg-theme-background',
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
          </div>,
          document.body,
        )}
    </div>
  )
}
