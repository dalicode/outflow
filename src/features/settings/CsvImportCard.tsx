import { useRef, useState } from "react";
import { StorageService } from "../../services/storageService";
import { parseCSV, parseDateInput, getCsvField } from "../../utils/csvHelpers";
import Card from "../../components/ui/Card";
import type { Expense } from "../../types";

interface CsvImportCardProps {
  onImportComplete: (importedYears: number[]) => void;
  onStatusChange: (status: string) => void;
  onErrorsChange: (errors: string[]) => void;
}

export default function CsvImportCard({
  onImportComplete,
  onStatusChange,
  onErrorsChange,
}: CsvImportCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>, replaceMode: boolean) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;
    onStatusChange("Reading…");
    onErrorsChange([]);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        onStatusChange("No data rows found. Check CSV headers and content.");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      const valid: Array<{
        date: string;
        category: string;
        payee?: string;
        description: string;
        amount: number;
      }> = [];
      const errors: string[] = [];
      parsed.forEach((row, i) => {
        const rawDate = getCsvField(row, ["date", "timestamp"]);
        const rawAmount = getCsvField(row, ["amount"]);
        const amount = parseFloat(rawAmount ?? "");
        const iso = parseDateInput(rawDate ?? "");

        if (!rawDate) {
          errors.push(`Row ${i + 2}: missing date/timestamp column`);
          return;
        }
        if (!iso) {
          errors.push(`Row ${i + 2}: unrecognised date format "${rawDate}"`);
          return;
        }
        if (!rawAmount) {
          errors.push(`Row ${i + 2}: missing amount column`);
          return;
        }
        if (isNaN(amount)) {
          errors.push(`Row ${i + 2}: amount "${rawAmount}" is not a number`);
          return;
        }
        if (amount === 0) {
          errors.push(`Row ${i + 2}: amount cannot be zero`);
          return;
        }
        valid.push({
          date: iso,
          category: getCsvField(row, ["category"]) || "Uncategorized",
          payee: getCsvField(row, ["payee"]) || undefined,
          description: getCsvField(row, ["description", "item"]) || "",
          amount,
        });
      });

      onErrorsChange(errors);

      if (errors.length) {
        onStatusChange(
          `${errors.length} row(s) skipped: ${errors.slice(0, 3).join("; ")}`,
        );
      }

      if (valid.length === 0) {
        onStatusChange("No valid rows found. See errors below.");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      const existing = await StorageService.getAll();
      const existingKeys = new Set(
        (existing as Array<{ date: string; amount: number; description?: string }>).map(
          (e) => `${e.date}|${e.amount}|${e.description}`,
        ),
      );

      const toAdd = replaceMode
        ? valid
        : valid.filter(
            (r) => !existingKeys.has(`${r.date}|${r.amount}|${r.description}`),
          );

      // Create payees for imported rows that have payee names
      const payeeNames = [...new Set(toAdd.map((r) => r.payee).filter(Boolean))];
      if (payeeNames.length > 0) {
        const existingPayees = await StorageService.getPayees();
        const existingNames = new Set(existingPayees.map((p) => p.name.toLowerCase()));
        for (const name of payeeNames) {
          if (!existingNames.has(name!.toLowerCase())) {
            try {
              await StorageService.addPayee(name!);
            } catch {
              // Payee may already exist (race condition), ignore
            }
          }
        }
      }
      const skipped = valid.length - toAdd.length;

      for (const row of toAdd) await StorageService.add(row);

      const importedYears = [
        ...new Set(toAdd.map((r) => parseInt(r.date.slice(0, 4), 10))),
      ].sort((a, b) => a - b);

      onImportComplete(importedYears);

      onStatusChange(
        `Imported ${toAdd.length} row(s)${skipped ? `, skipped ${skipped} duplicate(s)` : ""}.${errors.length ? ` ${errors.length} invalid row(s) skipped.` : ""}`,
      );
    } catch (err) {
      console.error("Import failed:", err);
      onStatusChange(`Import failed: ${(err as Error).message}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Card title="Import CSV" className="flex-1">
      <p className="text-xs text-theme-muted mb-2">
        Import expenses from a CSV file. Supports date, category, payee,
        description, and amount columns.
      </p>
      <CsvImportForm fileRef={fileRef} onImport={handleImport} />
    </Card>
  );
}

function CsvImportForm({
  fileRef,
  onImport,
}: {
  fileRef: React.RefObject<HTMLInputElement>;
  onImport: (e: React.ChangeEvent<HTMLInputElement>, replaceMode: boolean) => void;
}) {
  const [replaceMode, setReplaceMode] = useState(false);

  return (
    <>
      <label className="flex items-center gap-1.5 text-xs text-theme-text mb-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={replaceMode}
          onChange={(e) => setReplaceMode(e.target.checked)}
          className="rounded-theme-small"
        />
        Replace mode
      </label>
      <label className="relative inline-flex cursor-pointer shrink-0">
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={(e) => onImport(e, replaceMode)}
          className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
        />
        <span className="shrink-0 bg-theme-primary hover:opacity-90 text-white text-xs font-medium px-2.5 py-1.5 rounded-theme-small transition-opacity">
          Choose File
        </span>
      </label>
    </>
  );
}
