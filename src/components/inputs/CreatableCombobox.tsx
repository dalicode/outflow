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
import Spinner from "../ui/Spinner";
import {
  getFilteredOptions,
  hasExactMatch,
  type ComboboxOption,
} from "./comboboxUtils";

const DROPDOWN_MAX_HEIGHT = 240;
const VIEWPORT_MARGIN = 8;
const DROPDOWN_GAP = 4;
const DROPDOWN_MIN_WIDTH = 240;
const DROPDOWN_MAX_WIDTH = 420;

function getDropdownPosition(rect: DOMRect): {
  top: number;
  left: number;
  width: number;
} {
  const availableWidth = window.innerWidth - VIEWPORT_MARGIN * 2;
  const preferredWidth = Math.max(
    rect.width,
    Math.min(DROPDOWN_MAX_WIDTH, Math.max(DROPDOWN_MIN_WIDTH, rect.width * 1.2)),
  );
  const width = Math.min(preferredWidth, availableWidth);
  const left = Math.min(
    Math.max(rect.left, VIEWPORT_MARGIN),
    window.innerWidth - VIEWPORT_MARGIN - width,
  );

  const spaceAbove = rect.top - VIEWPORT_MARGIN;
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  const shouldOpenBelow =
    spaceBelow >= DROPDOWN_MAX_HEIGHT || spaceBelow >= spaceAbove;

  const top = shouldOpenBelow
    ? rect.bottom + DROPDOWN_GAP
    : Math.max(
        VIEWPORT_MARGIN,
        rect.top - Math.min(DROPDOWN_MAX_HEIGHT, Math.max(spaceAbove, 0)) - DROPDOWN_GAP,
      );

  return { top, left, width };
}

interface CreatableComboboxProps {
  label?: string;
  value?: string | number;
  options: ComboboxOption[];
  recentOptions?: ComboboxOption[];
  recentLabel?: string;
  placeholder?: string;
  emptyMessage?: string;
  createLabel?: (query: string) => string;
  createHint?: string;
  allowCreate?: boolean;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  autoOpen?: boolean;
  autoFocus?: boolean;
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
  recentOptions,
  recentLabel = "Recent",
  placeholder = "Search...",
  emptyMessage = "No matches found.",
  createLabel = (query) => `Add "${query.trim()}"`,
  createHint = "Type a new name to add it.",
  allowCreate = false,
  required = false,
  disabled = false,
  error,
  autoOpen = false,
  autoFocus = false,
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
  const showRecentSection = Boolean(recentOptions?.length && !filterText.trim());
  const recentIds = useMemo(
    () => new Set((recentOptions ?? []).map((option) => option.id)),
    [recentOptions],
  );
  const recentVisibleOptions = showRecentSection
    ? (recentOptions ?? []).filter((option) => !option.isArchived)
    : [];
  const displayOptions = showRecentSection
    ? filtered.filter((option) => !recentIds.has(option.id))
    : filtered;

  const showCreateOption =
    allowCreate &&
    onCreate &&
    filterText.trim() &&
    !hasExactMatch(options, filterText);
  const showCreateHint =
    allowCreate && onCreate && dropdownState.isOpen && !filterText.trim();

  const totalItems = displayOptions.length + (showCreateOption ? 1 : 0);
  const createIndex = displayOptions.length;

