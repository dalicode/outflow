import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'
import { getDropdownFloatingPosition, type FloatingPosition } from '../../utils/floatingPosition'
import Spinner from '../ui/Spinner'
import { type ComboboxOption, getFilteredOptions, hasExactMatch } from './comboboxUtils'

const DROPDOWN_MAX_HEIGHT = 420
const DROPDOWN_GAP = 4
const DROPDOWN_MIN_WIDTH = 240
const DROPDOWN_MAX_WIDTH = 420
const MAX_VISIBLE_OPTION_ROWS = 8
const MIN_ROWS_BEFORE_FLIP = 4
const ROW_HEIGHT = 30
const EMPTY_STATE_HEIGHT = 60

function getDropdownPosition(rect: DOMRect, desiredHeight: number): FloatingPosition {
  const preferredWidth = Math.max(
    rect.width,
    Math.min(DROPDOWN_MAX_WIDTH, Math.max(DROPDOWN_MIN_WIDTH, rect.width * 1.2)),
  )

  return getDropdownFloatingPosition(rect, {
    idealHeight: desiredHeight,
    maxHeight: DROPDOWN_MAX_HEIGHT,
    minUsableHeight: MIN_ROWS_BEFORE_FLIP * 30,
    minWidth: DROPDOWN_MIN_WIDTH,
    maxWidth: DROPDOWN_MAX_WIDTH,
    desiredWidth: preferredWidth,
    gap: DROPDOWN_GAP,
  })
}

function getAnchorRect(
  container: HTMLDivElement | null,
  variant: 'default' | 'inline',
): DOMRect | undefined {
  if (!container) return undefined

  if (variant === 'inline') {
    const tableCell = container.closest('td')
    if (tableCell instanceof HTMLTableCellElement) {
      return tableCell.getBoundingClientRect()
    }
  }

  return container.getBoundingClientRect()
}

interface CreatableComboboxProps {
  label?: string
  value?: string | number
  options: ComboboxOption[]
  recentOptions?: ComboboxOption[]
  recentLabel?: string
  placeholder?: string
  emptyMessage?: string
  createLabel?: (query: string) => string
  createHint?: string
  allowCreate?: boolean
  required?: boolean
  disabled?: boolean
  error?: string
  autoOpen?: boolean
  autoFocus?: boolean
  variant?: 'default' | 'inline'
  openOnClick?: boolean
  onChange: (id: string | number | undefined) => void
  onCreate?: (name: string) => Promise<string | number>
  onCancel?: () => void
  onEnterSelect?: (id: string | number | undefined, shiftKey: boolean) => void
  onTabSelect?: (id: string | number | undefined, shiftKey: boolean) => void
  onTab?: (shiftKey: boolean) => void
}

type NavigableItem =
  | { type: 'recent' | 'option'; id: string | number; label: string }
  | { type: 'create'; label: string }

type KeyboardAction = 'enter' | 'tab'
interface CreateInputContext {
  keyboardAction?: KeyboardAction
  shiftKey?: boolean
  onComplete?: () => void
}

