import { useState, useEffect } from "react";
import Modal from "../../components/ui/Modal";
import ModalFooter from "../../components/ui/ModalFooter";
import DatePicker from "../../components/inputs/DatePicker";
import { normalizeName } from "../../utils/normalizeName";
import type { Category, Payee } from "../../types";

interface FilterDraft {
  filterGlobal: string;
  filterDateFrom: string;
  filterDateTo: string;
  filterCategory: string;
  filterPayee: string;
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
  filterCategory: "",
  filterPayee: "",
  filterDescription: "",
  filterAmount: "",
};

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
      setDraft({ ...appliedFilters });
    }
  }, [isOpen, appliedFilters]);

  const set = (field: keyof FilterDraft) => (val: string) =>
    setDraft((d) => ({ ...d, [field]: val }));

  const handleClearAll = () => setDraft(EMPTY_DRAFT);

  const handleDone = () => {
    onApply(draft);
    onClose();
  };

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
          <div>
            <label className="block text-xs font-medium text-theme-muted mb-1">
              Category
            </label>
            <select
              value={draft.filterCategory}
              onChange={(e) => set("filterCategory")(e.target.value)}
              className="input-theme w-full px-3 py-2 text-sm"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {normalizeName(c.name)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-muted mb-1">
              Payee
            </label>
            <select
              value={draft.filterPayee}
              onChange={(e) => set("filterPayee")(e.target.value)}
              className="input-theme w-full px-3 py-2 text-sm"
            >
              <option value="">All payees</option>
              {payees
                .filter((p) => !p.isArchived)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((p) => (
                  <option key={p.id} value={p.name}>
                    {normalizeName(p.name)}
                  </option>
                ))}
            </select>
          </div>
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
