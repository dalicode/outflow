import { useState, useEffect } from "react";
import { cn } from "../../utils/cn";
import Modal from "../../components/ui/Modal";
import ModalFooter from "../../components/ui/ModalFooter";
import DatePicker from "../../components/inputs/DatePicker";
import { normalizeName } from "../../utils/normalizeName";
import type { Category, Payee } from "../../types";

interface FilterDraft {
  filterGlobal: string;
  filterDateFrom: string;
  filterDateTo: string;
  selectedCategories: Set<string>;
  selectedPayees: Set<string>;
  filterDescription: string;
  filterAmount: string;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  appliedFilters: FilterDraft;
  onApply: (filters: FilterDraft) => void;
  categories: Category[];
  payees: Payee[];
}

const EMPTY_DRAFT: FilterDraft = {
  filterGlobal: "",
  filterDateFrom: "",
  filterDateTo: "",
  selectedCategories: new Set(),
  selectedPayees: new Set(),
  filterDescription: "",
  filterAmount: "",
};

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

export default function FilterModal({
  isOpen,
  onClose,
  appliedFilters,
  onApply,
  categories,
  payees,
}: FilterModalProps) {
  const [draft, setDraft] = useState<FilterDraft>(EMPTY_DRAFT);

  // Sync draft from applied filters when opening
  useEffect(() => {
    if (isOpen) {
      setDraft({
        filterGlobal: appliedFilters.filterGlobal,
        filterDateFrom: appliedFilters.filterDateFrom,
        filterDateTo: appliedFilters.filterDateTo,
        selectedCategories: new Set(appliedFilters.selectedCategories),
        selectedPayees: new Set(appliedFilters.selectedPayees),
        filterDescription: appliedFilters.filterDescription,
        filterAmount: appliedFilters.filterAmount,
      });
    }
  }, [isOpen, appliedFilters]);

  const set = (field: keyof FilterDraft) => (val: string) =>
    setDraft((d) => ({ ...d, [field]: val }));

  const toggleCategory = (name: string) =>
    setDraft((d) => ({
      ...d,
      selectedCategories: toggleInSet(d.selectedCategories, name),
    }));

  const togglePayee = (name: string) =>
    setDraft((d) => ({
      ...d,
      selectedPayees: toggleInSet(d.selectedPayees, name),
    }));

  const handleClearAll = () => setDraft(EMPTY_DRAFT);

  const handleDone = () => {
    onApply(draft);
    onClose();
  };

  const activeCategories = categories.filter((c) => !c.isArchived);
  const activePayees = payees
    .filter((p) => !p.isArchived)
    .sort((a, b) => a.name.localeCompare(b.name));

  const CheckboxList = ({
    label,
    items,
    selected,
    onToggle,
    onClear,
  }: {
    label: string;
    items: Array<{ id?: number; name: string }>;
    selected: Set<string>;
    onToggle: (name: string) => void;
    onClear: () => void;
  }) => (
    <div className="flex flex-col">
      <label className="block text-xs font-medium text-theme-muted mb-1">
        {label}
      </label>
      <div className="border border-theme-border rounded-theme-medium bg-theme-background overflow-hidden">
        <div className="max-h-40 overflow-y-auto scrollbar-auto-hide p-1">
          {items.map((item) => {
            const isChecked = selected.has(item.name);
            return (
              <button
                key={item.id ?? item.name}
                type="button"
                onClick={() => onToggle(item.name)}
                className={cn(
                  "flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-sm rounded-theme-small transition-colors",
                  "hover:bg-theme-border",
                  isChecked && "bg-theme-primary-subtle",
                )}
              >
                <span
                  className={cn(
                    "flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors",
                    isChecked
                      ? "bg-theme-primary border-theme-primary"
                      : "border-theme-border bg-theme-background",
                  )}
                >
                  {isChecked && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </span>
                <span className="truncate text-theme-text">
                  {normalizeName(item.name)}
                </span>
              </button>
            );
          })}
          {items.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-theme-muted">No items</p>
          )}
        </div>
        {selected.size > 0 && (
          <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-theme-border">
            <span className="text-xs text-theme-muted">
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-theme-primary hover:opacity-80 font-medium"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Transactions"
      size="md"
      footer={
        <ModalFooter>
          <button
            onClick={handleClearAll}
            className="summary-cancel-btn rounded-theme-small flex-1"
          >
            Clear all
          </button>
          <button onClick={handleDone} className="summary-save-btn flex-1">
            Done
          </button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-theme-muted mb-1">
            Search
          </label>
          <input
            type="text"
            value={draft.filterGlobal}
            onChange={(e) => set("filterGlobal")(e.target.value)}
            placeholder="Description, category, or amount..."
            className="input-theme w-full px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-theme-muted mb-1">
              Date from
            </label>
            <DatePicker
              value={draft.filterDateFrom}
              onChange={(iso) => set("filterDateFrom")(iso)}
              placeholder="From"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-muted mb-1">
              Date to
            </label>
            <DatePicker
              value={draft.filterDateTo}
              onChange={(iso) => set("filterDateTo")(iso)}
              placeholder="To"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CheckboxList
            label="Categories"
            items={activeCategories}
            selected={draft.selectedCategories}
            onToggle={toggleCategory}
            onClear={() =>
              setDraft((d) => ({ ...d, selectedCategories: new Set() }))
            }
          />
          <CheckboxList
            label="Payees"
            items={activePayees}
            selected={draft.selectedPayees}
            onToggle={togglePayee}
            onClear={() =>
              setDraft((d) => ({ ...d, selectedPayees: new Set() }))
            }
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-theme-muted mb-1">
            Description
          </label>
          <input
            type="text"
            value={draft.filterDescription}
            onChange={(e) => set("filterDescription")(e.target.value)}
            placeholder="Contains..."
            className="input-theme w-full px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-theme-muted mb-1">
            Amount
          </label>
          <input
            type="text"
            value={draft.filterAmount}
            onChange={(e) => set("filterAmount")(e.target.value)}
            placeholder="e.g. 12.50"
            className="input-theme w-full px-3 py-2 text-sm"
          />
        </div>
      </div>
    </Modal>
  );
}
