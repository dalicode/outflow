import { useState } from "react";
import { getLocalToday } from "../../utils/historicalDataHelpers";
import { expenseToRow, downloadCSV } from "../../utils/csvHelpers";
import Card from "../../components/ui/Card";
import type { Expense } from "../../types";

interface CsvExportCardProps {
  expenses: Expense[];
  formatDate: (iso: string) => string;
}

export default function CsvExportCard({ expenses, formatDate }: CsvExportCardProps) {
  const [exportRange, setExportRange] = useState({ from: "", to: "" });

  const handleExport = () => {
    let rows = expenses;
    if (exportRange.from) rows = rows.filter((e) => e.date >= exportRange.from);
    if (exportRange.to) rows = rows.filter((e) => e.date <= exportRange.to);
    const csvRows = rows.map((e) => expenseToRow(e, formatDate));
    downloadCSV(csvRows, `expenses-${getLocalToday()}.csv`);
  };

  return (
    <Card title="Export CSV" className="flex-1">
      <p className="text-xs text-theme-muted mb-2">
        Download your expenses as a CSV file for a selected date range.
      </p>
      <div className="flex items-end gap-2">
        <label className="flex-1 flex flex-col gap-0.5 text-xs text-theme-muted min-w-0">
          <span className="truncate">From</span>
          <input
            type="date"
            value={exportRange.from}
            onChange={(e) =>
              setExportRange((r) => ({ ...r, from: e.target.value }))
            }
            className="input-sm"
          />
        </label>
        <label className="flex-1 flex flex-col gap-0.5 text-xs text-theme-muted min-w-0">
          <span className="truncate">To</span>
          <input
            type="date"
            value={exportRange.to}
            onChange={(e) =>
              setExportRange((r) => ({ ...r, to: e.target.value }))
            }
            className="input-sm"
          />
        </label>
        <button onClick={handleExport} className="btn-primary-sm">
          Export
        </button>
      </div>
    </Card>
  );
}
