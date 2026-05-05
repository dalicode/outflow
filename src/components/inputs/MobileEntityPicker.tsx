import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { cn } from "../../utils/cn";
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

  const selectedOption = useMemo(
    () => options.find((o) => o.id === value),
    [options, value],
  );

  const hasQuery = Boolean(query.trim());
  const defaultMatchId = hasQuery ? filtered[0]?.id : value;
  const cannotSaveTypedQuery = hasQuery && filtered.length === 0;

  const handleSave = useCallback(async () => {
    if (query.trim() && filtered[0]) {
      handleSelect(filtered[0].id);
      return;
    }

    onClose();
  }, [filtered, handleSelect, onClose, query]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={title}
      size="full"
      mobileActionLabel="Save"
      onMobileAction={handleSave}
      mobileActionDisabled={isCreating || cannotSaveTypedQuery}
      bodyClassName="overflow-hidden p-0"
      showCloseButton={false}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Search */}
        <div className="shrink-0 border-b border-theme-border p-3">
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
              if (showCreateOption && filtered.length === 0) {
                void handleCreate();
                return;
              }
              if (isCreating || cannotSaveTypedQuery) return;
              void handleSave();
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
          {/* Clear option */}
          {allowClear && value != null && (
            <button
              type="button"
              onClick={handleClear}
              className="flex min-h-10 w-full items-center gap-3 border-b border-theme-border px-2 py-1.5 text-left text-sm text-theme-muted transition-colors hover:bg-theme-border"
            >
              <span className="min-w-0 truncate">{clearLabel}</span>
            </button>
          )}

          {/* Existing options */}
          {filtered.map((opt) => {
            const isSelected = opt.id === defaultMatchId;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between gap-3 border-b border-theme-border px-2 py-1.5 text-left text-sm transition-colors",
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
              onClick={handleCreate}
              disabled={isCreating}
              className={cn(
                "flex min-h-10 w-full items-center gap-3 border-b border-theme-border px-2 py-1.5 text-left text-sm transition-colors",
                isCreating
                  ? "opacity-60 cursor-not-allowed"
                  : cn(
                      "text-theme-text hover:bg-theme-border",
                      filtered.length === 0 && "bg-theme-primary-subtle",
                    ),
              )}
            >
              {isCreating ? (
                <span className="flex items-center gap-2 text-theme-text">
                  <span className="w-4 h-4 border-2 border-theme-primary border-t-transparent rounded-full animate-spin" />
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
          {filtered.length === 0 && !showCreateOption && (
            <div className="px-3 py-8 text-sm text-theme-muted text-center">
              {emptyMessage}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
