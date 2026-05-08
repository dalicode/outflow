import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { cn } from "../../utils/cn";
import Spinner from "../ui/Spinner";
import Modal from "../ui/Modal";
import { CheckIcon } from "../ui/IconButton";
import {
  getFilteredOptions,
  hasExactMatch,
  type ComboboxOption,
} from "./comboboxUtils";
import { useHaptics } from "../../hooks/useHaptics";

interface MobileEntityPickerProps {
  open: boolean;
  title: string;
  value?: string | number;
  options: ComboboxOption[];
  recentOptions?: ComboboxOption[];
  recentLabel?: string;
  placeholder?: string;
  emptyMessage?: string;
  createLabel?: (query: string) => string;
  createHint?: string;
  allowCreate?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  onChange: (id: string | number | undefined) => void;
  onCreate?: (name: string) => Promise<string | number>;
  onClose: () => void;
}

export default function MobileEntityPicker({
  open,
  title,
  value,
  options,
  recentOptions,
  recentLabel = "Recent",
  placeholder = "Search…",
  emptyMessage = "No matches found.",
  createLabel = (query) => `Add "${query.trim()}"`,
  createHint = "Type a new name to add it.",
  allowCreate = false,
  allowClear = false,
  clearLabel = "Clear selection",
  onChange,
  onCreate,
  onClose,
}: MobileEntityPickerProps) {
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const haptics = useHaptics();

  // Reset query when picker opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setCreateError(null);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const filtered = useMemo(
    () => getFilteredOptions(options, query),
    [options, query],
  );
  const showRecentSection = Boolean(recentOptions?.length && !query.trim());
  const recentVisibleOptions = showRecentSection
    ? (recentOptions ?? []).filter((opt) => !opt.isArchived)
    : [];
  const recentIds = useMemo(
    () => new Set(recentVisibleOptions.map((opt) => opt.id)),
    [recentVisibleOptions],
  );
  const displayOptions = showRecentSection
    ? filtered.filter((opt) => !recentIds.has(opt.id))
    : filtered;

  const showCreateOption =
    allowCreate &&
    onCreate &&
    query.trim() &&
    !hasExactMatch(options, query);
  const showCreateHint = allowCreate && onCreate && !query.trim();

  const handleSelect = useCallback(
    (id: string | number) => {
      onChange(id);
      onClose();
      haptics.selection();
    },
    [haptics, onChange, onClose],
  );

  const handleClear = useCallback(() => {
    onChange(undefined);
    onClose();
  }, [onChange, onClose]);

  const handleOptionClick = useCallback(
    (id: string | number | undefined) => () => {
      if (id === undefined) {
        handleClear();
        return;
      }
      handleSelect(id);
    },
    [handleClear, handleSelect],
  );

  const handleCreate = useCallback(async () => {
    if (!onCreate || isCreating) return;
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const newId = await onCreate(trimmed);
      onChange(newId);
      onClose();
      haptics.light();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  }, [haptics, onCreate, isCreating, query, onChange, onClose]);

  const hasQuery = Boolean(query.trim());
  const defaultMatchId = hasQuery ? displayOptions[0]?.id : value;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={title}
      size="full"
      bodyClassName="overflow-hidden p-0"
      showCloseButton={false}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Search */}
        <div className="sticky top-0 z-10 shrink-0 border-b border-theme-border bg-theme-surface p-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCreateError(null);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (showCreateOption && displayOptions.length === 0) {
                void handleCreate();
                return;
              }
              if (isCreating || !filtered[0]) return;
              handleSelect(filtered[0].id);
            }}
            placeholder={placeholder}
            className="input-md w-full"
          />
          {createError && (
            <p className="mt-1.5 text-theme-danger text-xs">{createError}</p>
          )}
          {showCreateHint && (
            <div className="mt-2 flex items-center gap-2 text-xs text-theme-muted">
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-theme-primary-subtle text-theme-primary"
              >
                +
              </span>
              <span>{createHint}</span>
            </div>
          )}
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-auto-hide overscroll-contain p-2">
          {showRecentSection && recentVisibleOptions.length > 0 && (
            <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-theme-muted">
              {recentLabel}
            </div>
          )}
          {recentVisibleOptions.map((opt) => {
            const isSelected = opt.id === value;
            return (
              <button
                key={`recent-${opt.id}`}
                type="button"
                onClick={handleOptionClick(opt.id)}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between gap-3 border-b border-theme-border px-2 py-2.5 text-left text-sm",
                  "transition-[background-color,color,transform] duration-150 motion-safe:active:scale-[0.99]",
                  isSelected
                    ? "bg-theme-primary-subtle text-theme-primary font-medium"
                    : "text-theme-text hover:bg-theme-border",
                )}
              >
                <span className="min-w-0 truncate">{opt.label}</span>
                {isSelected && (
                  <CheckIcon className="w-5 h-5 shrink-0 text-theme-primary" />
                )}
              </button>
            );
          })}

          {/* Clear option */}
          {allowClear && value != null && (
            <button
              type="button"
              onClick={handleOptionClick(undefined)}
              className="flex min-h-12 w-full items-center gap-3 border-b border-theme-border px-2 py-2.5 text-left text-sm text-theme-muted transition-[background-color,color,transform] duration-150 hover:bg-theme-border motion-safe:active:scale-[0.99]"
            >
              <span className="min-w-0 truncate">{clearLabel}</span>
            </button>
          )}

          {/* Existing options */}
          {displayOptions.map((opt) => {
            const isSelected = opt.id === defaultMatchId;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={handleOptionClick(opt.id)}
                className={cn(
                  "flex min-h-12 w-full items-center justify-between gap-3 border-b border-theme-border px-2 py-2.5 text-left text-sm",
                  "transition-[background-color,color,transform] duration-150 motion-safe:active:scale-[0.99]",
                  isSelected
                    ? "bg-theme-primary-subtle text-theme-primary font-medium"
                    : "text-theme-text hover:bg-theme-border",
                )}
              >
                <span className="min-w-0 truncate">{opt.label}</span>
                {isSelected && (
                  <CheckIcon className="w-5 h-5 shrink-0 text-theme-primary" />
                )}
              </button>
            );
          })}

          {/* Create option */}
          {showCreateOption && (
            <button
              type="button"
              onClick={() => {
                void handleCreate();
              }}
              disabled={isCreating}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 border-b border-theme-border px-2 py-2.5 text-left text-sm",
                "transition-[background-color,color,transform] duration-150 motion-safe:active:scale-[0.99]",
                      isCreating
                        ? "opacity-60 cursor-not-allowed"
                        : cn(
                            "text-theme-text hover:bg-theme-border",
                            displayOptions.length === 0 &&
                              "bg-theme-primary-subtle",
                          ),
                    )}
            >
              {isCreating ? (
                <span className="flex items-center gap-2 text-theme-text">
                  <Spinner size="sm" />
                  Adding…
                </span>
              ) : (
                <span className="flex items-center gap-2 text-theme-text">
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-theme-primary-subtle text-theme-primary"
                  >
                    +
                  </span>
                  <span>{createLabel(query)}</span>
                </span>
              )}
            </button>
          )}

          {/* Empty state */}
          {displayOptions.length === 0 &&
            !showCreateOption &&
            recentVisibleOptions.length === 0 && (
            <div className="px-3 py-8 text-sm text-theme-muted text-center">
              {emptyMessage}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
