import {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import Modal from "../../components/ui/Modal";
import ModalFooter from "../../components/ui/ModalFooter";
import MobileEntityPicker from "../../components/inputs/MobileEntityPicker";
import DatePicker from "../../components/inputs/DatePicker";
import { StorageService } from "../../services/storageService";
import { normalizeName } from "../../utils/normalizeName";
import { cn } from "../../utils/cn";
import {
  getFilteredOptions,
  hasExactMatch,
  type ComboboxOption,
} from "../../components/inputs/comboboxUtils";
import type { Category, Expense, Payee } from "../../types";

interface BulkEditExpensesModalProps {
  isOpen: boolean;
  selectedExpenses: Expense[];
  categories: Category[];
  payees: Payee[];
  onClose: () => void;
  onApply: (changes: Partial<Expense>) => Promise<void>;
  refreshCategories?: () => Promise<void>;
  refreshPayees?: () => Promise<void>;
}

interface BulkEditFieldProps {
  checked: boolean;
  label: string;
  children: React.ReactNode;
  onToggle: (checked: boolean) => void;
}

interface SingleSelectTriggerProps {
  value?: string;
  placeholder: string;
  isOpen: boolean;
  onClick: () => void;
}

interface DesktopSingleSelectDropdownProps {
  value?: string | number;
  options: ComboboxOption[];
  placeholder: string;
  emptyMessage: string;
  createHint?: string;
  allowCreate?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  onChange: (id: string | number | undefined) => void;
  onCreate?: (name: string) => Promise<string | number>;
}

function SingleSelectTrigger({
  value,
  placeholder,
  isOpen,
  onClick,
}: SingleSelectTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-theme-medium border border-theme-border bg-theme-surface px-3 py-2.5 text-left text-sm font-semibold transition-colors focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_15%,transparent)]"
    >
      <span
        className={cn(
          "min-w-0 truncate",
          value ? "text-theme-text" : "text-theme-muted",
        )}
      >
        {value || placeholder}
      </span>
      <svg
        className={cn(
          "h-4 w-4 shrink-0 text-theme-muted transition-transform",
          isOpen && "rotate-180",
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m6 9 6 6 6-6"
        />
      </svg>
    </button>
  );
}