  const updateDropdownPosition = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDropdownState((prev) => ({
      ...prev,
      pos: getDropdownPosition(rect),
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
    const pos = rect ? getDropdownPosition(rect) : null;

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
    const highlightedMatch = displayOptions[highlightedIndex];
    return highlightedMatch?.id ?? displayOptions[0]?.id ?? value;
  }, [displayOptions, displayQuery, filterText, highlightedIndex, options, value]);

  const commitDefaultSelection = useCallback(() => {
    const id = getDefaultCommitId();
    const option = options.find((o) => o.id === id);
    if (filterText.trim() && displayOptions.length === 0) {
      setDisplayQuery(selectedLabel);
      setHasTyped(false);
      return;
    }
    if (option) {
      setDisplayQuery(option.label);
      setHasTyped(false);
    }
    onChange(id);
  }, [
    filterText,
    displayOptions.length,
    getDefaultCommitId,
    onChange,
    options,
    selectedLabel,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!dropdownState.isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDropdown();
        } else if (e.key === "Tab") {
          if (onTab) {
            e.preventDefault();
            commitDefaultSelection();
            onTab(e.shiftKey);
          } else {
            closeDropdown();
          }
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setHighlightedIndex((prev) => {
            const next = prev >= totalItems - 1 ? 0 : prev + 1;
            setDisplayQuery(displayOptions[next]?.label ?? displayQuery);
            return next;
          });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setHighlightedIndex((prev) => {
            const next = prev <= 0 ? totalItems - 1 : prev - 1;
            setDisplayQuery(displayOptions[next]?.label ?? displayQuery);
            return next;
          });
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (showCreateOption && highlightedIndex === createIndex) {
            handleCreate();
          } else if (displayOptions[highlightedIndex]) {
            const id = displayOptions[highlightedIndex].id;
            setDisplayQuery(displayOptions[highlightedIndex].label);
            setHasTyped(false);
            closeDropdown();
            onChange(id);
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
          closeDropdown();
          if (onTab) {
            e.preventDefault();
            commitDefaultSelection();
            onTab(e.shiftKey);
          }
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
      displayOptions,
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
      commitDefaultSelection,
    ],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayQuery(val);
    setHasTyped(true);
    setHighlightedIndex(0);
    setLocalError(null);
    if (!dropdownState.isOpen) {
      const rect = containerRef.current?.getBoundingClientRect();
      setDropdownState({
        isOpen: true,
        pos: rect ? getDropdownPosition(rect) : null,
      });
    }
  };

  const handleFocus = () => {
    setLocalError(null);
  };

  const handleBlur = () => {
    if (isCreatingRef.current || justCreatedRef.current) return;
    commitDefaultSelection();
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
    const handleScroll = () => updateDropdownPosition();
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
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
    } else if (autoFocus) {
      inputRef.current?.focus();
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
      onMouseDown={(e) => e.preventDefault()}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed z-[60] bg-theme-background border border-theme-border rounded-theme-medium shadow-lg max-h-60 overflow-y-auto scrollbar-auto-hide"
      style={{
        top: dropdownState.pos.top,
        left: dropdownState.pos.left,
        width: dropdownState.pos.width,
        boxSizing: "border-box",
      }}
    >
      {showCreateHint && (
        <div className="border-b border-theme-border px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] leading-4 text-theme-muted">
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
        <div className="border-b border-theme-border px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-theme-muted">
            {recentLabel}
          </div>
        </div>
      )}
      {recentVisibleOptions.map((opt) => (
        <div
          key={`recent-${opt.id}`}
          role="option"
          aria-selected={opt.id === value}
          className={cn(
            "px-3 py-2 text-sm cursor-pointer text-theme-text border-b border-theme-border",
            "transition-[background-color,color,transform] duration-150 motion-safe:active:scale-[0.99]",
            opt.id === value && "bg-theme-primary-subtle",
          )}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSelect(opt.id);
          }}
        >
          {opt.label}
        </div>
      ))}
      {displayOptions.map((opt, i) => (
        <div
          key={opt.id}
          id={`${optionIdPrefix}-${i}`}
          role="option"
          aria-selected={i === highlightedIndex}
          className={cn(
            "px-3 py-2 text-sm cursor-pointer text-theme-text border-b border-theme-border last:border-b-0",
            "transition-[background-color,color,transform] duration-150 motion-safe:active:scale-[0.99]",
            i === highlightedIndex && "bg-theme-primary-subtle",
            opt.id === value && "font-medium",
          )}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSelect(opt.id);
          }}
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
            "px-3 py-2.5 text-sm cursor-pointer text-theme-text border-t border-theme-border",
            "transition-[background-color,color,transform] duration-150 motion-safe:active:scale-[0.99]",
            createIndex === highlightedIndex && "bg-theme-primary-subtle",
          )}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleCreate();
          }}
          onMouseEnter={() => setHighlightedIndex(createIndex)}
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
      {displayOptions.length === 0 &&
        !showCreateOption &&
        recentVisibleOptions.length === 0 && (
        <div className="px-3 py-4 text-sm text-theme-text text-center">
          {emptyMessage}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative", variant === "inline" && "w-full")}
    >
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
              : "input-md w-full pr-8",
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
