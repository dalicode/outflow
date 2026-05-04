import { useState, useEffect, useRef } from "react";
import { cn } from "../../utils/cn";
import { normalizeName } from "../../utils/normalizeName";
import DatePicker from "../../components/inputs/DatePicker";
import type { Category } from "../../types";

interface ExpenseTableFiltersProps {
  categories: Category[];
  globalFilter: string;
  onGlobalFilterChange: (val: string) => void;
  columnFilters: {
    dateFrom: string;
    dateTo: string;
    category: string;
    description: string;
    amount: string;
  };
  onColumnFilterChange: (field: string, val: string) => void;
}

export default function ExpenseTableFilters({
  categories,
  globalFilter,
  onGlobalFilterChange,
  columnFilters,
  onColumnFilterChange,
}: ExpenseTableFiltersProps) {
  const [localGlobal, setLocalGlobal] = useState(globalFilter);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalGlobal(globalFilter);
  }, [globalFilter]);

  const handleGlobalChange = (val: string) => {
    setLocalGlobal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onGlobalFilterChange(val);
    }, 150);
  };

  const hasActiveFilters =
    globalFilter ||
    columnFilters.dateFrom ||
    columnFilters.dateTo ||
    columnFilters.category ||
    columnFilters.description ||
    columnFilters.amount;

  return (
    <div className="space-y-2">
      {/* Global search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={localGlobal}
            onChange={(e) => handleGlobalChange(e.target.value)}
            placeholder="Search expenses..."
            className="input-theme w-full px-3 py-1.5 text-sm pr-8"
          />
          {localGlobal && (
            <button
              onClick={() => handleGlobalChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-text"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={() => {
              handleGlobalChange("");
              onColumnFilterChange("dateFrom", "");
              onColumnFilterChange("dateTo", "");
              onColumnFilterChange("category", "");
              onColumnFilterChange("description", "");
              onColumnFilterChange("amount", "");
            }}
            className="text-xs font-medium px-2.5 py-1.5 rounded-theme-medium bg-theme-background text-theme-muted hover:text-theme-text border border-theme-border transition-colors shrink-0"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Column filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="flex gap-1">
          <DatePicker
            value={columnFilters.dateFrom}
            onChange={(iso) => onColumnFilterChange("dateFrom", iso)}
            placeholder="From"
          />
          <DatePicker
            value={columnFilters.dateTo}
            onChange={(iso) => onColumnFilterChange("dateTo", iso)}
            placeholder="To"
          />
        </div>
        <select
          value={columnFilters.category}
          onChange={(e) => onColumnFilterChange("category", e.target.value)}
          className="input-theme px-2 py-1 text-xs"
        >
          <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {normalizeName(c.name)}
              </option>
            ))}
        </select>
        <input
          type="text"
          value={columnFilters.description}
          onChange={(e) => onColumnFilterChange("description", e.target.value)}
          placeholder="Description"
          className="input-theme px-2 py-1 text-xs"
        />
        <input
          type="text"
          value={columnFilters.amount}
          onChange={(e) => onColumnFilterChange("amount", e.target.value)}
          placeholder="Amount"
          className="input-theme px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}
