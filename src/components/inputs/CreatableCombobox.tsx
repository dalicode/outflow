import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
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
  createHint?: string;
  allowCreate?: boolean;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  autoOpen?: boolean;
  variant?: "default" | "inline";
  openOnClick?: boolean;
  onChange: (id: string | number | undefined) => void;
  onCreate?: (name: string) => Promise<string | number>;
  onCancel?: () => void;
  onTab?: (shiftKey: boolean) => void;
}

export default function CreatableCombobox({
  label,
  value,
  options,
  placeholder = "Search...",
  emptyMessage = "No matches found.",
  createLabel = (query) => `Add "${query.trim()}"`,
  createHint = "Type a new name to add it.",
  allowCreate = false,
  required = false,
  disabled = false,
  error,
  autoOpen = false,
  variant = "default",
  openOnClick = false,
  onChange,
  onCreate,
  onCancel,
  onTab,
}: CreatableComboboxProps) {
  const [hasTyped, setHasTyped] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const justCreatedRef = useRef(false);
  const isCreatingRef = useRef(false);
  const [dropdownState, setDropdownState] = useState<{
    isOpen: boolean;
    pos: { top: number; left: number; width: number } | null;
  }>({ isOpen: false, pos: null });

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const optionIdPrefix = useId();

  const selectedOption = useMemo(
    () => options.find((o) => o.id === value),
    [options, value],
  );

  const selectedLabel = selectedOption?.label ?? "";

  const [displayQuery, setDisplayQuery] = useState(() => selectedLabel);

  const filterText = dropdownState.isOpen && !hasTyped ? "" : displayQuery;

  const filtered = useMemo(
    () => getFilteredOptions(options, filterText),
    [options, filterText],
  );

  const showCreateOption =
    allowCreate &&
    onCreate &&
    filterText.trim() &&
    !hasExactMatch(options, filterText);
  const showCreateHint =
    allowCreate && onCreate && dropdownState.isOpen && !filterText.trim();

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
    setDropdownState((prev) => ({
      ...prev,
      pos: { top, left: rect.left, width: rect.width },
    }));
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled || isCreating) return;
    setDisplayQuery(selectedLabel);
    setHasTyped(false);
    setHighlightedIndex(-1);
    setLocalError(null);
    inputRef.current?.select();

    const rect = containerRef.current?.getBoundingClientRect();
    const dropdownHeight = 240;
    const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
    const pos = rect
      ? {
          top:
            spaceBelow >= dropdownHeight
              ? rect.bottom + 4
              : rect.top - dropdownHeight - 4,
          left: rect.left,
          width: rect.width,
        }
      : null;

    setDropdownState({ isOpen: true, pos });
  }, [disabled, isCreating, selectedLabel]);

  const closeDropdown = useCallback(() => {
    setDropdownState({ isOpen: false, pos: null });
    setHighlightedIndex(0);
  }, []);

  const handleSelect = useCallback(
    (id: string | number) => {
      const label = options.find((o) => o.id === id)?.label ?? "";
      setDisplayQuery(label);
      setHasTyped(false);
      closeDropdown();
      onChange(id);
      inputRef.current?.focus();
    },
    [options, closeDropdown, onChange],
  );

  const handleCreate = useCallback(async () => {
    if (!onCreate || isCreating) return;
    const trimmed = filterText.trim();
    if (!trimmed) return;
    isCreatingRef.current = true;
    setIsCreating(true);
    setLocalError(null);
    try {
      const newId = await onCreate(trimmed);
      justCreatedRef.current = true;
      onChange(newId);
      setHasTyped(false);
      closeDropdown();
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setIsCreating(false);
      isCreatingRef.current = false;
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      setTimeout(() => {
        justCreatedRef.current = false;
      }, 150);
    }
  }, [onCreate, isCreating, filterText, onChange, closeDropdown]);

  const getDefaultCommitId = useCallback(() => {
    if (!filterText.trim()) {
      return options.find((o) => o.label === displayQuery)?.id ?? value;
    }
    const highlightedMatch = filtered[highlightedIndex];
    return highlightedMatch?.id ?? filtered[0]?.id ?? value;
  }, [displayQuery, filterText, filtered, highlightedIndex, options, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!dropdownState.isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDropdown();
        } else if (e.key === "Tab") {
          e.preventDefault();
          onChange(getDefaultCommitId());
          onTab?.(e.shiftKey);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setHighlightedIndex((prev) => {
            if (prev >= totalItems - 1) {
              return 0;
            } else {
              setDisplayQuery(filtered[highlightedIndex + 1].label);
              return prev + 1;
            }
          });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setHighlightedIndex((prev) => {
            if (prev <= 0) {
              return 0;
            } else {
              setDisplayQuery(filtered[highlightedIndex - 1].label);
              return prev - 1;
            }
          });
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (showCreateOption && highlightedIndex === createIndex) {
            handleCreate();
          } else if (filtered[highlightedIndex]) {
            const id = filtered[highlightedIndex].id;
            setDisplayQuery(filtered[highlightedIndex].label);
            setHasTyped(false);
            closeDropdown();
            onChange(id);
            onTab?.(false);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();

          closeDropdown();
          onCancel?.();
          break;
        }
        case "Tab": {
          e.preventDefault();

          closeDropdown();
          onChange(getDefaultCommitId());
          onTab?.(e.shiftKey);
          break;
        }
      }
    },
    [
      dropdownState.isOpen,
      totalItems,
      showCreateOption,
      highlightedIndex,
      createIndex,
      filtered,
      handleCreate,
      closeDropdown,
      openDropdown,
      onCancel,
      onTab,
      options,
      value,
      displayQuery,
      onChange,
      getDefaultCommitId,
    ],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayQuery(val);
    setHasTyped(true);
    setHighlightedIndex(0);
    setLocalError(null);
    if (!dropdownState.isOpen) {
      setDropdownState((prev) => ({ ...prev, isOpen: true }));
    }
  };

  const handleFocus = () => {
    setLocalError(null);
  };

  const handleBlur = () => {
    if (isCreatingRef.current || justCreatedRef.current) return;
    onChange(getDefaultCommitId());
    onCancel?.();
    closeDropdown();
  };
  // , 150);
  // };

  useEffect(() => {
    if (!dropdownState.isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current?.contains(e.target as Node) ||
        document.getElementById(listboxId)?.contains(e.target as Node)
      ) {
        e.preventDefault();
        return;
      }
    };
    const handleResize = () => updateDropdownPosition();
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", handleResize);
    };
  }, [
    dropdownState.isOpen,
    listboxId,
    closeDropdown,
    updateDropdownPosition,
    onCancel,
  ]);

  useLayoutEffect(() => {
    if (autoOpen) {
      openDropdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasTyped) {
      setDisplayQuery(selectedLabel);
    }
  }, [selectedLabel, hasTyped]);

  const dropdownContent = dropdownState.isOpen && dropdownState.pos && (
    <div
      id={listboxId}
      data-no-cell-switch
      role="listbox"
      className="fixed z-[60] bg-theme-background border border-theme-border rounded-theme-medium shadow-lg max-h-60 overflow-y-auto scrollbar-auto-hide"
      style={{
        top: dropdownState.pos.top,
        left: dropdownState.pos.left,
        width: dropdownState.pos.width,
      }}
    >
      {filtered.map((opt, i) => (
        <div
          key={opt.id}
          id={`${optionIdPrefix}-${i}`}
          role="option"
          aria-selected={i === highlightedIndex}
          className={cn(
            "px-3 py-1 text-sm cursor-pointer transition-colors text-theme-text",
            i === highlightedIndex && "bg-theme-primary-subtle",
            opt.id === value && "font-medium",
          )}
          onClick={() => handleSelect(opt.id)}
          onMouseEnter={() => setHighlightedIndex(i)}
        >
          {opt.label}
        </div>
      ))}
      {showCreateHint && (
        <div className="border-t border-theme-border px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs text-theme-muted">
            <span
              aria-hidden="true"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-theme-primary-subtle text-theme-primary"
            >
              +
            </span>
            <span>{createHint}</span>
          </div>
        </div>
      )}
      {showCreateOption && (
        <div
          id={`${optionIdPrefix}-${createIndex}`}
          role="option"
          aria-selected={createIndex === highlightedIndex}
          className={cn(
            "px-3 py-2.5 text-sm cursor-pointer transition-colors text-theme-text border-t border-theme-border",
            createIndex === highlightedIndex && "bg-theme-primary-subtle",
          )}
          onClick={handleCreate}
          onMouseEnter={() => setHighlightedIndex(createIndex)}
        >
          {isCreating ? (
            <span className="flex items-center gap-2 text-theme-text">
              <span className="w-3.5 h-3.5 border-2 border-theme-primary border-t-transparent rounded-full animate-spin" />
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
      {filtered.length === 0 && !showCreateOption && (
        <div className="px-3 py-4 text-sm text-theme-text text-center">
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
          aria-expanded={dropdownState.isOpen}
          aria-controls={dropdownState.isOpen ? listboxId : undefined}
          aria-activedescendant={
            dropdownState.isOpen && totalItems > 0
              ? `${optionIdPrefix}-${highlightedIndex}`
              : undefined
          }
          type="text"
          value={displayQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClick={() => {
            if (openOnClick && !dropdownState.isOpen) {
              openDropdown();
            }
          }}
          placeholder={placeholder}
          disabled={disabled || isCreating}
          className={cn(
            "text-sm",
            variant === "inline"
              ? "input-inline"
              : "input-theme w-full px-3 py-2 pr-8",
            (localError || error) &&
              (variant === "inline" ? "" : "border-theme-danger"),
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />
      </div>
      {(localError || error) && (
        <p className="text-theme-danger text-xs mt-1">{localError || error}</p>
      )}
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
}