export default function CreatableCombobox({
  label,
  value,
  options,
  recentOptions,
  recentLabel = 'Recent',
  placeholder = 'Search...',
  emptyMessage = 'No matches found.',
  createLabel = (query) => `Add "${query.trim()}"`,
  createHint = 'Type a new name to add it.',
  allowCreate = false,
  required = false,
  disabled = false,
  error,
  autoOpen = false,
  autoFocus = false,
  variant = 'default',
  openOnClick = false,
  onChange,
  onCreate,
  onCancel,
  onEnterSelect,
  onTabSelect,
  onTab,
}: CreatableComboboxProps) {
  const [hasTyped, setHasTyped] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const justCreatedRef = useRef(false)
  const isCreatingRef = useRef(false)
  const isUserEditingRef = useRef(false)
  const pendingCommittedLabelRef = useRef<string | null>(null)
  const autoOpenedRef = useRef(false)
  const [dropdownState, setDropdownState] = useState<{
    isOpen: boolean
    pos: FloatingPosition | null
  }>({ isOpen: false, pos: null })

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const optionIdPrefix = useId()

  const selectedOption = useMemo(() => options.find((o) => o.id === value), [options, value])

  const selectedLabel = selectedOption?.label ?? ''

  const [displayQuery, setDisplayQuery] = useState(() => selectedLabel)
  const hasDisplayQuery = displayQuery.trim().length > 0

  const filterText = dropdownState.isOpen && !hasTyped ? '' : displayQuery

  const filtered = useMemo(() => getFilteredOptions(options, filterText), [options, filterText])
  const showRecentSection = Boolean(recentOptions?.length && !filterText.trim())
  const recentIds = useMemo(
    () => new Set((recentOptions ?? []).map((option) => option.id)),
    [recentOptions],
  )
  const recentVisibleOptions = showRecentSection
    ? (recentOptions ?? []).filter((option) => !option.isArchived)
    : []
  const displayOptions = showRecentSection
    ? filtered.filter((option) => !recentIds.has(option.id))
    : filtered

  const showCreateOption =
    allowCreate && onCreate && filterText.trim() && !hasExactMatch(options, filterText)
  const showCreateHint = allowCreate && onCreate && dropdownState.isOpen && !filterText.trim()
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
      items.push({ type: 'create', label: createLabel(filterText) })
    }

    return items
  }, [createLabel, displayOptions, filterText, recentVisibleOptions, showCreateOption])

  const totalItems = navigableItems.length
  const visibleOptionCount = recentVisibleOptions.length + displayOptions.length

  const contentHeight = useMemo(() => {
    let height = 0
    if (showCreateHint) height += ROW_HEIGHT
    if (recentVisibleOptions.length > 0) height += ROW_HEIGHT
    height += recentVisibleOptions.length * ROW_HEIGHT
    height += displayOptions.length * ROW_HEIGHT
    if (showCreateOption) height += ROW_HEIGHT
    if (displayOptions.length === 0 && !showCreateOption && recentVisibleOptions.length === 0) {
      height += EMPTY_STATE_HEIGHT
    }
    return Math.max(ROW_HEIGHT, height)
  }, [displayOptions.length, recentVisibleOptions.length, showCreateHint, showCreateOption])

  const maxVisibleContentHeight = useMemo(() => {
    let chromeHeight = 0
    if (showCreateHint) chromeHeight += ROW_HEIGHT
    if (recentVisibleOptions.length > 0) chromeHeight += ROW_HEIGHT
    if (displayOptions.length > 0 && recentVisibleOptions.length > 0) chromeHeight += ROW_HEIGHT

    const visibleRows = Math.min(
      MAX_VISIBLE_OPTION_ROWS,
      visibleOptionCount + (showCreateOption ? 1 : 0),
    )

    if (visibleRows === 0) {
      return contentHeight
    }

    return chromeHeight + visibleRows * ROW_HEIGHT
  }, [
    contentHeight,
    displayOptions.length,
    recentVisibleOptions.length,
    showCreateHint,
    showCreateOption,
    visibleOptionCount,
  ])

  const resolveDropdownHeight = useCallback(
    (availableHeight: number) => {
      const targetHeight = Math.min(contentHeight, maxVisibleContentHeight)
      if (targetHeight <= availableHeight) return targetHeight
      return Math.max(ROW_HEIGHT, Math.floor(availableHeight / ROW_HEIGHT) * ROW_HEIGHT)
    },
    [contentHeight, maxVisibleContentHeight],
  )

  const desiredDropdownHeight = useMemo(
    () => Math.min(contentHeight, maxVisibleContentHeight),
    [contentHeight, maxVisibleContentHeight],
  )

  const resolvedDropdownHeight = useMemo(() => {
    const availableHeight = dropdownState.pos?.availableHeight
    if (!availableHeight) return null
    return resolveDropdownHeight(availableHeight)
  }, [dropdownState.pos?.availableHeight, resolveDropdownHeight])

  const dropdownTop = useMemo(() => {
    if (!dropdownState.pos || !resolvedDropdownHeight) return null
    if (dropdownState.pos.placement === 'bottom') {
      return dropdownState.pos.top ?? null
    }

    if (dropdownState.pos.bottom == null) return null
    return window.innerHeight - dropdownState.pos.bottom - resolvedDropdownHeight
  }, [dropdownState.pos, resolvedDropdownHeight])

  const updateDropdownPosition = useCallback(() => {
    const rect = getAnchorRect(containerRef.current, variant)
    if (!rect) return
    const nextPos = getDropdownPosition(rect, desiredDropdownHeight)
    setDropdownState((prev) => ({
      ...prev,
      pos: nextPos,
    }))
  }, [desiredDropdownHeight, variant])

  const openDropdown = useCallback(() => {
    if (disabled || isCreating) return
    const currentInputValue = inputRef.current?.value ?? displayQuery
    const hasUserQuery = currentInputValue !== selectedLabel
    const shouldPreserveDraft = isUserEditingRef.current || hasUserQuery

    if (shouldPreserveDraft) {
      isUserEditingRef.current = true
    }

    setDisplayQuery(currentInputValue)
    setHasTyped(shouldPreserveDraft)
    setHighlightedIndex(-1)
    setLocalError(null)
    if (!shouldPreserveDraft) {
      inputRef.current?.select()
    }

    const rect = getAnchorRect(containerRef.current, variant)
    const pos = rect ? getDropdownPosition(rect, desiredDropdownHeight) : null

    setDropdownState({ isOpen: true, pos })
  }, [desiredDropdownHeight, disabled, displayQuery, isCreating, selectedLabel, variant])

  const closeDropdown = useCallback(() => {
    setDropdownState({ isOpen: false, pos: null })
    setHighlightedIndex(-1)
  }, [])

  const handleSelect = useCallback(
    (id: string | number) => {
      const label = options.find((o) => o.id === id)?.label ?? ''
      isUserEditingRef.current = false
      pendingCommittedLabelRef.current = null
      setDisplayQuery(label)
      setHasTyped(false)
      closeDropdown()
      onChange(id)
    },
    [options, closeDropdown, onChange],
  )

  const handleCreate = useCallback(
    async (input?: CreateInputContext) => {
      if (!onCreate || isCreating) return
      const trimmed = filterText.trim()
      if (!trimmed) return
      const keyboardAction = input?.keyboardAction
      const shiftKey = input?.shiftKey ?? false
      const shouldRefocusAfterCreate = keyboardAction == null
      isCreatingRef.current = true
      setIsCreating(true)
      setLocalError(null)
      try {
        const newId = await onCreate(trimmed)
        justCreatedRef.current = true
        isUserEditingRef.current = false
        pendingCommittedLabelRef.current = trimmed
        setDisplayQuery(trimmed)
        setHasTyped(false)
        if (keyboardAction === 'tab' && onTabSelect) {
          onTabSelect(newId, shiftKey)
        } else if (keyboardAction === 'enter' && onEnterSelect) {
          onEnterSelect(newId, shiftKey)
        } else {
          onChange(newId)
        }
        input?.onComplete?.()
        closeDropdown()
      } catch (err) {
        setLocalError((err as Error).message)
      } finally {
        setIsCreating(false)
        isCreatingRef.current = false
        if (shouldRefocusAfterCreate) {
          requestAnimationFrame(() => {
            inputRef.current?.focus()
          })
        }
        setTimeout(() => {
          justCreatedRef.current = false
        }, 150)
      }
    },
    [onCreate, isCreating, filterText, onChange, closeDropdown, onEnterSelect, onTabSelect],
  )

  const getDefaultCommitId = useCallback(() => {
    if (!filterText.trim()) {
      if (!displayQuery.trim()) {
        return undefined
      }

      return options.find((o) => o.label === displayQuery)?.id ?? value
    }

    const firstSelectable = navigableItems.find(
      (item): item is Extract<NavigableItem, { type: 'recent' | 'option' }> =>
        item.type === 'recent' || item.type === 'option',
    )

    return firstSelectable?.id ?? value
  }, [displayQuery, filterText, navigableItems, options, value])

  const getHighlightedCommitId = useCallback(() => {
    const highlightedItem = navigableItems[highlightedIndex]
    if (highlightedItem?.type === 'recent' || highlightedItem?.type === 'option') {
      return highlightedItem.id
    }

    return getDefaultCommitId()
  }, [getDefaultCommitId, highlightedIndex, navigableItems])

  const commitDefaultSelection = useCallback(() => {
    const id = getDefaultCommitId()
    const option = options.find((o) => o.id === id)
    if (filterText.trim() && displayOptions.length === 0) {
      isUserEditingRef.current = false
      setDisplayQuery(selectedLabel)
      setHasTyped(false)
      return
    }
    if (option) {
      isUserEditingRef.current = false
      setDisplayQuery(option.label)
      setHasTyped(false)
    } else if (!displayQuery.trim()) {
      isUserEditingRef.current = false
      setDisplayQuery('')
      setHasTyped(false)
    }
    onChange(id)
  }, [
    displayQuery,
    displayOptions.length,
    filterText,
    getDefaultCommitId,
    onChange,
    options,
    selectedLabel,
  ])

  const handleKeyboardSelection = useCallback(
    (
      id: string | number | undefined,
      shiftKey: boolean,
      keyboardAction: 'enter' | 'tab' = 'enter',
    ) => {
      if (keyboardAction === 'tab' && onTabSelect) {
        onTabSelect(id, shiftKey)
        return
      }
      if (keyboardAction === 'enter' && onEnterSelect) {
        onEnterSelect(id, shiftKey)
        return
      }
      onChange(id)
    },
    [onChange, onEnterSelect, onTabSelect],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDropdown()
        onCancel?.()
        return
      }

      if (!dropdownState.isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openDropdown()
        } else if (e.key === 'Tab') {
          if (onTab) {
            e.preventDefault()
            commitDefaultSelection()
            onTab(e.shiftKey)
          } else {
            closeDropdown()
          }
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          setHighlightedIndex((prev) => {
            if (prev === -1 || prev >= totalItems - 1) return 0
            return prev + 1
          })
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          setHighlightedIndex((prev) => {
            if (prev === -1 || prev <= 0) return totalItems - 1
            return prev - 1
          })
          break
        }
        case 'Enter': {
          e.preventDefault()
          const highlightedItem = navigableItems[highlightedIndex]
          if (highlightedItem?.type === 'create') {
            void handleCreate({ keyboardAction: 'enter', shiftKey: e.shiftKey })
          } else if (highlightedItem?.type === 'recent' || highlightedItem?.type === 'option') {
            const id = highlightedItem.id
            isUserEditingRef.current = false
            setDisplayQuery(highlightedItem.label)
            setHasTyped(false)
            closeDropdown()
            handleKeyboardSelection(id, e.shiftKey)
          } else if (showCreateOption) {
            void handleCreate({ keyboardAction: 'enter', shiftKey: e.shiftKey })
          } else if (getDefaultCommitId() !== undefined) {
            const defaultId = getDefaultCommitId()
            const defaultOption = options.find((option) => option.id === defaultId)
            if (defaultOption) {
              isUserEditingRef.current = false
              setDisplayQuery(defaultOption.label)
              setHasTyped(false)
              closeDropdown()
              handleKeyboardSelection(defaultId, e.shiftKey)
            }
          } else if (!highlightedItem && !hasDisplayQuery) {
            setHasTyped(false)
            closeDropdown()
            handleKeyboardSelection(undefined, e.shiftKey)
          }
          break
        }
        case 'Tab': {
          closeDropdown()
          if (onTab) {
            e.preventDefault()
            const highlightedItem = navigableItems[highlightedIndex]
            if (highlightedItem?.type === 'recent' || highlightedItem?.type === 'option') {
              handleKeyboardSelection(highlightedItem.id, e.shiftKey, 'tab')
              onTab(e.shiftKey)
            } else if (highlightedItem?.type === 'create') {
              void handleCreate({
                keyboardAction: 'tab',
                shiftKey: e.shiftKey,
                onComplete: () => onTab(e.shiftKey),
              })
            } else if (showCreateOption) {
              void handleCreate({
                keyboardAction: 'tab',
                shiftKey: e.shiftKey,
                onComplete: () => onTab(e.shiftKey),
              })
            } else {
              handleKeyboardSelection(getHighlightedCommitId(), e.shiftKey, 'tab')
              onTab(e.shiftKey)
            }
          }
          break
        }
      }
    },
    [
      dropdownState.isOpen,
      totalItems,
      highlightedIndex,
      navigableItems,
      handleCreate,
      closeDropdown,
      openDropdown,
      onCancel,
      onTab,
      showCreateOption,
      getDefaultCommitId,
      options,
      handleKeyboardSelection,
      getHighlightedCommitId,
      commitDefaultSelection,
      hasDisplayQuery,
    ],
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const trimmed = val.trim()
    const nextFiltered = getFilteredOptions(options, val)
    const nextShowCreateOption =
      Boolean(allowCreate && onCreate && trimmed) && !hasExactMatch(options, val)

    isUserEditingRef.current = true
    setDisplayQuery(val)
    setHasTyped(true)
    setLocalError(null)
    if (!trimmed) {
      setHighlightedIndex(-1)
    } else if (nextFiltered.length > 0) {
      // Keep keyboard selection stable as the user types to avoid highlight timing races.
      setHighlightedIndex(0)
    } else if (nextShowCreateOption) {
      setHighlightedIndex(0)
    } else {
      setHighlightedIndex(-1)
    }
    if (!dropdownState.isOpen) {
      const rect = getAnchorRect(containerRef.current, variant)
      setDropdownState({
        isOpen: true,
        pos: rect ? getDropdownPosition(rect, desiredDropdownHeight) : null,
      })
    }
  }

  const handleFocus = () => {
    setLocalError(null)
  }

  const handleBlur = () => {
    if (isCreatingRef.current || justCreatedRef.current) return
    commitDefaultSelection()
    onCancel?.()
    closeDropdown()
  }
  // , 150);
  // };

  useEffect(() => {
    if (!dropdownState.isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current?.contains(e.target as Node) ||
        document.getElementById(listboxId)?.contains(e.target as Node)
      ) {
        e.preventDefault()
        return
      }
    }
    const handleResize = () => updateDropdownPosition()
    const handleScroll = () => updateDropdownPosition()
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [dropdownState.isOpen, listboxId, updateDropdownPosition])

  useLayoutEffect(() => {
    if (autoOpen && !autoOpenedRef.current) {
      autoOpenedRef.current = true
      openDropdown()
    } else if (autoFocus) {
      inputRef.current?.focus()
    }
    if (!autoOpen) {
      autoOpenedRef.current = false
    }
  }, [autoOpen, openDropdown, autoFocus])

  useLayoutEffect(() => {
    if (!dropdownState.isOpen) return
    updateDropdownPosition()
  }, [dropdownState.isOpen, updateDropdownPosition])

  useEffect(() => {
    if (dropdownState.isOpen) return
    if (pendingCommittedLabelRef.current) {
      if (selectedLabel === pendingCommittedLabelRef.current) {
        pendingCommittedLabelRef.current = null
      } else if (!selectedLabel) {
        return
      } else {
        pendingCommittedLabelRef.current = null
      }
    }

    if (!isUserEditingRef.current && !hasTyped) {
      setDisplayQuery(selectedLabel)
    }
  }, [selectedLabel, hasTyped, dropdownState.isOpen])

  useEffect(() => {
    if (!dropdownState.isOpen || highlightedIndex < 0) return

    const optionEl = document.getElementById(`${optionIdPrefix}-${highlightedIndex}`)
    optionEl?.scrollIntoView({ block: 'nearest' })
  }, [dropdownState.isOpen, highlightedIndex, optionIdPrefix])

  useEffect(() => {
    if (!dropdownState.isOpen || !contentRef.current) return
    contentRef.current.scrollTop = 0
  }, [dropdownState.isOpen])

  useEffect(() => {
    if (!dropdownState.isOpen) return
    if (navigableItems.length === 0) {
      if (highlightedIndex !== -1) {
        setHighlightedIndex(-1)
      }
      return
    }

    if (highlightedIndex < 0 || highlightedIndex >= navigableItems.length) {
      setHighlightedIndex(-1)
    }
  }, [dropdownState.isOpen, highlightedIndex, navigableItems.length])

  useEffect(() => {
    if (!dropdownState.isOpen || !hasTyped) return

    if (!filterText.trim()) {
      setHighlightedIndex(-1)
      return
    }

    const firstMatchIndex = navigableItems.findIndex(
      (item) => item.type === 'recent' || item.type === 'option',
    )
    const createIndex =
      firstMatchIndex === -1 ? navigableItems.findIndex((item) => item.type === 'create') : -1
    const nextIndex = firstMatchIndex !== -1 ? firstMatchIndex : createIndex

    setHighlightedIndex(nextIndex)
  }, [dropdownState.isOpen, filterText, hasTyped, navigableItems])

  const highlightedItemClassName =
    'bg-theme-primary-muted text-theme-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--theme-primary)_28%,transparent)]'

  const dropdownContent = dropdownState.isOpen && dropdownState.pos && (
    <div
      id={listboxId}
      data-no-cell-switch
      role="listbox"
      onMouseDown={(e) => e.preventDefault()}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className={cn(
        'fixed z-[60] overflow-hidden rounded-theme-medium border border-theme-border bg-theme-background text-theme-text shadow-lg',
      )}
      style={{
        top: dropdownTop ?? dropdownState.pos.top,
        bottom: dropdownState.pos.placement === 'top' ? dropdownState.pos.bottom : undefined,
        left: dropdownState.pos.left,
        width: dropdownState.pos.width,
        height: resolvedDropdownHeight ?? dropdownState.pos.availableHeight,
        maxHeight: dropdownState.pos.availableHeight,
        boxSizing: 'border-box',
      }}
    >
      <div ref={contentRef} className={cn('h-full overflow-y-auto overscroll-contain')}>
        {showCreateHint && (
          <div className="border-b border-theme-border px-3">
            <div className="flex h-[30px] items-center gap-1.5 text-[11px] leading-4 text-theme-muted">
              <span
                aria-hidden="true"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-theme-primary-subtle text-theme-primary"
              >
                +
              </span>
              <span className="truncate">{createHint}</span>
            </div>
          </div>
        )}
        {recentVisibleOptions.length > 0 && (
          <div className="border-b border-theme-border px-3">
            <div className="flex h-[30px] items-center text-[10px] font-semibold uppercase tracking-wide text-theme-muted">
              {recentLabel}
            </div>
          </div>
        )}
        {recentVisibleOptions.map((opt) => (
          <div
            key={`recent-${opt.id}`}
            id={`${optionIdPrefix}-${navigableItems.findIndex((item) => item.type === 'recent' && item.id === opt.id)}`}
            role="option"
            aria-selected={
              navigableItems[highlightedIndex]?.type === 'recent' &&
              navigableItems[highlightedIndex]?.id === opt.id
            }
            className={cn(
              'flex h-[30px] items-center border-b border-theme-border px-3 text-sm text-theme-text cursor-pointer',
              'transition-[background-color,color,transform] duration-150 motion-safe:active:scale-[0.99]',
              navigableItems[highlightedIndex]?.type === 'recent' &&
                navigableItems[highlightedIndex]?.id === opt.id &&
                highlightedItemClassName,
              opt.id === value && 'bg-theme-primary-subtle',
            )}
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleSelect(opt.id)
            }}
            onMouseEnter={() =>
              setHighlightedIndex(
                navigableItems.findIndex((item) => item.type === 'recent' && item.id === opt.id),
              )
            }
          >
            {opt.label}
          </div>
        ))}
        {displayOptions.length > 0 && recentVisibleOptions.length > 0 && (
          <div className="border-b border-theme-border px-3">
            <div className="flex h-[30px] items-center text-[10px] font-semibold uppercase tracking-wide text-theme-muted">
              All
            </div>
          </div>
        )}
        {displayOptions.map((opt) => {
          const itemIndex = navigableItems.findIndex(
            (item) => item.type === 'option' && item.id === opt.id,
          )

          return (
            <div
              key={opt.id}
              id={`${optionIdPrefix}-${itemIndex}`}
              role="option"
              aria-selected={itemIndex === highlightedIndex}
              className={cn(
                'flex h-[30px] items-center border-b border-theme-border px-3 text-sm cursor-pointer text-theme-text last:border-b-0',
                'transition-[background-color,color,transform] duration-150 motion-safe:active:scale-[0.99]',
                itemIndex === highlightedIndex && highlightedItemClassName,
                opt.id === value && 'font-medium',
              )}
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleSelect(opt.id)
              }}
              onMouseEnter={() => setHighlightedIndex(itemIndex)}
            >
              {opt.label}
            </div>
          )
        })}
        {showCreateOption && (
          <div
            id={`${optionIdPrefix}-${totalItems - 1}`}
            role="option"
            aria-selected={totalItems - 1 === highlightedIndex}
            className={cn(
              'flex h-[30px] items-center border-b border-theme-border px-3 text-sm text-theme-text cursor-pointer',
              'transition-[background-color,color,transform] duration-150 motion-safe:active:scale-[0.99]',
              totalItems - 1 === highlightedIndex && highlightedItemClassName,
            )}
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void handleCreate()
            }}
            onMouseEnter={() => setHighlightedIndex(totalItems - 1)}
          >
            {isCreating ? (
              <span className="flex items-center gap-2 text-theme-text">
                <Spinner size="xs" />
                Adding...
              </span>
            ) : (
              <span className="flex items-center gap-2 text-theme-text">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-theme-primary-subtle text-theme-primary"
                >
                  +
                </span>
                <span>{createLabel(filterText)}</span>
              </span>
            )}
          </div>
        )}
        {displayOptions.length === 0 && !showCreateOption && recentVisibleOptions.length === 0 && (
          <div className="px-3 py-4 text-sm text-theme-text text-center">{emptyMessage}</div>
        )}
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className={cn('relative', variant === 'inline' && 'w-full')}>
      {label && (
        <label className="block text-sm text-theme-muted mb-1">
          {label}
          {required && <span className="text-theme-danger ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          role="combobox"
          aria-label={label}
          aria-expanded={dropdownState.isOpen}
          aria-controls={dropdownState.isOpen ? listboxId : undefined}
          aria-activedescendant={
            dropdownState.isOpen && totalItems > 0 && highlightedIndex >= 0
              ? `${optionIdPrefix}-${highlightedIndex}`
              : undefined
          }
          aria-invalid={Boolean(localError || error)}
          type="text"
          value={displayQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClick={() => {
            if (openOnClick && !dropdownState.isOpen) {
              openDropdown()
            }
          }}
          placeholder={placeholder}
          disabled={disabled || isCreating}
          className={cn(
            'text-sm',
            variant === 'inline' ? 'input-inline' : 'input-md w-full pr-8',
            (localError || error) && (variant === 'inline' ? '' : 'border-theme-danger'),
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
      </div>
      {(localError || error) && (
        <p className="text-theme-danger text-xs mt-1">{localError || error}</p>
      )}
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  )
}