function DesktopSingleSelectDropdown({
  value,
  options,
  placeholder,
  emptyMessage,
  createHint = "Type a new name to add it.",
  allowCreate = false,
  allowClear = false,
  clearLabel = "Clear selection",
  onChange,
  onCreate,
}: DesktopSingleSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [panelStyle, setPanelStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value),
    [options, value],
  );

  const filteredOptions = useMemo(
    () => getFilteredOptions(options, query),
    [options, query],
  );

  const showCreateOption =
    allowCreate && onCreate && query.trim() && !hasExactMatch(options, query);
  const showCreateHint = allowCreate && onCreate && !query.trim();

  const updatePanelPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPanelStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setCreateError(null);
      setPanelStyle(null);
      return;
    }

    updatePanelPosition();

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, updatePanelPosition]);

  const handleSelect = (id: string | number | undefined) => {
    onChange(id);
    setIsOpen(false);
  };

  const handleCreate = async () => {
    if (!onCreate || isCreating) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const newId = await onCreate(trimmed);
      onChange(newId);
      setIsOpen(false);
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={triggerRef} className="relative">
      <SingleSelectTrigger
        value={selectedOption?.label}
        placeholder={placeholder}
        isOpen={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      />
      {isOpen &&
        panelStyle &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[70] rounded-theme-medium border border-theme-border bg-theme-background p-2 shadow-lg"
            style={{
              top: panelStyle.top,
              left: panelStyle.left,
              width: panelStyle.width,
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCreateError(null);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (showCreateOption && filteredOptions.length === 0) {
                  void handleCreate();
                  return;
                }
                if (filteredOptions[0]) {
                  handleSelect(filteredOptions[0].id);
                }
              }}
              placeholder={placeholder}
              className="input-md w-full"
            />
            {createError && (
              <p className="mt-1.5 text-xs text-theme-danger">{createError}</p>
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
            <div className="mt-2 max-h-52 overflow-y-auto scrollbar-auto-hide">
              <div>
                {allowClear && value != null && (
                  <button
                    type="button"
                    onClick={() => handleSelect(undefined)}
                    className="flex min-h-8 w-full items-center border-b border-theme-border px-2 py-1 text-left text-sm text-theme-muted transition-colors hover:bg-theme-border"
                  >
                    <span className="min-w-0 truncate">{clearLabel}</span>
                  </button>
                )}
                {filteredOptions.map((option) => {
                  const isSelected = option.id === value;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelect(option.id)}
                      className={cn(
                        "flex min-h-8 w-full items-center justify-between gap-3 border-b border-theme-border px-2 py-1 text-left text-sm transition-colors",
                        isSelected
                          ? "bg-theme-primary-subtle text-theme-primary font-medium"
                          : "text-theme-text hover:bg-theme-border",
                      )}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                      {isSelected && (
                        <span className="text-xs font-medium text-theme-primary">
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
                {showCreateOption && (
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={isCreating}
                    className={cn(
                      "flex min-h-8 w-full items-center gap-2 border-b border-theme-border px-2 py-1 text-left text-sm transition-colors",
                      isCreating
                        ? "cursor-not-allowed opacity-60"
                        : "text-theme-text hover:bg-theme-border",
                    )}
                  >
                    {isCreating ? (
                      <span className="flex items-center gap-2 text-theme-text">
                        <span className="h-4 w-4 rounded-full border-2 border-theme-primary border-t-transparent animate-spin" />
                        Adding...
                      </span>
                    ) : (
                      <>
                        <span
                          aria-hidden="true"
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-theme-primary-subtle text-theme-primary"
                        >
                          +
                        </span>
                        <span>Add "{query.trim()}"</span>
                      </>
                    )}
                  </button>
                )}
                {filteredOptions.length === 0 && !showCreateOption && (
                  <div className="px-2.5 py-3 text-center text-xs text-theme-muted">
                    {emptyMessage}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function BulkEditField({
  checked,
  label,
  children,
  onToggle,
}: BulkEditFieldProps) {
  return (
    <div className="rounded-theme-medium border border-theme-border bg-theme-background">
      <label className="flex items-center gap-3 border-b border-theme-border px-3 py-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 rounded border-theme-border"
        />
        <span className="text-sm font-medium text-theme-text">{label}</span>
      </label>
      <div className={cn("p-3", !checked && "pointer-events-none opacity-45")}>
        {children}
      </div>
    </div>
  );
}

export default function BulkEditExpensesModal({
  isOpen,
  selectedExpenses,
  categories,
  payees,
  onClose,
  onApply,
  refreshCategories,
  refreshPayees,
}: BulkEditExpensesModalProps) {
  const [applyDate, setApplyDate] = useState(false);
  const [applyPayee, setApplyPayee] = useState(false);
  const [applyCategory, setApplyCategory] = useState(false);
  const [applyDescription, setApplyDescription] = useState(false);
  const [date, setDate] = useState("");
  const [payeeId, setPayeeId] = useState<number | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPayeePicker, setShowPayeePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );

  const activeCategories = useMemo(
    () => categories.filter((category) => !category.isArchived),
    [categories],
  );
  const activePayees = useMemo(
    () => payees.filter((payee) => !payee.isArchived),
    [payees],
  );
  const payeeOptions = useMemo(
    () =>
      activePayees.map((payee) => ({
        id: payee.id as number,
        label: normalizeName(payee.name),
      })),
    [activePayees],
  );
  const categoryOptions = useMemo(
    () =>
      activeCategories.map((category) => ({
        id: category.id as number,
        label: normalizeName(category.name),
      })),
    [activeCategories],
  );
  const selectedPayeeName = payeeOptions.find((option) => option.id === payeeId)?.label;
  const selectedCategoryName = categoryOptions.find(
    (option) => option.id === categoryId,
  )?.label;

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth < 640);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const firstExpense = selectedExpenses[0];
    setApplyDate(false);
    setApplyPayee(false);
    setApplyCategory(false);
    setApplyDescription(false);
    setDate(firstExpense?.date ?? "");
    setPayeeId(firstExpense?.payeeId);
    setCategoryId(firstExpense?.categoryId);
    setDescription(firstExpense?.description ?? "");
    setError("");
    setSaving(false);
  }, [isOpen, selectedExpenses]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const changes: Partial<Expense> = {};
    if (applyDate) {
      if (!date) {
        setError("Choose a date to apply.");
        return;
      }
      changes.date = date;
    }
    if (applyPayee) {
      changes.payeeId = payeeId;
    }
    if (applyCategory) {
      changes.categoryId = categoryId;
    }
    if (applyDescription) {
      changes.description = description.trim();
    }

    if (Object.keys(changes).length === 0) {
      setError("Select at least one field to update.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onApply(changes);
      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to update expenses.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (saving) return;
        onClose();
      }}
      title={`Edit ${selectedExpenses.length} Expenses`}
      size="lg"
      mobileFullScreen
      footer={
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-cancel-sm hidden flex-1 sm:inline-flex"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="bulk-edit-expenses-form"
            disabled={saving}
            className="btn-modal-primary flex-1"
          >
            {saving ? "Saving..." : "Apply Changes"}
          </button>
        </ModalFooter>
      }
    >
      <form id="bulk-edit-expenses-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-theme-muted">
          Apply the same values to the selected expenses. Only checked fields will change.
        </p>

        {error && <p className="text-sm text-theme-danger">{error}</p>}

        <BulkEditField checked={applyDate} label="Date" onToggle={setApplyDate}>
          <DatePicker
            value={date}
            onChange={setDate}
            variant="inline"
            inputStyle="default"
            placeholder="Select date..."
          />
        </BulkEditField>

        <BulkEditField checked={applyPayee} label="Payee" onToggle={setApplyPayee}>
          {isMobileViewport ? (
            <>
              <SingleSelectTrigger
                value={selectedPayeeName}
                placeholder="Select payee..."
                isOpen={showPayeePicker}
                onClick={() => setShowPayeePicker(true)}
              />
              <MobileEntityPicker
                open={showPayeePicker}
                title="Select Payee"
                value={payeeId}
                options={payeeOptions}
                placeholder="Search payees..."
                emptyMessage="No payees found."
                createHint="Type a new payee name to add it."
                allowCreate
                allowClear
                clearLabel="No payee"
                onChange={(id) => setPayeeId(id != null ? Number(id) : undefined)}
                onCreate={async (name) => {
                  const newId = await StorageService.addPayee(name);
                  if (newId == null) throw new Error("Failed to create payee");
                  await refreshPayees?.();
                  return newId;
                }}
                onClose={() => setShowPayeePicker(false)}
              />
            </>
          ) : (
            <DesktopSingleSelectDropdown
              value={payeeId}
              options={payeeOptions}
              placeholder="Select payee..."
              emptyMessage="No payees found."
              createHint="Type a new payee name to add it."
              allowCreate
              allowClear
              clearLabel="No payee"
              onChange={(id) => setPayeeId(id != null ? Number(id) : undefined)}
              onCreate={async (name) => {
                const newId = await StorageService.addPayee(name);
                if (newId == null) throw new Error("Failed to create payee");
                await refreshPayees?.();
                return newId;
              }}
            />
          )}
        </BulkEditField>

        <BulkEditField
          checked={applyCategory}
          label="Category"
          onToggle={setApplyCategory}
        >
          {isMobileViewport ? (
            <>
              <SingleSelectTrigger
                value={selectedCategoryName}
                placeholder="Select category..."
                isOpen={showCategoryPicker}
                onClick={() => setShowCategoryPicker(true)}
              />
              <MobileEntityPicker
                open={showCategoryPicker}
                title="Select Category"
                value={categoryId}
                options={categoryOptions}
                placeholder="Search categories..."
                emptyMessage="No categories found."
                createHint="Type a new category name to add it."
                allowCreate
                allowClear
                clearLabel="No category"
                onChange={(id) =>
                  setCategoryId(id != null ? Number(id) : undefined)
                }
                onCreate={async (name) => {
                  const newId = await StorageService.addCategory(name);
                  if (newId == null) throw new Error("Failed to create category");
                  await refreshCategories?.();
                  return newId;
                }}
                onClose={() => setShowCategoryPicker(false)}
              />
            </>
          ) : (
            <DesktopSingleSelectDropdown
              value={categoryId}
              options={categoryOptions}
              placeholder="Select category..."
              emptyMessage="No categories found."
              createHint="Type a new category name to add it."
              allowCreate
              allowClear
              clearLabel="No category"
              onChange={(id) =>
                setCategoryId(id != null ? Number(id) : undefined)
              }
              onCreate={async (name) => {
                const newId = await StorageService.addCategory(name);
                if (newId == null) throw new Error("Failed to create category");
                await refreshCategories?.();
                return newId;
              }}
            />
          )}
        </BulkEditField>

        <BulkEditField
          checked={applyDescription}
          label="Description"
          onToggle={setApplyDescription}
        >
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Enter description..."
            className="input-md w-full resize-none"
          />
          <p className="mt-2 text-xs text-theme-muted">
            Leave blank to clear the description on all selected expenses.
          </p>
        </BulkEditField>
      </form>
    </Modal>
  );
}
