import { useRef, useState } from "react";
import {
  StorageService,
  DEFAULT_CATEGORIES,
} from "../../services/storageService";
import {
  parseCSV,
  parseDateInput,
  getCsvField,
  matchCategoryByDescription,
  matchCategoryByName,
} from "../../utils/csvHelpers";
import { getImportPayeeMatchSummary, findBestImportPayeeMatch } from "../../utils/importPayeeMatching";
import Card from "../../components/ui/Card";
import ImportReviewModal, {
  type ImportReviewSelection,
} from "./ImportReviewModal";
import type { Payee } from "../../types";
import type { ImportPayeeMatchResult, ImportPayeeMatchSummary } from "../../utils/importPayeeMatching";

interface CsvImportCardProps {
  onImportComplete: (importedYears: number[]) => void;
  onStatusChange: (status: string) => void;
  onErrorsChange: (errors: string[]) => void;
}

interface ValidImportRow {
  rowId: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  explicitPayee?: string;
  payeeId?: number;
}

interface PendingImport {
  rows: ValidImportRow[];
  reviewRows: ImportPayeeMatchResult[];
  summary: ImportPayeeMatchSummary;
  replaceMode: boolean;
  activePayees: Payee[];
  isLoading?: boolean;
}

export default function CsvImportCard({
  onImportComplete,
  onStatusChange,
  onErrorsChange,
}: CsvImportCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const yieldToBrowser = () =>
    new Promise<void>((resolve) => {
      if (typeof window !== "undefined" && window.requestAnimationFrame) {
        window.requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(resolve, 0);
    });

  const clearFileInput = () => {
    if (fileRef.current) fileRef.current.value = "";
  };

  const finalizeImport = async (
    rows: ValidImportRow[],
    selectedOverrides: ImportReviewSelection[] = [],
    mode: boolean,
  ) => {
    const selectionMap = new Map(
      selectedOverrides.map((selection) => [selection.rowId, selection]),
    );

    const existing = await StorageService.getAll();
    const existingKeys = new Set(
      (
        existing as Array<{
          date: string;
          amount: number;
          description?: string;
        }>
      ).map((e) => `${e.date}|${e.amount}|${e.description}`),
    );

    const toAdd = mode
      ? rows
      : rows.filter(
          (row) => !existingKeys.has(`${row.date}|${row.amount}|${row.description}`),
        );

    const categoryNames = [...new Set(toAdd.map((row) => row.category).filter(Boolean))];
    const categoryMap: Record<string, number> = {};
    if (categoryNames.length > 0) {
      const existingCategories = await StorageService.getCategories();
      const existingByName = new Map(
        existingCategories.map((category) => [category.name.toLowerCase(), category]),
      );
      for (const name of categoryNames) {
        const existingCategory = existingByName.get(name.toLowerCase());
        if (existingCategory && !existingCategory.isArchived) {
          categoryMap[name] = existingCategory.id!;
        } else {
          try {
            const newId = await StorageService.addCategory(name);
            categoryMap[name] = newId;
          } catch {
            const refreshed = await StorageService.getCategories();
            const found = refreshed.find(
              (category) => category.name.toLowerCase() === name.toLowerCase(),
            );
            if (found) categoryMap[name] = found.id!;
          }
        }
      }
    }

    let matchedPayees = 0;
    let blankPayees = 0;

    for (const row of toAdd) {
      const override = selectionMap.get(row.rowId);
      const payeeId = override?.payeeId ?? row.payeeId ?? undefined;
      if (payeeId != null) {
        matchedPayees++;
      } else {
        blankPayees++;
      }

      if (override?.saveAlias && payeeId != null && row.description.trim()) {
        await StorageService.addPayeeAlias(payeeId, row.description);
      }

      await StorageService.add({
        date: row.date,
        amount: row.amount,
        description: row.description,
        categoryId: categoryMap[row.category],
        payeeId,
      });
    }

    const importedYears = [
      ...new Set(toAdd.map((row) => parseInt(row.date.slice(0, 4), 10))),
    ].sort((a, b) => a - b);

    onImportComplete(importedYears);
    onStatusChange(
      `Imported ${toAdd.length} row(s). ${matchedPayees} payee(s) matched, ${blankPayees} left blank.${toAdd.length !== rows.length ? ` Skipped ${rows.length - toAdd.length} duplicate(s).` : ""}`,
    );
    setPendingImport(null);
    clearFileInput();
  };

  const handleImport = async (
    e: React.ChangeEvent<HTMLInputElement>,
    nextReplaceMode: boolean,
  ) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;
    onStatusChange("Reading…");
    onErrorsChange([]);
    try {
      setPendingImport({
        rows: [],
        reviewRows: [],
        summary: {
          rowsFound: 0,
          validRows: 0,
          skippedRows: 0,
          likelyPayeesFound: 0,
          confidentMatches: 0,
          uncertainMatches: 0,
          unmatchedExpenses: 0,
          newPayeesSuggested: 0,
        },
        replaceMode: nextReplaceMode,
        activePayees: [],
        isLoading: true,
      });
      await yieldToBrowser();

      const text = await file.text();
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        onStatusChange("No data rows found. Check CSV headers and content.");
        setPendingImport(null);
        clearFileInput();
        return;
      }

      const valid: ValidImportRow[] = [];
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
          rowId: `row-${i + 2}`,
          date: iso,
          category: getCsvField(row, ["category"]) || "Uncategorized",
          description: getCsvField(row, ["description", "item"]) || "",
          explicitPayee: getCsvField(row, ["payee"]) || undefined,
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
        setPendingImport(null);
        clearFileInput();
        return;
      }

      // Keep the existing direct path when the CSV explicitly provides payees.
      const hasExplicitPayee = valid.some((row) => row.explicitPayee);
      if (hasExplicitPayee) {
        setPendingImport(null);
        const rows = [...valid];
        const existing = await StorageService.getAll();
        const existingKeys = new Set(
          (
            existing as Array<{
              date: string;
              amount: number;
              description?: string;
            }>
          ).map((entry) => `${entry.date}|${entry.amount}|${entry.description}`),
        );

        const toAdd = nextReplaceMode
          ? rows
          : rows.filter(
              (row) =>
                !existingKeys.has(`${row.date}|${row.amount}|${row.description}`),
            );

        const payeeNames = [
          ...new Set(toAdd.map((row) => row.explicitPayee).filter(Boolean)),
        ];
        const payeeMap: Record<string, number> = {};
        if (payeeNames.length > 0) {
          const existingPayees = await StorageService.getPayees();
          const existingByName = new Map(
            existingPayees.map((p) => [p.name.toLowerCase(), p]),
          );
          for (const name of payeeNames) {
            const existingPayee = existingByName.get(name!.toLowerCase());
            if (existingPayee && !existingPayee.isArchived) {
              payeeMap[name!] = existingPayee.id!;
            } else {
              try {
                const newId = await StorageService.addPayee(name!);
                payeeMap[name!] = newId;
              } catch {
                const refreshed = await StorageService.getPayees();
                const found = refreshed.find(
                  (payee) => payee.name.toLowerCase() === name!.toLowerCase(),
                );
                if (found) payeeMap[name!] = found.id!;
              }
            }
          }
        }

        const categoryNames = [
          ...new Set(toAdd.map((row) => row.category).filter(Boolean)),
        ];
        const categoryMap: Record<string, number> = {};
        if (categoryNames.length > 0) {
          const existingCategories = await StorageService.getCategories();
          const existingByName = new Map(
            existingCategories.map((c) => [c.name.toLowerCase(), c]),
          );
          for (const name of categoryNames) {
            const existingCategory = existingByName.get(name.toLowerCase());
            if (existingCategory && !existingCategory.isArchived) {
              categoryMap[name] = existingCategory.id!;
            } else {
              try {
                const newId = await StorageService.addCategory(name);
                categoryMap[name] = newId;
              } catch {
                const refreshed = await StorageService.getCategories();
                const found = refreshed.find(
                  (category) => category.name.toLowerCase() === name.toLowerCase(),
                );
                if (found) categoryMap[name] = found.id!;
              }
            }
          }
        }

        for (const row of toAdd) {
          await StorageService.add({
            date: row.date,
            amount: row.amount,
            description: row.description,
            categoryId: categoryMap[row.category],
            payeeId: row.explicitPayee ? payeeMap[row.explicitPayee] : undefined,
          });
        }

        const importedYears = [
          ...new Set(toAdd.map((row) => parseInt(row.date.slice(0, 4), 10))),
        ].sort((a, b) => a - b);
        onImportComplete(importedYears);
        onStatusChange(
          `Imported ${toAdd.length} row(s)${toAdd.length !== rows.length ? `, skipped ${rows.length - toAdd.length} duplicate(s)` : ""}.${errors.length ? ` ${errors.length} invalid row(s) skipped.` : ""}`,
        );
        clearFileInput();
        return;
      }

      const activePayees = await StorageService.getActivePayees();
      const payeeMatches = valid.map((row) =>
        {
          const match = findBestImportPayeeMatch(row.description, activePayees, row.rowId);
          return match
            ? { ...match, date: row.date, amount: row.amount }
            : null;
        },
      );
      const summary = {
        ...getImportPayeeMatchSummary(
        valid.map((row) => ({ rowId: row.rowId, description: row.description })),
        activePayees,
        ),
        rowsFound: parsed.length,
        validRows: valid.length,
        skippedRows: errors.length,
      };

      const rowsWithMatches = valid.map((row, index) => {
        const match = payeeMatches[index];
        return {
          ...row,
          payeeId:
            match?.confidence === "confident" ? match.suggestedPayeeId : undefined,
        };
      });

      const reviewRows = payeeMatches.filter(
        (match): match is ImportPayeeMatchResult =>
          Boolean(match && match.confidence === "needs_review"),
      );

      setPendingImport({
        rows: rowsWithMatches,
        reviewRows,
        summary,
        replaceMode: nextReplaceMode,
        activePayees,
        isLoading: false,
      });
      onStatusChange(
        `Found ${summary.likelyPayeesFound} likely payee match${summary.likelyPayeesFound === 1 ? "" : "es"}. Review ${summary.uncertainMatches} uncertain match${summary.uncertainMatches === 1 ? "" : "es"} before importing.`,
      );
    } catch (err) {
      console.error("Import failed:", err);
      setPendingImport(null);
      onStatusChange(`Import failed: ${(err as Error).message}`);
    }
    clearFileInput();
  };

  return (
    <Card title="Import CSV" className="flex-1">
      <p className="text-xs text-theme-muted mb-2">
        Import expenses from a CSV file. We’ll review uncertain payee matches
        before anything is saved.
      </p>
      <CsvImportForm fileRef={fileRef} onImport={handleImport} />

      <ImportReviewModal
        open={Boolean(pendingImport)}
        isLoading={Boolean(pendingImport?.isLoading)}
        loadingMessage="Preparing import review…"
        loadingDescription="We’re scanning descriptions, suggesting payees, and getting your review list ready."
        summary={pendingImport?.summary ?? null}
        reviewRows={pendingImport?.reviewRows ?? []}
        activePayees={pendingImport?.activePayees ?? []}
        onBack={() => {
          setPendingImport(null);
          clearFileInput();
        }}
        onSkipReview={() => {
          if (!pendingImport) return;
          void finalizeImport(
            pendingImport.rows,
            [],
            pendingImport.replaceMode,
          );
        }}
        onImport={(selections) => {
          if (!pendingImport) return;
          void finalizeImport(
            pendingImport.rows,
            selections,
            pendingImport.replaceMode,
          );
        }}
      />
    </Card>
  );
}

function CsvImportForm({
  fileRef,
  onImport,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  onImport: (
    e: React.ChangeEvent<HTMLInputElement>,
    replaceMode: boolean,
  ) => void;
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
        <span className="settings-action-btn shrink-0">Choose File</span>
      </label>
    </>
  );
}
