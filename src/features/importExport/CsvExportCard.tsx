import { useState, useMemo } from "react";
import { getLocalToday } from "../../utils/historicalDataHelpers";
import { expenseToRow, downloadCSV } from "./utils/csvHelpers";
import { usePayees } from "../../hooks/useLocalData";
import { StorageService } from "../../services/storageService";
import DatePicker from "../../components/inputs/DatePicker";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import ModalFooter from "../../components/ui/ModalFooter";
import type { Expense } from "../../types";

interface CsvExportCardProps {
  expenses: Expense[];
  formatDate: (iso: string) => string;
  variant?: "default" | "flat";
}

export default function CsvExportCard({ expenses, formatDate, variant = "default" }: CsvExportCardProps) {
  const [exportRange, setExportRange] = useState({ from: "", to: "" });
  const [showModal, setShowModal] = useState(false);
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
    setShowModal(false);
  };

  const handleClose = () => {
    setShowModal(false);
    setExportRange({ from: "", to: "" });
  };

  return (
    <>
      <Card title="Export CSV" className="flex-1" variant={variant}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-theme-muted">
            Export your expenses as a CSV file. Compatible with any spreadsheet
            app (Excel, Google Sheets) or budgeting tool.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="settings-action-btn shrink-0"
          >
            Export
          </button>
        </div>
      </Card>

      <Modal
        isOpen={showModal}
        onClose={handleClose}
        title="Export CSV"
        size="sm"
        footer={
          <ModalFooter>
            <button onClick={handleClose} className="btn-cancel-sm flex-1">Cancel</button>
            <button onClick={handleExport} className="btn-modal-primary flex-1">Download</button>
          </ModalFooter>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-theme-muted">
            Select a date range to filter the export. Leave blank to include all expenses.
          </p>
          <label className="flex flex-col gap-1 text-xs text-theme-muted">
            From
            <DatePicker
              value={exportRange.from}
              onChange={(iso) => setExportRange((r) => ({ ...r, from: iso }))}
              variant="inline"
              inputStyle="default"
              placeholder="From"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-theme-muted">
            To
            <DatePicker
              value={exportRange.to}
              onChange={(iso) => setExportRange((r) => ({ ...r, to: iso }))}
              variant="inline"
              inputStyle="default"
              placeholder="To"
            />
          </label>
        </div>
      </Modal>
    </>
  );
}
