import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { useSettings } from "../../context/settingsContext";
import Modal from "../../components/ui/Modal";
import ModalFooter from "../../components/ui/ModalFooter";
import MobileEntityPicker from "../../components/inputs/MobileEntityPicker";
import DatePicker from "../../components/inputs/DatePicker";
import { getLocalToday } from "../../utils/historicalDataHelpers";
import {
  getFilteredOptions,
  hasExactMatch,
  type ComboboxOption,
} from "../../components/inputs/comboboxUtils";
import { normalizeName } from "../../utils/normalizeName";
import { usePayees } from "../../hooks/useLocalData";
import { StorageService } from "../../services/storageService";
import { cn } from "../../utils/cn";
import {
  findBestPayeeMatch,
  normalizePayeeText,
} from "../../utils/payeeMatching";
import type { MatchConfidence } from "../../utils/payeeMatching";
import "./expenses.css";
import type { Expense, Category, Payee } from "../../types";

const EMPTY_FORM = {
  date: getLocalToday(),
  categoryId: "",
  payeeId: "",
  description: "",
  amount: "",
};

function getFormFromExpense(expense: Expense) {
  return {
    date: expense.date,
    categoryId: String(expense.categoryId ?? ""),
    payeeId: String(expense.payeeId ?? ""),
    description: expense.description ?? "",
    amount: String(expense.amount ?? ""),
  };
}

interface SingleSelectTriggerProps {
  value?: string;
  placeholder: string;
  isOpen: boolean;
  onClick: () => void;
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
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2 text-left text-sm transition-colors"
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
        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
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
  autoFocus?: boolean;
  onChange: (id: string | number | undefined) => void;
  onCreate?: (name: string) => Promise<string | number>;
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
  autoFocus = false,
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

