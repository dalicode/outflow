import { useEffect, useMemo, useRef, useState } from 'react'
import { useToasts } from '../../context/toastContext'
import { cn } from '../../utils/cn'
import { getTagSummaryChipStyle } from '../../utils/tagChip'
import { getFilteredOptions } from './comboboxUtils'
import type { Tag } from '../../types'

interface TagMultiSelectProps {
  tags: Tag[]
  selectedTagIds: number[]
  onChange: (tagIds: number[]) => void
  onCreate: (name: string) => Promise<number>
  label?: string
  placeholder?: string
  variant?: 'default' | 'inline'
  autoFocus?: boolean
  onBlurOutside?: () => void
  onCancel?: () => void
  onEnter?: (shiftKey: boolean) => void
  onTab?: (shiftKey: boolean) => void
  rootClassName?: string
  controlClassName?: string
  chipClassName?: string
  inputClassName?: string
}

export default function TagMultiSelect({
  tags,
  selectedTagIds,
  onChange,
  onCreate,
  label = 'Tags',
  placeholder = 'Select tags',
  variant = 'default',
  autoFocus = false,
  onBlurOutside,
  onCancel,
  onEnter,
  onTab,
  rootClassName,
  controlClassName,
  chipClassName,
  inputClassName,
}: TagMultiSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const { showToast } = useToasts()

  const options = useMemo(
    () =>
      tags
        .filter((tag): tag is Tag & { id: number } => typeof tag.id === 'number')
        .map((tag) => ({ id: tag.id, label: tag.name, tag })),
    [tags],
  )
  const selectedIdSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds])
  const selected = useMemo(
    () => options.filter((option) => selectedIdSet.has(option.id)),
    [options, selectedIdSet],
  )
  const filteredOptions = useMemo(
    () =>
      getFilteredOptions(options, query).map((option) => ({
        ...option,
        isSelected: selectedIdSet.has(option.id),
      })),
    [options, query, selectedIdSet],
  )
  const normalizedQuery = query.trim().toLowerCase()
  const hasQuery = normalizedQuery.length > 0
  const hasExact = options.some((option) => option.label.trim().toLowerCase() === normalizedQuery)
  const canCreate = hasQuery && !hasExact
  const exactMatchOption = options.find((option) => option.label.trim().toLowerCase() === normalizedQuery)
  const isInline = variant === 'inline'
  const dropdownItems = [
    ...filteredOptions.map((option) => ({ type: 'option' as const, option })),
    ...(canCreate ? [{ type: 'create' as const }] : []),
  ]

  useEffect(() => {
    if (!isOpen) return

    const handleDocumentPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown)
    return () => document.removeEventListener('mousedown', handleDocumentPointerDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setHighlightedIndex(0)
  }, [isOpen, query, selectedTagIds])

  const addTagId = (tagId: number) => {
    if (selectedIdSet.has(tagId)) return
    onChange([...selectedTagIds, tagId])
    setQuery('')
    setIsOpen(false)
    setHighlightedIndex(0)
    inputRef.current?.focus()
  }

  const showAlreadySelectedToast = (label: string) => {
    showToast({ message: `${label} is already selected.`, tone: 'warning' })
    inputRef.current?.focus()
  }

  const removeTagId = (tagId: number) => {
    onChange(selectedTagIds.filter((id) => id !== tagId))
    inputRef.current?.focus()
  }

  const handleCreate = async () => {
    const trimmed = query.trim()
    if (!trimmed || isCreating) return
    setIsCreating(true)
    try {
      const id = await onCreate(trimmed)
      onChange(Array.from(new Set([...selectedTagIds, id])))
      setQuery('')
      setIsOpen(false)
      setHighlightedIndex(0)
      inputRef.current?.focus()
    } finally {
      setIsCreating(false)
    }
  }

  const handleEnter = async () => {
    if (!isOpen) {
      if (!hasQuery) return
      setIsOpen(true)
      return
    }
    const highlightedItem = dropdownItems[highlightedIndex]
    if (highlightedItem?.type === 'option') {
      if (highlightedItem.option.isSelected) {
        showAlreadySelectedToast(highlightedItem.option.label)
        return
      }
      addTagId(highlightedItem.option.id)
      return
    }
    if (highlightedItem?.type === 'create') {
      await handleCreate()
      return
    }
    if (exactMatchOption) {
      addTagId(exactMatchOption.id)
      return
    }
    if (canCreate) {
      await handleCreate()
    }
  }

  return (
    <div
      className={cn('relative flex flex-col gap-1', isInline && 'w-full', rootClassName)}
      ref={rootRef}
      data-no-cell-switch={isInline ? true : undefined}
      onPointerDown={isInline ? (event) => event.stopPropagation() : undefined}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null
        if (nextTarget && rootRef.current?.contains(nextTarget)) return
        setIsOpen(false)
        onBlurOutside?.()
      }}
    >
      {!isInline ? <label className="text-sm text-theme-muted">{label}</label> : null}
      <div
        className={cn(
          isInline
            ? 'input-inline flex min-h-8 w-full flex-wrap items-center gap-1 px-1.5 py-1'
            : 'input-md flex min-h-10 w-full flex-wrap items-center gap-1.5',
          isOpen &&
            'border-theme-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_15%,transparent)]',
          controlClassName,
        )}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => {
          inputRef.current?.focus()
        }}
      >
        {selected.map((tag) => (
          <span
            key={tag.id}
            className={cn(
              'inline-flex items-center gap-1 rounded-theme-small border px-2 py-0.5 text-xs',
              tag.tag.isArchived && 'italic',
              chipClassName,
            )}
            style={getTagSummaryChipStyle(tag.tag)}
          >
            <span>{tag.label}</span>
            <button
              type="button"
              aria-label={`Remove tag ${tag.label}`}
              className="text-theme-muted transition-colors hover:text-theme-text"
              onClick={(event) => {
                event.stopPropagation()
                removeTagId(tag.id)
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value
            setQuery(nextQuery)
            setIsOpen(nextQuery.trim().length > 0)
          }}
          onKeyDown={async (event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setIsOpen(true)
              setHighlightedIndex((prev) => (dropdownItems.length === 0 ? 0 : (prev + 1) % dropdownItems.length))
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setIsOpen(true)
              setHighlightedIndex((prev) =>
                dropdownItems.length === 0 ? 0 : (prev - 1 + dropdownItems.length) % dropdownItems.length,
              )
              return
            }
            if (event.key === 'Enter') {
              if (!isOpen && !hasQuery && onEnter) {
                event.preventDefault()
                setIsOpen(false)
                onEnter(event.shiftKey)
                return
              }
              event.preventDefault()
              await handleEnter()
              return
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setIsOpen(false)
              onCancel?.()
              return
            }
            if (event.key === 'Tab' && onTab) {
              event.preventDefault()
              setIsOpen(false)
              onTab(event.shiftKey)
              return
            }
            if (event.key === 'Backspace' && query.length === 0 && selectedTagIds.length > 0) {
              event.preventDefault()
              onChange(selectedTagIds.slice(0, -1))
            }
          }}
          placeholder={selected.length === 0 ? placeholder : ''}
          className={cn('min-w-[7rem] flex-1 bg-transparent text-sm text-theme-text outline-none', inputClassName)}
          autoFocus={autoFocus}
        />
      </div>
      {isOpen && hasQuery ? (
        <div
          className={cn(
            'absolute left-0 right-0 z-50 max-h-56 overflow-y-auto rounded-theme-medium border border-theme-border bg-theme-surface shadow-lg',
            isInline ? 'top-full mt-1' : 'top-full mt-1.5',
          )}
        >
          {filteredOptions.map((option, index) => (
            <button
              key={String(option.id)}
              type="button"
              role="option"
              aria-selected={highlightedIndex === index}
              className={cn(
                'block w-full px-3 py-2 text-left text-sm',
                highlightedIndex === index
                  ? 'bg-theme-primary-subtle text-theme-primary'
                  : 'text-theme-text hover:bg-theme-background',
              )}
              onMouseDown={(event) => {
                event.preventDefault()
                if (option.isSelected) {
                  showAlreadySelectedToast(option.label)
                  return
                }
                addTagId(option.id)
              }}
            >
              <span className="flex items-center justify-between gap-3">
                <span>{option.label}</span>
                {option.isSelected ? <span className="text-xs text-theme-muted">Selected</span> : null}
              </span>
            </button>
          ))}
          {canCreate ? (
            <button
              type="button"
              role="option"
              aria-selected={highlightedIndex === filteredOptions.length}
              className={cn(
                'block w-full border-t border-theme-border px-3 py-2 text-left text-sm',
                highlightedIndex === filteredOptions.length
                  ? 'bg-theme-primary-subtle text-theme-primary'
                  : 'text-theme-primary hover:bg-theme-background',
              )}
              onMouseDown={async (event) => {
                event.preventDefault()
                await handleCreate()
              }}
              disabled={isCreating}
            >
              {`Create "${query.trim()}"`}
            </button>
          ) : null}
          {filteredOptions.length === 0 && !canCreate ? (
            <p className="px-3 py-2 text-xs text-theme-muted">No tags found.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
