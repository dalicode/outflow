import { cn } from "../../utils/cn";
import Modal from "../../components/ui/Modal";
import type { Category } from "../../types";

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterGlobal: string;
  onFilterGlobalChange: (val: string) => void;
  filterDateFrom: string;
  onFilterDateFromChange: (val: string) => void;
  filterDateTo: string;
  onFilterDateToChange: (val: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (val: string) => void;
  filterDescription: string;
  onFilterDescriptionChange: (val: string) => void;
  filterAmount: string;
  onFilterAmountChange: (val: string) => void;
  onClearAll: () => void;
  categories: Category[];
}

export default function FilterModal({
  isOpen,
  onClose,
  filterGlobal,
  onFilterGlobalChange,
  filterDateFrom,
  onFilterDateFromChange,
  filterDateTo,
  onFilterDateToChange,
  filterCategory,
  onFilterCategoryChange,
  filterDescription,
  onFilterDescriptionChange,
  filterAmount,
  onFilterAmountChange,
  onClearAll,
  categories,
}: FilterModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Transactions"
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-theme-muted mb-1">
            Search
          </label>
          <input
            type="text"
            value={filterGlobal}
            onChange={(e) => onFilterGlobalChange(e.target.value)}
            placeholder="Description, category, or amount..."
            className="input-theme w-full px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-theme-muted mb-1">
              Date from
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => onFilterDateFromChange(e.target.value)}
              className="input-theme w-full px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-muted mb-1">
              Date to
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => onFilterDateToChange(e.target.value)}
              className="input-theme w-full px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-theme-muted mb-1">
            Category
          </label>
          <select
            value={filterCategory}
            onChange={(e) => onFilterCategoryChange(e.target.value)}
            className="input-theme w-full px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-theme-muted mb-1">
            Description
          </label>
          <input
            type="text"
            value={filterDescription}
            onChange={(e) => onFilterDescriptionChange(e.target.value)}
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
            value={filterAmount}
            onChange={(e) => onFilterAmountChange(e.target.value)}
            placeholder="e.g. 12.50"
            className="input-theme w-full px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={onClearAll}
            className="summary-cancel-btn rounded-theme-small"
          >
            Clear all
          </button>
          <button onClick={onClose} className="summary-save-btn">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
