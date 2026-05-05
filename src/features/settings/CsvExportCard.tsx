import { useState, useMemo } from "react";
import { getLocalToday } from "../../utils/historicalDataHelpers";
import { expenseToRow, downloadCSV } from "../../utils/csvHelpers";
import { usePayees } from "../../hooks/useLocalData";
import { StorageService } from "../../services/storageService";
import DatePicker from "../../components/inputs/DatePicker";
import Card from "../../components/ui/Card";
import type { Expense } from "../../types";

interface CsvExportCardProps {
  expenses: Expense[];
  formatDate: (iso: string) => string;
}

export default function CsvExportCard({ expenses, formatDate }: CsvExportCardProps) {
  const [exportRange, setExportRange] = useState({ from: "", to: "" });
  const { payees } = usePayees();
  const [categories, setCategories] = useState<{ id?: number; name: string }[]>([]);

  useMemo(() => {
    StorageService.getCategories().then(setCategories);
  }, []);

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id as number, c.name])),
    [categories]
  );
  const payeeMap = useMemo(
    () => Object.fromEntries(payees.map((p) => [p.id as number, p.name])),
    [payees]
  );

  const handleExport = () => {
    let rows = expenses;
    if (exportRange.from) rows = rows.filter((e) => e.date >= exportRange.from);
    if (exportRange.to) rows = rows.filter((e) => e.date <= exportRange.to);
    const csvRows = rows.map((e) => expenseToRow(e, catMap, payeeMap, formatDate));
    downloadCSV(csvRows, `expenses-${getLocalToday()}.csv`);
  };

  return (
    <Card title="Export CSV" className="flex-1">
      <p className="text-xs text-theme-muted mb-2">
        Download your expenses as a CSV file for a selected date range.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-0.5 text-xs text-theme-muted min-w-0">
            <span className="truncate">From</span>
            <DatePicker
              value={exportRange.from}
              onChange={(iso) =>
                setExportRange((r) => ({ ...r, from: iso }))
              }
              variant="inline"
              inputStyle="default"
              placeholder="From"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-theme-muted min-w-0">
            <span className="truncate">To</span>
            <DatePicker
              value={exportRange.to}
              onChange={(iso) =>
                setExportRange((r) => ({ ...r, to: iso }))
              }
              variant="inline"
              inputStyle="default"
              placeholder="To"
            />
          </label>
        </div>
        <button
          onClick={handleExport}
          className="settings-action-btn w-full self-end px-3 sm:w-auto"
        >
          Export
        </button>
      </div>
    </Card>
  );
}
