/**
 * DatePicker — Custom date picker with portal popup (desktop) or
 * bottom-sheet modal (mobile), keyboard navigation, and month/year selector.
 *
 * State model:
 *   activeDate  → the date being navigated (keyboard/mouse/typing)
 *   viewDate    → the month currently rendered in the calendar grid
 *   textValue   → always mirrors activeDate in the user's dateFormat
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '../../context/settingsContext'
import { cn } from '../../lib/cn'
import type { CalendarDay } from '../../utils/datePickerHelpers'
import {
  addDays,
  addMonths,
  endOfMonth,
  formatISODate,
  getCalendarGrid,
  getMonthName,
  isSameDay,
  isValidISODate,
  parseUserDateInput,
  startOfMonth,
  toISO,
} from '../../utils/datePickerHelpers'
import { getCalendarFloatingPosition, type FloatingPosition } from '../../utils/floatingPosition'
import { triggerHaptic } from '../../lib/haptics'

const POPUP_MAX_HEIGHT = 320
const POPUP_GAP = 4

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

interface DatePickerProps {
  value: string
  onChange: (iso: string) => void
  onCancel?: () => void
  onEnter?: (shiftKey: boolean) => void
  onTab?: (shiftKey: boolean) => void
  autoOpen?: boolean
  autoFocusInput?: boolean
  placeholder?: string
  disabled?: boolean
  variant?: 'default' | 'inline'
  inputStyle?: 'default' | 'inline'
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// ── Shared calendar grid ──────────────────────────────────────────────────────

interface CalendarGridProps {
  calendarDays: CalendarDay[]
  activeDate: Date
  viewDate: Date
  onDayClick: (day: CalendarDay) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  size?: 'sm' | 'lg'
}

function CalendarGrid({
  calendarDays,
  activeDate,
  viewDate,
  onDayClick,
  onPrevMonth,
  onNextMonth,
  size = 'sm',
}: CalendarGridProps) {
  const isLg = size === 'lg'

  return (
    <div className={cn('select-none', isLg ? 'p-2' : 'p-1')}>
      {/* Month/year header */}
      <div className={cn('flex items-center justify-between', isLg ? 'mb-3' : 'mb-2')}>
        <button
          type="button"
          onClick={onPrevMonth}
          className={cn(
            'flex items-center justify-center rounded-theme-medium hover:bg-theme-primary-subtle text-theme-text transition-colors',
            isLg ? 'w-10 h-10' : 'w-7 h-7',
          )}
        >
          <svg
            className={cn(isLg ? 'w-5 h-5' : 'w-3.5 h-3.5')}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className={cn('font-semibold text-theme-text', isLg ? 'text-base' : 'text-sm')}>
          {getMonthName(viewDate.getMonth())} {viewDate.getFullYear()}
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          className={cn(
            'flex items-center justify-center rounded-theme-medium hover:bg-theme-primary-subtle text-theme-text transition-colors',
            isLg ? 'w-10 h-10' : 'w-7 h-7',
          )}
        >
          <svg
            className={cn(isLg ? 'w-5 h-5' : 'w-3.5 h-3.5')}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className={cn(
              'text-center font-medium text-theme-muted',
              isLg ? 'text-xs py-1' : 'text-[10px] py-0.5',
            )}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const dayDate = new Date(day.year, day.month, day.date)
          const isActive = isSameDay(dayDate, activeDate)
          return (
            <button
              key={`${day.year}-${day.month}-${day.date}`}
              type="button"
              onClick={() => onDayClick(day)}
              aria-current={isActive ? 'date' : undefined}
              className={cn(
                'flex items-center justify-center rounded-theme-medium transition-colors',
                isLg ? 'h-10 text-sm' : 'py-1.5 text-xs',
                !day.isCurrentMonth && 'text-theme-muted opacity-40',
                day.isCurrentMonth && !isActive && 'text-theme-text hover:bg-theme-primary-subtle',
                isActive && 'bg-theme-primary text-white font-semibold',
              )}
            >
              {day.date}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DatePicker({
  value,
  onChange,
  onCancel,
  onEnter,
  onTab,
  autoOpen = false,
  autoFocusInput = false,
  placeholder = 'Select date…',
  disabled = false,
  variant = 'default',
  inputStyle,
}: DatePickerProps) {
  const { settings } = useSettings()
  const dateFormat = settings.dateFormat
  const hapticsEnabled = settings.hapticsEnabled
  const resolvedInputStyle = inputStyle ?? variant

  const [activeDate, setActiveDate] = useState<Date>(() => {
    if (value && isValidISODate(value)) return new Date(`${value}T00:00:00`)
    return new Date()
  })

  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value && isValidISODate(value)) return new Date(`${value}T00:00:00`)
    return new Date()
  })

  const [textValue, setTextValue] = useState(() =>
    value && isValidISODate(value) ? formatISODate(value, dateFormat) : '',
  )

  const [isInvalid, setIsInvalid] = useState(false)
  const [popupState, setPopupState] = useState<{
    isOpen: boolean
    pos: FloatingPosition | null
  }>({ isOpen: false, pos: null })
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listboxId = useId()

  // Track mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    setIsMobile(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const calendarDays = getCalendarGrid(viewDate.getFullYear(), viewDate.getMonth())

  const updateActiveDate = useCallback(
    (date: Date) => {
      setActiveDate(date)
      setTextValue(formatISODate(toISO(date), dateFormat))
      if (
        date.getMonth() !== viewDate.getMonth() ||
        date.getFullYear() !== viewDate.getFullYear()
      ) {
        setViewDate(new Date(date.getFullYear(), date.getMonth(), 1))
      }
    },
    [dateFormat, viewDate],
  )

  const openPopup = useCallback(() => {
    if (disabled) return
    inputRef.current?.select()

    const baseDate = value && isValidISODate(value) ? new Date(`${value}T00:00:00`) : new Date()

    setActiveDate(baseDate)
    setTextValue(formatISODate(toISO(baseDate), dateFormat))
    setViewDate(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1))

    const rect = getAnchorRect(containerRef.current, variant)
    const pos = rect
      ? getCalendarFloatingPosition(rect, {
          idealHeight: POPUP_MAX_HEIGHT,
          maxHeight: POPUP_MAX_HEIGHT,
          minUsableHeight: 240,
          minWidth: 280,
          gap: POPUP_GAP,
        })
      : null
    setPopupState({ isOpen: true, pos })
  }, [disabled, value, dateFormat, variant])

  const closePopup = useCallback(() => {
    setPopupState({ isOpen: false, pos: null })
  }, [])

  const commitDate = useCallback(
    (date: Date) => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
        blurTimeoutRef.current = null
      }
      onChange(toISO(date))
      setIsInvalid(false)
      closePopup()
    },
    [onChange, closePopup],
  )

  const commitActiveDate = useCallback(() => {
    commitDate(activeDate)
  }, [commitDate, activeDate])

  const handleDayClick = useCallback(
    (day: CalendarDay) => {
      const d = new Date(day.year, day.month, day.date)
      updateActiveDate(d)
      if (isMobile) triggerHaptic('selection', hapticsEnabled)
      commitDate(d)
    },
    [updateActiveDate, commitDate, isMobile, hapticsEnabled],
  )

  const goToPrevMonth = useCallback(() => setViewDate((vd) => addMonths(vd, -1)), [])
  const goToNextMonth = useCallback(() => setViewDate((vd) => addMonths(vd, 1)), [])

  // Sync from external value when popup is closed
  useEffect(() => {
    if (popupState.isOpen) return
    if (value && isValidISODate(value)) {
      const d = new Date(`${value}T00:00:00`)
      setActiveDate(d)
      setTextValue(formatISODate(value, dateFormat))
      setViewDate(new Date(d.getFullYear(), d.getMonth(), 1))
    }
  }, [value, popupState.isOpen, dateFormat])

  useLayoutEffect(() => {
    if (autoOpen) openPopup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPopup, autoOpen])

  // Click outside (desktop only)
  useEffect(() => {
    if (!popupState.isOpen || isMobile) return
    const updatePos = () => {
      const rect = getAnchorRect(containerRef.current, variant)
      if (!rect) return
      setPopupState((prev) => ({
        ...prev,
        pos: getCalendarFloatingPosition(rect, {
          idealHeight: POPUP_MAX_HEIGHT,
          maxHeight: POPUP_MAX_HEIGHT,
          minUsableHeight: 240,
          minWidth: 280,
          gap: POPUP_GAP,
        }),
      }))
    }
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return
      if (popupRef.current?.contains(e.target as Node)) return
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
        blurTimeoutRef.current = null
      }
      commitActiveDate()
      closePopup()
    }
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    document.addEventListener('mousedown', handleClick)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [popupState.isOpen, isMobile, commitActiveDate, closePopup, variant])

  // Escape key
  useEffect(() => {
    if (!popupState.isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return
      if (e.key === 'Escape') {
        e.preventDefault()
        closePopup()
        onCancel?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [popupState.isOpen, closePopup, onCancel])

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    }
  }, [])

  const handleBlur = () => {
    const formatted = formatISODate(toISO(activeDate), dateFormat)
    if (textValue !== formatted) {
      const parsed = parseUserDateInput(textValue, dateFormat)
      if (!parsed || !isValidISODate(parsed)) {
        setTextValue(formatted)
        setIsInvalid(false)
      }
    }
    blurTimeoutRef.current = setTimeout(() => {
      commitActiveDate()
    }, 0)
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTextValue(val)
    setIsInvalid(false)
    const parsed = parseUserDateInput(val, dateFormat)
    if (parsed && isValidISODate(parsed)) {
      const d = new Date(`${parsed}T00:00:00`)
      setActiveDate(d)
      setViewDate(new Date(d.getFullYear(), d.getMonth(), 1))
    }
  }

  // ── Desktop portal popup ────────────────────────────────────────────────────

  const desktopPopup = !isMobile && popupState.isOpen && popupState.pos && (
    <div
      ref={popupRef}
      id={listboxId}
      data-no-cell-switch
      onMouseDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
      }}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed z-[60] bg-theme-background border border-theme-border rounded-theme-large shadow-xl max-h-[320px] overflow-y-auto"
      style={{
        top: popupState.pos.top,
        bottom: popupState.pos.bottom,
        left: popupState.pos.left,
        width: popupState.pos.width,
        maxHeight: popupState.pos.maxHeight,
      }}
    >
      <CalendarGrid
        calendarDays={calendarDays}
        activeDate={activeDate}
        viewDate={viewDate}
        onDayClick={handleDayClick}
        onPrevMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
        size="sm"
      />
    </div>
  )

  // ── Mobile bottom-sheet (plain portal, no history push) ───────────────────

  const mobileSheet =
    isMobile &&
    popupState.isOpen &&
    createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
        {/* Backdrop — separate element so tap detection is reliable */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => {
            commitActiveDate()
            closePopup()
          }}
        />

        {/* Card */}
        <div
          className="relative bg-theme-surface rounded-theme-large border border-theme-border shadow-xl w-full max-w-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-sm font-semibold text-theme-text">
              {textValue || placeholder}
            </span>
            <button
              type="button"
              onClick={() => {
                commitActiveDate()
                closePopup()
              }}
              className="text-sm font-semibold text-theme-primary"
            >
              Done
            </button>
          </div>

          {/* Calendar */}
          <CalendarGrid
            calendarDays={calendarDays}
            activeDate={activeDate}
            viewDate={viewDate}
            onDayClick={handleDayClick}
            onPrevMonth={goToPrevMonth}
            onNextMonth={goToNextMonth}
            size="sm"
          />
        </div>
      </div>,
      document.body,
    )

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} onMouseDown={(e) => e.stopPropagation()} className="relative">
      {isMobile ? (
        /* Mobile: button trigger — no keyboard */
        <button
          type="button"
          onClick={openPopup}
          disabled={disabled}
          className={cn(
            'text-sm text-left w-full',
            resolvedInputStyle === 'inline' ? 'input-inline pr-5' : 'input-md w-full pr-9',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <span className={textValue ? 'text-theme-text' : 'text-theme-muted opacity-70'}>
            {textValue || placeholder}
          </span>
        </button>
      ) : (
        /* Desktop: text input with keyboard navigation */
        <input
          ref={inputRef}
          type="text"
          value={textValue}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onFocus={() => {
            setIsInvalid(false)
            if (variant === 'inline') openPopup()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              closePopup()
              onCancel?.()
              return
            }
            if (e.key === 'Tab') {
              e.preventDefault()
              closePopup()
              if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current)
                blurTimeoutRef.current = null
              }
              commitActiveDate()
              onTab?.(e.shiftKey)
              return
            }
            if (!popupState.isOpen) {
              if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openPopup()
              }
              return
            }
            switch (e.key) {
              case 'ArrowRight':
                e.preventDefault()
                updateActiveDate(addDays(activeDate, 1))
                break
              case 'ArrowLeft':
                e.preventDefault()
                updateActiveDate(addDays(activeDate, -1))
                break
              case 'ArrowDown':
                e.preventDefault()
                updateActiveDate(addDays(activeDate, 7))
                break
              case 'ArrowUp':
                e.preventDefault()
                updateActiveDate(addDays(activeDate, -7))
                break
              case 'PageDown':
                e.preventDefault()
                updateActiveDate(addMonths(activeDate, 1))
                break
              case 'PageUp':
                e.preventDefault()
                updateActiveDate(addMonths(activeDate, -1))
                break
              case 'Home':
                e.preventDefault()
                updateActiveDate(startOfMonth(activeDate))
                break
              case 'End':
                e.preventDefault()
                updateActiveDate(endOfMonth(activeDate))
                break
              case 'Enter':
                e.preventDefault()
                commitActiveDate()
                onEnter?.(e.shiftKey)
                break
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocusInput}
          className={cn(
            'text-sm',
            resolvedInputStyle === 'inline' ? 'input-inline pr-5' : 'input-md w-full pr-9',
            isInvalid && variant !== 'inline' && 'border-theme-danger',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
      )}
      {isInvalid && !isMobile && (
        <p className="text-theme-danger text-xs mt-1">Invalid date. Use format: {dateFormat}</p>
      )}
      {desktopPopup && createPortal(desktopPopup, document.body)}
      {mobileSheet}
    </div>
  )
}
