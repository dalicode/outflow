/**
 * DatePicker — Custom date picker with portal popup, keyboard navigation,
 * and month/year selector. Replaces native <input type="date">.
 *
 * State model:
 *   activeDate  → the date being navigated (keyboard/mouse/typing)
 *   viewDate    → the month currently rendered in the calendar grid
 *   textValue   → always mirrors activeDate in the user's dateFormat
 *
 * Keyboard arrows move activeDate as a real calendar date; the view
 * auto-scrolls when activeDate crosses into a different month.
 */
import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useId,
} from "react";
import { createPortal } from "react-dom";
import { useSettings } from "../../context/settingsContext";
import { cn } from "../../utils/cn";
import {
  getCalendarGrid,
  getMonthName,
  parseUserDateInput,
  formatISODate,
  isValidISODate,
  toISO,
  isSameDay,
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
} from "../../utils/datePickerHelpers";
import type { CalendarDay } from "../../utils/datePickerHelpers";

interface DatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  onCancel?: () => void;
  onTab?: (shiftKey: boolean) => void;
  autoOpen?: boolean;
  placeholder?: string;
  disabled?: boolean;
  variant?: "default" | "inline";
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function DatePicker({
  value,
  onChange,
  onCancel,
  onTab,
  autoOpen = false,
  placeholder = "Select date…",
  disabled = false,
  variant = "default",
}: DatePickerProps) {
  const { settings } = useSettings();
  const dateFormat = settings.dateFormat;

  /* ── state ──────────────────────────────────────────────────────── */

  const [activeDate, setActiveDate] = useState<Date>(() => {
    if (value && isValidISODate(value)) {
      return new Date(value + "T00:00:00");
    }
    return new Date();
  });

  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value && isValidISODate(value)) {
      return new Date(value + "T00:00:00");
    }
    return new Date();
  });

  const [textValue, setTextValue] = useState(() =>
    value && isValidISODate(value) ? formatISODate(value, dateFormat) : "",
  );

  const [isInvalid, setIsInvalid] = useState(false);
  const [popupState, setPopupState] = useState<{
    isOpen: boolean;
    pos: { top: number; left: number; width: number } | null;
  }>({ isOpen: false, pos: null });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();

  /* ── derived data ───────────────────────────────────────────────── */

  const calendarDays = getCalendarGrid(
    viewDate.getFullYear(),
    viewDate.getMonth(),
  );

  /* ── helpers ────────────────────────────────────────────────────── */

  const updateActiveDate = useCallback(
    (date: Date) => {
      setActiveDate(date);
      setTextValue(formatISODate(toISO(date), dateFormat));
      // Scroll the view when active date enters a different month
      if (
        date.getMonth() !== viewDate.getMonth() ||
        date.getFullYear() !== viewDate.getFullYear()
      ) {
        setViewDate(new Date(date.getFullYear(), date.getMonth(), 1));
      }
    },
    [dateFormat, viewDate],
  );

  const openPopup = useCallback(() => {
    if (disabled) return;
    inputRef.current?.select();

    const baseDate =
      value && isValidISODate(value)
        ? new Date(value + "T00:00:00")
        : new Date();

    setActiveDate(baseDate);
    setTextValue(formatISODate(toISO(baseDate), dateFormat));
    setViewDate(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));

    const rect = containerRef.current?.getBoundingClientRect();
    const popupHeight = 280;
    const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
    const pos = rect
      ? {
          top:
            spaceBelow >= popupHeight
              ? rect.bottom + 4
              : Math.max(4, rect.top - popupHeight - 4),
          left: rect.left,
          width: rect.width,
        }
      : null;

    setPopupState({ isOpen: true, pos });
  }, [disabled, value, dateFormat]);

  const closePopup = useCallback(() => {
    setPopupState({ isOpen: false, pos: null });
  }, []);

  const commitDate = useCallback(
    (date: Date) => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      onChange(toISO(date));
      setIsInvalid(false);
      closePopup();
    },
    [onChange, closePopup],
  );

  const commitActiveDate = useCallback(() => {
    commitDate(activeDate);
  }, [commitDate, activeDate]);

  /* ── sync from external value when popup is closed ──────────────── */

  useEffect(() => {
    if (popupState.isOpen) return;
    if (value && isValidISODate(value)) {
      const d = new Date(value + "T00:00:00");
      setActiveDate(d);
      setTextValue(formatISODate(value, dateFormat));
      setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [value, popupState.isOpen, dateFormat]);

  /* ── auto-open ──────────────────────────────────────────────────── */

  useLayoutEffect(() => {
    if (autoOpen) {
      openPopup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── click outside ──────────────────────────────────────────────── */

  useEffect(() => {
    if (!popupState.isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      if (popupRef.current?.contains(e.target as Node)) return;
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      commitActiveDate();
      closePopup();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popupState.isOpen, commitActiveDate, closePopup]);

  /* ── document-level Escape (when input is not focused) ──────────── */

  useEffect(() => {
    if (!popupState.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closePopup();
        onCancel?.();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [popupState.isOpen, closePopup, onCancel]);

  /* ── blur timeout cleanup ───────────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  /* ── event handlers ─────────────────────────────────────────────── */

  const handleBlur = () => {
    // If text is invalid, reset it to the formatted activeDate
    const formatted = formatISODate(toISO(activeDate), dateFormat);
    if (textValue !== formatted) {
      const parsed = parseUserDateInput(textValue, dateFormat);
      if (!parsed || !isValidISODate(parsed)) {
        setTextValue(formatted);
        setIsInvalid(false);
      }
    }

    blurTimeoutRef.current = setTimeout(() => {
      commitActiveDate();
    }, 0);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTextValue(val);
    setIsInvalid(false);

    const parsed = parseUserDateInput(val, dateFormat);
    if (parsed && isValidISODate(parsed)) {
      const d = new Date(parsed + "T00:00:00");
      setActiveDate(d);
      setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  const handleDayClick = useCallback(
    (day: CalendarDay) => {
      const d = new Date(day.year, day.month, day.date);
      updateActiveDate(d);
      commitDate(d);
    },
    [updateActiveDate, commitDate],
  );

  const goToPrevMonth = useCallback(() => {
    setViewDate((vd) => addMonths(vd, -1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setViewDate((vd) => addMonths(vd, 1));
  }, []);

  /* ── render helpers ─────────────────────────────────────────────── */

  const renderDay = (day: CalendarDay) => {
    const dayDate = new Date(day.year, day.month, day.date);
    const isActive = isSameDay(dayDate, activeDate);

    return (
      <button
        key={`${day.year}-${day.month}-${day.date}`}
        type="button"
        onClick={() => handleDayClick(day)}
        className={cn(
          "text-center text-xs py-1 rounded-theme-small transition-colors",
          !day.isCurrentMonth && "text-theme-muted opacity-50",
          day.isCurrentMonth && "text-theme-text",
          isActive &&
            "bg-theme-primary-subtle border border-theme-primary font-medium",
          !isActive && day.isCurrentMonth && "hover:bg-theme-primary-subtle",
        )}
      >
        {day.date}
      </button>
    );
  };

  /* ── popup content ──────────────────────────────────────────────── */

  const popupContent = popupState.isOpen && popupState.pos && (
    <div
      ref={popupRef}
      id={listboxId}
      data-no-cell-switch
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      className="fixed z-[60] bg-theme-background border border-theme-border rounded-theme-medium shadow-lg p-2 scrollbar-auto-hide"
      style={{
        top: popupState.pos.top,
        left: popupState.pos.left,
        minWidth: 240,
        maxWidth: 260,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <button
          type="button"
          onClick={goToPrevMonth}
          className="p-1 rounded-theme-small hover:bg-theme-primary-subtle text-theme-text"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-xs font-semibold text-theme-text px-2 py-1">
          {getMonthName(viewDate.getMonth())} {viewDate.getFullYear()}
        </span>
        <button
          type="button"
          onClick={goToNextMonth}
          className="p-1 rounded-theme-small hover:bg-theme-primary-subtle text-theme-text"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-center text-[10px] font-medium text-theme-muted py-0.5"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Day grid (6 weeks × 7 days) */}
      <div className="grid grid-cols-7 gap-0">
        {calendarDays.map(renderDay)}
      </div>
    </div>
  );

  /* ── main render ────────────────────────────────────────────────── */

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      className="relative"
    >
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={textValue}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onFocus={() => {
            setIsInvalid(false);
            if (variant === "inline") {
              openPopup();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              closePopup();
              onCancel?.();
              return;
            }

            if (e.key === "Tab") {
              e.preventDefault();
              closePopup();
              if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
                blurTimeoutRef.current = null;
              }
              commitActiveDate();
              onTab?.(e.shiftKey);
              return;
            }

            if (!popupState.isOpen) {
              if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPopup();
              }
              return;
            }

            // Popup is open — keyboard navigation moves activeDate
            switch (e.key) {
              case "ArrowRight": {
                e.preventDefault();
                updateActiveDate(addDays(activeDate, 1));
                break;
              }
              case "ArrowLeft": {
                e.preventDefault();
                updateActiveDate(addDays(activeDate, -1));
                break;
              }
              case "ArrowDown": {
                e.preventDefault();
                updateActiveDate(addDays(activeDate, 7));
                break;
              }
              case "ArrowUp": {
                e.preventDefault();
                updateActiveDate(addDays(activeDate, -7));
                break;
              }
              case "PageDown": {
                e.preventDefault();
                updateActiveDate(addMonths(activeDate, 1));
                break;
              }
              case "PageUp": {
                e.preventDefault();
                updateActiveDate(addMonths(activeDate, -1));
                break;
              }
              case "Home": {
                e.preventDefault();
                updateActiveDate(startOfMonth(activeDate));
                break;
              }
              case "End": {
                e.preventDefault();
                updateActiveDate(endOfMonth(activeDate));
                break;
              }
              case "Enter": {
                e.preventDefault();
                commitActiveDate();
                break;
              }
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={variant === "inline"}
          className={cn(
            "text-sm",
            variant === "inline"
              ? "input-inline pr-5"
              : "input-theme w-full px-3 py-2 pr-9",
            isInvalid && (variant === "inline" ? "" : "border-theme-danger"),
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />
        {/* Calendar icon — hidden for now */}
        <button
          type="button"
          onClick={() => {
            if (popupState.isOpen) {
              closePopup();
            } else {
              openPopup();
            }
          }}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-text transition-colors hidden"
          tabIndex={-1}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>
      {isInvalid && (
        <p className="text-theme-danger text-xs mt-1">
          Invalid date. Use format: {dateFormat}
        </p>
      )}
      {popupContent && createPortal(popupContent, document.body)}
    </div>
  );
}
