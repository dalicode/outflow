/**
 * DatePicker — Custom date picker with portal popup, keyboard navigation,
 * and month/year selector. Replaces native <input type="date">.
 */
import { useState, useRef, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "../../context/settingsContext";
import { cn } from "../../utils/cn";
import {
  getCalendarDays,
  getMonthName,
  parseUserDateInput,
  formatISODate,
  isValidISODate,
} from "../../utils/datePickerHelpers";

interface DatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  onCancel?: () => void;
  onTab?: (shiftKey: boolean) => void;
  autoOpen?: boolean;
  placeholder?: string;
  disabled?: boolean;
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
}: DatePickerProps) {
  const { settings } = useSettings();
  const dateFormat = settings.dateFormat;

  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    const d = value ? new Date(value + "T00:00:00") : new Date();
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(value + "T00:00:00") : new Date();
    return d.getMonth();
  });
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [textValue, setTextValue] = useState(() =>
    value ? formatISODate(value, dateFormat) : "",
  );
  const [isInvalid, setIsInvalid] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hasAutoOpened = useRef(false);
  const hasCommittedRef = useRef(false);
  const textValueRef = useRef(textValue);
  const listboxId = useId();

  useEffect(() => {
    textValueRef.current = textValue;
  }, [textValue]);

  useEffect(() => {
    hasCommittedRef.current = false;
  }, []);

  // Derive calendar data
  const calendarDays = getCalendarDays(viewYear, viewMonth, value);
  const startDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const selectedDayIndex = calendarDays.findIndex((d) => d.isSelected);

  // Popup positioning
  const [popupPos, setPopupPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const updatePopupPosition = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const popupHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= popupHeight
        ? rect.bottom + 4
        : Math.max(4, rect.top - popupHeight - 4);
    setPopupPos({
      top,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  const openPopup = useCallback(() => {
    if (disabled) return;
    // Reset view to selected date or today
    inputRef.current?.select();
    if (value && isValidISODate(value)) {
      const d = new Date(value + "T00:00:00");
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
    setHighlightedIndex(selectedDayIndex >= 0 ? selectedDayIndex : 0);
    setIsOpen(true);
    requestAnimationFrame(updatePopupPosition);
  }, [disabled, value, selectedDayIndex, updatePopupPosition]);

  const closePopup = useCallback(() => {
    setIsOpen(false);
  }, []);

  const commitValue = useCallback(() => {
    if (hasCommittedRef.current) return;
    const val = textValueRef.current.trim();
    if (!val) {
      onCancel?.();
      return;
    }
    const parsed = parseUserDateInput(val, dateFormat);
    if (parsed && isValidISODate(parsed)) {
      onChange(parsed);
    } else {
      onCancel?.();
    }
  }, [dateFormat, onChange, onCancel]);

  const selectDate = useCallback(
    (iso: string) => {
      if (!isValidISODate(iso)) return;
      hasCommittedRef.current = true;
      onChange(iso);
      setIsInvalid(false);
      closePopup();
    },
    [onChange, dateFormat, closePopup],
  );

  // Auto-open on mount
  useEffect(() => {
    if (autoOpen && !hasAutoOpened.current && !disabled) {
      hasAutoOpened.current = true;
      requestAnimationFrame(() => openPopup());
    }
  }, [autoOpen, disabled, openPopup]);

  // Commit on unmount (safety net if parent swaps cell back to <span>)
  useEffect(() => {
    return () => commitValue();
  }, [commitValue]);

  // Close on click outside — always active so we commit even when popup is closed
  // Clicks inside the DatePicker are stopped via onMouseDown stopPropagation
  useEffect(() => {
    const handleClick = () => {
      commitValue();
      closePopup();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [commitValue, closePopup]);

  // Keyboard handling (popup open)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePopup();
        onCancel?.();
        return;
      }
      // Let ArrowLeft/Right move the text caret when the input is focused
      if (
        document.activeElement === inputRef.current &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePopup, onCancel]);

  // Handle text input blur
  const handleBlur = () => {
    commitValue();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextValue(e.target.value);
    setIsInvalid(false);
  };

  // Calendar icon click
  const handleIconClick = () => {
    if (isOpen) {
      closePopup();
    } else {
      openPopup();
    }
  };

  // Popup content
  const popupContent = isOpen && popupPos && (
    <div
      ref={popupRef}
      id={listboxId}
      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
      className="fixed z-[60] bg-theme-surface border border-theme-border rounded-theme-medium shadow-lg p-2 scrollbar-auto-hide"
      style={{
        top: popupPos.top,
        left: popupPos.left,
        minWidth: 240,
        maxWidth: 260,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <button
          type="button"
          onClick={() => {
            setViewMonth((m) => (m === 0 ? 11 : m - 1));
            if (viewMonth === 0) setViewYear((y) => y - 1);
          }}
          className="p-1 rounded-theme-small hover:bg-theme-primary/5 text-theme-text"
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
          {getMonthName(viewMonth)} {viewYear}
        </span>
        <button
          type="button"
          onClick={() => {
            setViewMonth((m) => (m === 11 ? 0 : m + 1));
            if (viewMonth === 11) setViewYear((y) => y + 1);
          }}
          className="p-1 rounded-theme-small hover:bg-theme-primary/5 text-theme-text"
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
      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0">
        {/* Empty slots for weekday alignment */}
        {Array.from({ length: startDayOfWeek }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {calendarDays.map((day, i) => (
          <button
            key={`${day.year}-${day.month}-${day.date}`}
            type="button"
            onClick={() => {
              const iso = `${day.year}-${String(day.month + 1).padStart(2, "0")}-${String(day.date).padStart(2, "0")}`;
              selectDate(iso);
            }}
            onMouseEnter={() => setHighlightedIndex(i)}
            className={cn(
              "text-center text-xs py-1 rounded-theme-small transition-colors text-theme-text",
              day.isSelected && "bg-theme-primary text-white font-semibold",
              !day.isSelected &&
                i === highlightedIndex &&
                "bg-theme-primary/5",
              !day.isSelected &&
                day.isToday &&
                "border border-theme-primary",
              !day.isSelected &&
                !day.isToday &&
                i !== highlightedIndex &&
                "hover:bg-theme-primary/5",
            )}
          >
            {day.date}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={textValue}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onFocus={() => {
            setIsInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              closePopup();
              onCancel?.();
            } else if (e.key === "Tab") {
              e.preventDefault();
              closePopup();
              if (textValue.trim()) {
                const parsed = parseUserDateInput(textValue, dateFormat);
                if (parsed && isValidISODate(parsed)) {
                  onChange(parsed);
                }
              }
              onTab?.(e.shiftKey);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "input-theme w-full px-3 py-2 text-sm pr-9",
            isInvalid && "border-theme-danger",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />
        <button
          type="button"
          onClick={handleIconClick}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-text transition-colors"
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


