import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";
import {
  getFilteredOptions,
  hasExactMatch,
  type ComboboxOption,
} from "./comboboxUtils";

interface CreatableComboboxProps {
  label?: string;
  value?: string | number;
  options: ComboboxOption[];
  placeholder?: string;
  emptyMessage?: string;
  createLabel?: (query: string) => string;
  allowCreate?: boolean;
  allowClear?: boolean;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  onChange: (id: string | number | undefined) => void;
  onCreate?: (name: string) => Promise<string | number>;
}

export default function CreatableCombobox({
  label,
  value,
  options,
  placeholder = "Search...",
  emptyMessage = "No matches found.",
  createLabel = (query) => `Add "${query.trim()}"`,
  allowCreate = false,
  allowClear = false,
  required = false,
  disabled = false,
  error,
  onChange,
  onCreate,
}: CreatableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();
  const optionIdPrefix = useId();

  const selectedOption = useMemo(
    () => options.find((o) => o.id === value),
    [options, value]
  );

  const displayValue = isOpen ? query : selectedOption?.label ?? "";

  const filtered = useMemo(
    () => getFilteredOptions(options, query),
    [options, query]
  );

  const showCreateOption =
    allowCreate &&
    onCreate &&
    query.trim() &&
    !hasExactMatch(options, query);

  const totalItems = filtered.length + (showCreateOption ? 1 : 0);
  const createIndex = filtered.length;

  const updateDropdownPosition = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dropdownHeight = 240; // max-h-60
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= dropdownHeight
        ? rect.bottom + 4
        : rect.top - dropdownHeight - 4;
    setDropdownPos({
      top,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled || isCreating) return;
    setQuery(selectedOption?.label ?? "");
    setHighlightedIndex(0);
    setLocalError(null);
    setIsOpen(true);
    requestAnimationFrame(updateDropdownPosition);
  }, [disabled, isCreating, selectedOption, updateDropdownPosition]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setHighlightedIndex(0);
  }, []);

  const handleSelect = useCallback(
    (id: string | number) => {
      onChange(id);
      closeDropdown();
      inputRef.current?.blur();
    },
    [onChange, closeDropdown]
  );

  const handleCreate = useCallback(async () => {
    if (!onCreate || isCreating) return;
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsCreating(true);
    setLocalError(null);
    try {
      const newId = await onCreate(trimmed);
      onChange(newId);
      closeDropdown();
      inputRef.current?.blur();
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  }, [onCreate, isCreating, query, onChange, closeDropdown]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(undefined);
      setQuery("");
      setLocalError(null);
      inputRef.current?.focus();
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDropdown();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev >= totalItems - 1 ? 0 : prev + 1
          );
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev <= 0 ? totalItems - 1 : prev - 1
          );
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (showCreateOption && highlightedIndex === createIndex) {
            handleCreate();
          } else if (filtered[highlightedIndex]) {
            handleSelect(filtered[highlightedIndex].id);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          closeDropdown();
          break;
        }
        case "Tab": {
          closeDropdown();
          break;
        }
      }
    },
    [
      isOpen,
      totalItems,
      showCreateOption,
      highlightedIndex,
      createIndex,
      filtered,
      handleCreate,
      handleSelect,
      closeDropdown,
      openDropdown,
    ]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setHighlightedIndex(0);
    setLocalError(null);
    if (!isOpen) setIsOpen(true);
    requestAnimationFrame(updateDropdownPosition);
  };

  const handleFocus = () => {
    setLocalError(null);
    openDropdown();
  };

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      if (required && !value) {
        setLocalError("This field is required.");
      }
      closeDropdown();
    }, 150);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current?.contains(e.target as Node) ||
        document.getElementById(listboxId)?.contains(e.target as Node)
      ) {
        return;
      }
      closeDropdown();
    };
    const handleResize = () => updateDropdownPosition();
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, listboxId, closeDropdown, updateDropdownPosition]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const dropdownContent = isOpen && dropdownPos && (
    <div
      id={listboxId}
      role="listbox"
      className="fixed z-[60] bg-theme-surface border border-theme-border rounded-theme-medium shadow-lg max-h-60 overflow-y-auto scrollbar-auto-hide"
      style={{
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
      }}
    >
      {filtered.map((opt, i) => (
        <div
          key={opt.id}
          id={`${optionIdPrefix}-${i}`}
          role="option"
          aria-selected={i === highlightedIndex}
          className={cn(
            "px-3 py-2.5 text-sm cursor-pointer transition-colors",
            i === highlightedIndex && "bg-theme-primary/5",
            opt.id === value && "font-medium text-theme-primary"
          )}
          onClick={() => handleSelect(opt.id)}
          onMouseEnter={() => setHighlightedIndex(i)}
        >
          {opt.label}
        </div>
      ))}
      {showCreateOption && (
        <div
          id={`${optionIdPrefix}-${createIndex}`}
          role="option"
          aria-selected={createIndex === highlightedIndex}
          className={cn(
            "px-3 py-2.5 text-sm cursor-pointer transition-colors border-t border-theme-border",
            createIndex === highlightedIndex && "bg-theme-primary/5"
          )}
          onClick={handleCreate}
          onMouseEnter={() => setHighlightedIndex(createIndex)}
        >
          {isCreating ? (
            <span className="flex items-center gap-2 text-theme-primary">
              <span className="w-3.5 h-3.5 border-2 border-theme-primary border-t-transparent rounded-full animate-spin" />
              Adding...
            </span>
          ) : (
            <span className="text-theme-primary">+ {createLabel(query)}</span>
          )}
        </div>
      )}
      {filtered.length === 0 && !showCreateOption && (
        <div className="px-3 py-4 text-sm text-theme-muted text-center">
          {emptyMessage}
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-medium text-theme-muted mb-1">
          {label}
          {required && <span className="text-theme-danger ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={
            isOpen && totalItems > 0
              ? `${optionIdPrefix}-${highlightedIndex}`
              : undefined
          }
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled || isCreating}
          className={cn(
            "input-theme w-full px-3 py-2 text-sm pr-8",
            (localError || error) && "border-theme-danger",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
        {allowClear && value != null && !disabled && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-text text-lg leading-none"
            aria-label="Clear selection"
          >
            &times;
          </button>
        )}
      </div>
      {(localError || error) && (
        <p className="text-theme-danger text-xs mt-1">{localError || error}</p>
      )}
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
}