  // Auto-open on mount when autoFocus is set
  useEffect(() => {
    if (!autoFocus) return;
    const timer = window.setTimeout(() => setIsOpen(true), 50);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              className="input-theme w-full px-3 py-2 text-sm"
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

interface CategoryModalProps {
  categories: Category[];
  onCategoriesChange?: (
    action: "add" | "update" | "delete",
    payload: { id?: number; name?: string },
  ) => Promise<number | undefined>;
  onClose: () => void;
  refreshCategories?: () => void | Promise<void>;
}

interface AddEntityButtonProps {
  label: string;
}

function AddEntityButton({ label }: AddEntityButtonProps) {
  return (
    <button
      type="submit"
      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-theme-medium border border-theme-border bg-theme-background px-3 text-sm font-medium text-theme-text transition-colors hover:bg-theme-border sm:h-10 sm:min-h-0 sm:w-10 sm:shrink-0 sm:self-center sm:px-0"
      aria-label={label}
      title={label}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4 shrink-0"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 5v14M5 12h14"
        />
      </svg>
      <span className="sm:hidden">{label}</span>
    </button>
  );
}

function CategoryModal({
  categories,
  onCategoriesChange,
  onClose,
  refreshCategories,
}: CategoryModalProps) {
  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const active = categories.filter((c) => !c.isArchived);
  const filteredCategories = active.filter((category) =>
    normalizeName(category.name)
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase()),
  );

  const addCat = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setNewError("Name is required.");
      return;
    }
    if (active.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setNewError("Already exists.");
      return;
    }
    if (onCategoriesChange) {
      await onCategoriesChange("add", { name });
    } else {
      await StorageService.addCategory(name);
      refreshCategories?.();
    }
    setNewName("");
    setNewError("");
  };

  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = editName.trim();
    if (!name) return;
    if (
      active.some(
        (c) => c.id !== editId && c.name.toLowerCase() === name.toLowerCase(),
      )
    )
      return;
    if (onCategoriesChange) {
      await onCategoriesChange("update", { id: editId as number, name });
    } else {
      await StorageService.updateCategory(editId as number, { name });
      refreshCategories?.();
    }
    setEditId(null);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Manage Categories"
      size="lg"
      mobileFullScreen
      bodyClassName="flex flex-col gap-4 overflow-hidden"
      footer={
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="btn-modal-primary min-h-12 flex-1 text-base sm:min-h-0 sm:text-[0.8125rem]"
          >
            Done
          </button>
        </ModalFooter>
      }
    >
      <form
        onSubmit={addCat}
        className="flex shrink-0 flex-col gap-2 rounded-theme-medium border border-theme-border bg-theme-surface p-3 sm:flex-row sm:items-center"
      >
        <div className="min-w-0 flex-1">
          <input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setNewError("");
            }}
            placeholder="New category…"
            autoFocus
            className="input-theme w-full px-3 py-2 text-sm"
          />
          {newError && (
            <p className="mt-1.5 text-xs text-theme-danger">{newError}</p>
          )}
        </div>
        <AddEntityButton label="Add category" />
      </form>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-theme-medium border border-theme-border bg-theme-background">
        <div className="border-b border-theme-border p-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
            className="input-theme w-full px-3 py-2 text-sm"
          />
        </div>
        {active.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-theme-muted">
            No categories yet.
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-theme-muted">
            No categories match your search.
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-themed">
            {filteredCategories.map((cat) => (
              <li
                key={cat.id}
                className="border-b border-theme-border p-3 last:border-b-0"
              >
                {editId === cat.id ? (
                  <form
                    onSubmit={saveEdit}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-theme min-w-0 flex-1 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="btn-primary-sm flex-1 sm:flex-none"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="btn-cancel-sm flex-1 sm:flex-none"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-theme-text">
                      {normalizeName(cat.name)}
                    </span>
                    <div className="flex gap-3 text-sm sm:gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(cat.id as number);
                          setEditName(cat.name);
                        }}
                        className="font-medium text-theme-primary hover:opacity-80"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (onCategoriesChange) {
                            await onCategoriesChange("delete", { id: cat.id });
                          } else {
                            await StorageService.deleteCategory(
                              cat.id as number,
                            );
                            await refreshCategories?.();
                          }
                        }}
                        className="font-medium text-theme-danger hover:opacity-80"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

interface PayeeModalProps {
  payees: Payee[];
  onPayeesChange?: () => void;
  onClose: () => void;
  refreshPayees?: () => void | Promise<void>;
}

function PayeeModal({
  payees,
  onPayeesChange,
  onClose,
  refreshPayees,
}: PayeeModalProps) {
  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const active = payees.filter((p) => !p.isArchived);
  const filteredPayees = active.filter((payee) =>
    normalizeName(payee.name)
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase()),
  );

  const addPayee = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setNewError("Name is required.");
      return;
    }
    if (active.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setNewError("Already exists.");
      return;
    }
    try {
      await StorageService.addPayee(name);
      setNewName("");
      setNewError("");
      onPayeesChange?.();
      refreshPayees?.();
    } catch (err) {
      setNewError((err as Error).message);
    }
  };

  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = editName.trim();
    if (!name) return;
    if (
      active.some(
        (p) => p.id !== editId && p.name.toLowerCase() === name.toLowerCase(),
      )
    )
      return;
    try {
      await StorageService.updatePayee(editId as number, name);
      setEditId(null);
      onPayeesChange?.();
      refreshPayees?.();
    } catch (err) {
      setNewError((err as Error).message);
    }
  };

  const handleArchive = async (id: number) => {
    await StorageService.archivePayee(id);
    onPayeesChange?.();
    refreshPayees?.();
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Manage Payees"
      size="lg"
      mobileFullScreen
      bodyClassName="flex flex-col gap-4 overflow-hidden"
      footer={
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="btn-modal-primary min-h-12 flex-1 text-base sm:min-h-0 sm:text-[0.8125rem]"
          >
            Done
          </button>
        </ModalFooter>
      }
    >
      <form
        onSubmit={addPayee}
        className="flex shrink-0 flex-col gap-2 rounded-theme-medium border border-theme-border bg-theme-surface p-3 sm:flex-row sm:items-center"
      >
        <div className="min-w-0 flex-1">
          <input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setNewError("");
            }}
            placeholder="New payee…"
            autoFocus
            className="input-theme w-full px-3 py-2 text-sm"
          />
          {newError && (
            <p className="mt-1.5 text-xs text-theme-danger">{newError}</p>
          )}
        </div>
        <AddEntityButton label="Add payee" />
      </form>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-theme-medium border border-theme-border bg-theme-background">
        <div className="border-b border-theme-border p-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search payees..."
            className="input-theme w-full px-3 py-2 text-sm"
          />
        </div>
        {active.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-theme-muted">
            No payees yet.
          </div>
        ) : filteredPayees.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-theme-muted">
            No payees match your search.
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-themed">
            {filteredPayees.map((payee) => (
              <li
                key={payee.id}
                className="border-b border-theme-border p-3 last:border-b-0"
              >
                {editId === payee.id ? (
                  <form
                    onSubmit={saveEdit}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-theme min-w-0 flex-1 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="btn-primary-sm flex-1 sm:flex-none"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="btn-cancel-sm flex-1 sm:flex-none"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-theme-text">
                      {normalizeName(payee.name)}
                    </span>
                    <div className="flex gap-3 text-sm sm:gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(payee.id as number);
                          setEditName(payee.name);
                        }}
                        className="font-medium text-theme-primary hover:opacity-80"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(payee.id as number)}
                        className="font-medium text-theme-danger hover:opacity-80"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

interface ExpenseFormProps {
  onAdd?: (expense: Omit<Expense, "id">) => void;
  onUpdate?: (id: number, changes: Partial<Expense>) => void;
  onClose: () => void;
  categories: Category[];
  onCategoriesChange?: (
    action: "add" | "update" | "delete",
    payload: { id?: number; name?: string },
  ) => Promise<number | undefined>;
  initialExpense?: Expense;
  refreshCategories?: () => Promise<void>;
  refreshPayees?: () => Promise<void>;
}

export default function ExpenseForm({
  onAdd,
  onUpdate,
  onClose,
  categories,
  onCategoriesChange,
  initialExpense,
  refreshCategories: refreshCategoriesProp,
  refreshPayees: refreshPayeesProp,
}: ExpenseFormProps) {
  const isEdit = !!initialExpense;
  const { payees, refresh: refreshPayees } = usePayees();
  const { settings } = useSettings();
  const decimalPlaces = parseInt(settings.decimalPlaces, 10) || 2;

  const [form, setForm] = useState(() => {
    if (!isEdit || !initialExpense) return EMPTY_FORM;
    const base = getFormFromExpense(initialExpense);
    return {
      ...base,
      amount:
        initialExpense.amount != null
          ? initialExpense.amount.toFixed(decimalPlaces)
          : "",
    };
  });
  const [error, setError] = useState("");
  const [showCatModal, setShowCatModal] = useState(false);
  const [showPayeeModal, setShowPayeeModal] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPayeePicker, setShowPayeePicker] = useState(false);
  const [payeeSuggestion, setPayeeSuggestion] = useState<Payee | null>(null);
  const [payeeSuggestionConfidence, setPayeeSuggestionConfidence] =
    useState<MatchConfidence | null>(null);
  const [showAliasOffer, setShowAliasOffer] = useState(false);
  const [aliasSaved, setAliasSaved] = useState(false);

  const activeCategories = useMemo(
    () => categories.filter((c) => !c.isArchived),
    [categories],
  );
  const activePayees = useMemo(
    () =>
      payees
        .filter((p) => !p.isArchived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [payees],
  );

  const categoryOptions = useMemo(
    () =>
      activeCategories.map((c) => ({
        id: c.id!,
        label: normalizeName(c.name),
      })),
    [activeCategories],
  );
  const payeeOptions = useMemo(
    () =>
      activePayees.map((p) => ({ id: p.id!, label: normalizeName(p.name) })),
    [activePayees],
  );

  const selectedCategoryName = categoryOptions.find(
    (o) => o.id === Number(form.categoryId),
  )?.label;
  const selectedPayeeName = payeeOptions.find(
    (o) => o.id === Number(form.payeeId),
  )?.label;

  const set =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  // Run payee matching when description changes (debounced on blur)
  const runPayeeMatch = useCallback(
    (description: string) => {
      // Don't suggest if payee already selected
      if (form.payeeId) return;
      if (!description.trim()) {
        setPayeeSuggestion(null);
        return;
      }
      const result = findBestPayeeMatch(description, payees);
      if (!result) {
        setPayeeSuggestion(null);
        return;
      }
      setPayeeSuggestion(result.payee);
      setPayeeSuggestionConfidence(result.confidence);
      // Auto-apply only if confidence is "auto"
      if (result.confidence === "auto") {
        setForm((f) => ({ ...f, payeeId: String(result.payee.id) }));
      }
    },
    [form.payeeId, payees],
  );

  const handleDescriptionBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    runPayeeMatch(e.target.value);
  };

  const acceptSuggestion = () => {
    if (!payeeSuggestion) return;
    setForm((f) => ({ ...f, payeeId: String(payeeSuggestion.id) }));
    setPayeeSuggestion(null);
    setPayeeSuggestionConfidence(null);
  };

  const dismissSuggestion = () => {
    setPayeeSuggestion(null);
    setPayeeSuggestionConfidence(null);
  };

  // When user manually picks a payee while description is filled,
  // offer to save the normalized description as an alias
  const handlePayeeManualSelect = useCallback(
    (id: string | number | undefined) => {
      setForm((f) => ({ ...f, payeeId: id != null ? String(id) : "" }));
      setPayeeSuggestion(null);
      setPayeeSuggestionConfidence(null);
      setAliasSaved(false);
      // Offer alias if description is set and payee was manually chosen
      if (id != null && form.description.trim()) {
        const normalized = normalizePayeeText(form.description);
        if (normalized) setShowAliasOffer(true);
      } else {
        setShowAliasOffer(false);
      }
    },
    [form.description],
  );

  const saveAlias = async () => {
    if (!form.payeeId || !form.description.trim()) return;
    const normalized = normalizePayeeText(form.description);
    if (!normalized) return;
    await StorageService.addPayeeAlias(Number(form.payeeId), normalized);
    setShowAliasOffer(false);
    setAliasSaved(true);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.categoryId) {
      setError("Please select a category.");
      return;
    }
    if (
      !form.amount ||
      isNaN(Number(form.amount)) ||
      Number(form.amount) === 0
    ) {
      setError("Amount cannot be zero.");
      return;
    }
    const payload = {
      date: form.date,
      categoryId: Number(form.categoryId),
      payeeId: form.payeeId ? Number(form.payeeId) : undefined,
      description: form.description,
      amount: parseFloat(form.amount),
    };
    if (isEdit && initialExpense) {
      onUpdate?.(initialExpense.id as number, payload);
    } else {
      onAdd?.(payload);
      setForm(EMPTY_FORM);
    }
    setError("");
  };

  const inputCls = "input-theme px-3 py-2 w-full";

  const handleAmountBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val === "") return;
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setForm((f) => ({ ...f, amount: num.toFixed(decimalPlaces) }));
    }
  };

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={isEdit ? "Edit Expense" : "Add Expense"}
        size="md"
        mobileFullScreen
        footer={
          <ModalFooter>
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel-sm hidden flex-1 sm:inline-flex"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="expense-form"
              className="btn-save-expense min-h-12 flex-1 text-base sm:min-h-0 sm:text-[0.8125rem]"
            >
              {isEdit ? "Save Changes" : "Save Expense"}
            </button>
          </ModalFooter>
        }
      >
        <form id="expense-form" onSubmit={submit} className="space-y-4">
          {error && <p className="text-theme-danger text-sm">{error}</p>}
          <div className="flex flex-col gap-1 text-sm text-theme-muted">
            <span>Date</span>
            <DatePicker
              value={form.date}
              onChange={(iso) => setForm((f) => ({ ...f, date: iso }))}
              placeholder="Select date…"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-sm text-theme-muted">Payee</label>
              <button
                type="button"
                onClick={() => setShowPayeeModal(true)}
                className="text-xs text-theme-primary hover:opacity-80 font-medium"
              >
                + Manage
              </button>
            </div>
            {/* Desktop */}
            <div className="hidden sm:block">
              <DesktopSingleSelectDropdown
                value={form.payeeId ? Number(form.payeeId) : undefined}
                options={payeeOptions}
                placeholder="Select payee"
                emptyMessage="No payees found."
                createHint="Type a new payee name to add it."
                allowCreate
                allowClear
                clearLabel="No payee"
                autoFocus={!isEdit}
                onChange={handlePayeeManualSelect}
                onCreate={async (name) => {
                  const newId = await StorageService.addPayee(name);
                  await refreshPayees();
                  await refreshPayeesProp?.();
                  return newId;
                }}
              />
            </div>
            {/* Mobile */}
            <div className="block sm:hidden">
              <SingleSelectTrigger
                value={selectedPayeeName}
                placeholder="Select payee"
                isOpen={showPayeePicker}
                onClick={() => setShowPayeePicker(true)}
              />
              <MobileEntityPicker
                open={showPayeePicker}
                title="Choose Payee"
                value={form.payeeId ? Number(form.payeeId) : undefined}
                options={payeeOptions}
                placeholder="Search or add payee"
                emptyMessage="No payees found."
                createHint="Type a new payee name to add it."
                allowCreate
                allowClear
                clearLabel="No payee"
                onChange={handlePayeeManualSelect}
                onCreate={async (name) => {
                  const newId = await StorageService.addPayee(name);
                  await refreshPayees();
                  await refreshPayeesProp?.();
                  return newId;
                }}
                onClose={() => setShowPayeePicker(false)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-sm text-theme-muted">Category</label>
              <button
                type="button"
                onClick={() => setShowCatModal(true)}
                className="text-xs text-theme-primary hover:opacity-80 font-medium"
              >
                + Manage
              </button>
            </div>
            {/* Desktop */}
            <div className="hidden sm:block">
              <DesktopSingleSelectDropdown
                value={form.categoryId ? Number(form.categoryId) : undefined}
                options={categoryOptions}
                placeholder="Select category"
                emptyMessage="No categories found."
                createHint="Type a new category name to add it."
                allowCreate
                onChange={(id) =>
                  setForm((f) => ({
                    ...f,
                    categoryId: id != null ? String(id) : "",
                  }))
                }
                onCreate={async (name) => {
                  if (onCategoriesChange) {
                    const newId = await onCategoriesChange("add", { name });
                    await refreshCategoriesProp?.();
                    return newId ?? -1;
                  }
                  const newId = await StorageService.addCategory(name);
                  await refreshCategoriesProp?.();
                  return newId;
                }}
              />
            </div>
            {/* Mobile */}
            <div className="block sm:hidden">
              <SingleSelectTrigger
                value={selectedCategoryName}
                placeholder="Select category"
                isOpen={showCategoryPicker}
                onClick={() => setShowCategoryPicker(true)}
              />
              <MobileEntityPicker
                open={showCategoryPicker}
                title="Choose Category"
                value={form.categoryId ? Number(form.categoryId) : undefined}
                options={categoryOptions}
                placeholder="Search or add category"
                emptyMessage="No categories found."
                createHint="Type a new category name to add it."
                allowCreate
                onChange={(id) =>
                  setForm((f) => ({
                    ...f,
                    categoryId: id != null ? String(id) : "",
                  }))
                }
                onCreate={async (name) => {
                  if (onCategoriesChange) {
                    const newId = await onCategoriesChange("add", { name });
                    await refreshCategoriesProp?.();
                    return newId ?? -1;
                  }
                  const newId = await StorageService.addCategory(name);
                  await refreshCategoriesProp?.();
                  return newId;
                }}
                onClose={() => setShowCategoryPicker(false)}
              />
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm text-theme-muted">
            Description
            <input
              type="text"
              value={form.description}
              onChange={set("description")}
              onBlur={handleDescriptionBlur}
              placeholder="Optional"
              className={inputCls}
            />
          </label>

          {/* Payee suggestion banner */}
          {payeeSuggestion &&
            !form.payeeId &&
            payeeSuggestionConfidence === "confirm" && (
              <div className="flex items-center justify-between gap-2 rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2 text-xs">
                <span className="text-theme-muted">
                  Suggested payee:{" "}
                  <span className="font-medium text-theme-text">
                    {normalizeName(payeeSuggestion.name)}
                  </span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={acceptSuggestion}
                    className="font-medium text-theme-primary hover:opacity-80"
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    onClick={dismissSuggestion}
                    className="text-theme-muted hover:text-theme-text"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

          {/* Alias offer banner */}
          {showAliasOffer && !aliasSaved && (
            <div className="flex items-center justify-between gap-2 rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2 text-xs">
              <span className="text-theme-muted">
                Save{" "}
                <span className="font-medium text-theme-text">
                  "{normalizePayeeText(form.description)}"
                </span>{" "}
                as an alias for faster matching next time?
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={saveAlias}
                  className="font-medium text-theme-primary hover:opacity-80"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowAliasOffer(false)}
                  className="text-theme-muted hover:text-theme-text"
                >
                  No
                </button>
              </div>
            </div>
          )}
          {aliasSaved && (
            <p className="text-xs text-theme-success">Alias saved.</p>
          )}
          <label className="flex flex-col gap-1 text-sm text-theme-muted">
            Amount ($)
            <input
              type="number"
              value={form.amount}
              onChange={set("amount")}
              onBlur={handleAmountBlur}
              placeholder="0.00"
              step={Math.pow(10, -decimalPlaces)}
              required
              inputMode="decimal"
              className={inputCls}
            />
          </label>
        </form>
      </Modal>
      {showCatModal && (
        <CategoryModal
          categories={categories}
          onCategoriesChange={onCategoriesChange}
          refreshCategories={refreshCategoriesProp}
          onClose={() => setShowCatModal(false)}
        />
      )}
      {showPayeeModal && (
        <PayeeModal
          payees={payees}
          onPayeesChange={refreshPayees}
          refreshPayees={refreshPayeesProp}
          onClose={() => setShowPayeeModal(false)}
        />
      )}
    </>
  );
}
