import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import ModalFooter from "../../components/ui/ModalFooter";
import Spinner from "../../components/ui/Spinner";
import CreatableCombobox from "../../components/inputs/CreatableCombobox";
import MobileEntityPicker from "../../components/inputs/MobileEntityPicker";
import Card from "../../components/ui/Card";
import { cn } from "../../utils/cn";
import { StorageService } from "../../services/storageService";
import type { Payee } from "../../types";
import type {
  ImportPayeeMatchSummary,
  ImportPayeeReviewRow,
} from "./utils/importPayeeMatching";
import type { ComboboxOption } from "../../components/inputs/comboboxUtils";

export interface ImportReviewSelection {
  rowId: string;
  payeeId: number | null | undefined;
  saveAlias: boolean;
}

interface ImportReviewModalProps {
  open: boolean;
  isLoading?: boolean;
  loadingMessage?: string;
  loadingDescription?: string;
  summary: ImportPayeeMatchSummary | null;
  reviewRows: ImportPayeeReviewRow[];
  activePayees: Payee[];
  onBack: () => void;
  onSkipReview: () => void;
  onImport: (selections: ImportReviewSelection[]) => Promise<void> | void;
}

function SingleSelectTrigger({
  value,
  placeholder,
  isOpen,
  onClick,
}: {
  value?: string;
  placeholder: string;
  isOpen: boolean;
  onClick: () => void;
}) {
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

export default function ImportReviewModal({
  open,
  isLoading = false,
  loadingMessage = "Preparing import review…",
  loadingDescription = "Matching payees and checking your rows.",
  summary,
  reviewRows,
  activePayees,
  onBack,
  onSkipReview,
  onImport,
}: ImportReviewModalProps) {
  const [selections, setSelections] = useState<
    Record<string, ImportReviewSelection>
  >({});
  const [chooserRowId, setChooserRowId] = useState<string | null>(null);
  const [mobilePickerRowId, setMobilePickerRowId] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const payeeOptions = useMemo<ComboboxOption[]>(
    () =>
      activePayees
        .filter((payee) => !payee.isArchived)
        .map((payee) => ({ id: payee.id as number, label: payee.name })),
    [activePayees],
  );

  useEffect(() => {
    if (!open) return;
    const next: Record<string, ImportReviewSelection> = {};
    for (const row of reviewRows) {
      next[row.rowId] = {
        rowId: row.rowId,
        payeeId:
          row.confidence === "confident"
            ? (row.suggestedPayeeId ?? null)
            : undefined,
        saveAlias: false,
      };
    }
    setSelections(next);
    setChooserRowId(null);
    setMobilePickerRowId(null);
  }, [open, reviewRows]);

  const setSelection = (
    rowId: string,
    patch: Partial<ImportReviewSelection>,
  ) => {
    setSelections((current) => ({
      ...current,
      [rowId]: {
        ...current[rowId],
        ...patch,
        rowId,
      },
    }));
  };

  const handleImport = async () => {
    setIsSubmitting(true);
    try {
      await onImport(Object.values(selections));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onBack}
      title="Review Import"
      size="xl"
      bodyClassName="p-0"
      footer={
        <ModalFooter>
          <button onClick={onBack} className="btn-cancel-sm flex-1">
            Back
          </button>
          <button
            onClick={onSkipReview}
            className="btn-cancel-sm flex-1"
            disabled={isLoading || isSubmitting}
          >
            Skip review
          </button>
          <button
            onClick={() => void handleImport()}
            data-testid="btn-import-confirm"
            className="btn-modal-primary flex-1"
            disabled={isLoading || isSubmitting}
          >
            Import
          </button>
        </ModalFooter>
      }
    >
      <div className="relative flex min-h-0 flex-col">
        <div className="border-b border-theme-border bg-theme-surface px-4 py-4 md:px-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              label="Rows found"
              value={summary?.rowsFound ?? reviewRows.length}
            />
            <Stat
              label="Valid rows"
              value={summary?.validRows ?? reviewRows.length}
            />
            <Stat
              label="Likely payees"
              value={summary?.likelyPayeesFound ?? 0}
            />
            <Stat label="Need review" value={summary?.uncertainMatches ?? 0} />
            <Stat label="Skipped" value={summary?.skippedRows ?? 0} />
            <Stat
              label="Need attention"
              value={summary?.unmatchedExpenses ?? 0}
            />
          </div>
          <p className="mt-3 text-xs text-theme-muted">
            Confident matches will be imported automatically. Uncertain matches
            stay blank until you choose them here.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-auto-hide p-4 md:p-5">
          {reviewRows.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-theme-muted">
                Review uncertain matches
              </div>
              {reviewRows.map((row) => {
                const currentSelection = selections[row.rowId];
                const selectedPayee = payeeOptions.find(
                  (option) => option.id === currentSelection?.payeeId,
                );
                const isChooserOpen = chooserRowId === row.rowId;
                const isMobilePickerOpen = mobilePickerRowId === row.rowId;
                const selectedPayeeName = selectedPayee?.label;
                const mobilePickerValue =
                  currentSelection?.payeeId != null
                    ? currentSelection.payeeId
                    : undefined;
                const isAcceptingSuggestion =
                  currentSelection?.payeeId === row.suggestedPayeeId;
                const isLeavingBlank = currentSelection?.payeeId === null;
                const isChooseAnotherActive =
                  currentSelection?.payeeId != null &&
                  currentSelection?.payeeId !== row.suggestedPayeeId;
                return (
                  <Card
                    key={row.rowId}
                    variant="minimal"
                    className="border-[color:color-mix(in_srgb,var(--theme-border)_60%,var(--theme-surface))] shadow-none"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-theme-text truncate">
                            {row.description || "Imported expense"}
                          </p>
                          <p className="text-xs text-theme-muted">
                            {row.date} · {row.amount.toFixed(2)}
                          </p>
                          <p className="text-[11px] text-theme-muted">
                            Suggested:{" "}
                            <span className="font-medium text-theme-text">
                              {row.suggestedPayeeName ?? "No match"}
                            </span>
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold",
                            row.confidence === "confident"
                              ? "border-[color:color-mix(in_srgb,var(--theme-success)_30%,transparent)] bg-theme-success-subtle text-theme-success"
                              : "border-theme-border bg-theme-surface text-theme-muted",
                          )}
                        >
                          {row.confidence === "confident"
                            ? "Confident"
                            : "Needs review"}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {row.suggestedPayeeId != null && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelection(row.rowId, {
                                payeeId: row.suggestedPayeeId,
                                saveAlias: false,
                              });
                              setChooserRowId(null);
                            }}
                            className={cn(
                              "btn-cancel-sm",
                              isAcceptingSuggestion &&
                                "border-transparent bg-[var(--theme-primary)] text-white hover:bg-[var(--theme-primary)] focus:bg-[var(--theme-primary)] focus:text-white focus:border-transparent focus:outline-none",
                            )}
                          >
                            Accept
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setChooserRowId(row.rowId)}
                          className={cn(
                            "btn-cancel-sm",
                            isChooseAnotherActive &&
                              "border-transparent bg-[var(--theme-primary)] text-white hover:bg-[var(--theme-primary)] focus:bg-[var(--theme-primary)] focus:text-white focus:border-transparent focus:outline-none",
                          )}
                        >
                          Choose another
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelection(row.rowId, {
                              payeeId: null,
                              saveAlias: false,
                            });
                            setChooserRowId(null);
                          }}
                          className={cn(
                            "btn-cancel-sm",
                            isLeavingBlank &&
                              "border-transparent bg-[var(--theme-primary)] text-white hover:bg-[var(--theme-primary)] focus:bg-[var(--theme-primary)] focus:text-white focus:border-transparent focus:outline-none",
                          )}
                        >
                          Leave blank
                        </button>
                      </div>

                      {currentSelection?.payeeId != null && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-theme-primary-subtle text-theme-primary text-xs font-medium px-2 py-1">
                          {selectedPayeeName ??
                            `Payee #${currentSelection.payeeId}`}
                        </span>
                      )}
                      {currentSelection?.payeeId === null && (
                        <span className="text-xs text-theme-muted italic">
                          No payee selected
                        </span>
                      )}

                      {isChooserOpen && (
                        <div className="space-y-2 rounded-theme-medium border border-theme-border bg-theme-background p-3">
                          {/* Desktop */}
                          <div className="hidden sm:block">
                            <CreatableCombobox
                              value={
                                currentSelection?.payeeId ??
                                row.suggestedPayeeId ??
                                undefined
                              }
                              options={payeeOptions}
                              placeholder="Choose payee"
                              emptyMessage="No payees found."
                              allowCreate
                              variant="inline"
                              openOnClick
                              onChange={(id) => {
                                setSelection(row.rowId, {
                                  payeeId:
                                    typeof id === "number" ? id : undefined,
                                  saveAlias:
                                    currentSelection?.saveAlias ?? false,
                                });
                                setChooserRowId(null);
                              }}
                              onCreate={async (name) => {
                                const newId =
                                  await StorageService.addPayee(name);
                                setSelection(row.rowId, {
                                  payeeId: newId,
                                  saveAlias:
                                    currentSelection?.saveAlias ?? false,
                                });
                                setChooserRowId(null);
                                return newId;
                              }}
                              onCancel={() => setChooserRowId(null)}
                            />
                          </div>
                          {/* Mobile */}
                          <div className="block sm:hidden">
                            <SingleSelectTrigger
                              value={selectedPayeeName}
                              placeholder="Choose payee"
                              isOpen={isMobilePickerOpen}
                              onClick={() => setMobilePickerRowId(row.rowId)}
                            />
                            <MobileEntityPicker
                              open={isMobilePickerOpen}
                              title="Choose Payee"
                              value={mobilePickerValue}
                              options={payeeOptions}
                              placeholder="Search or add payee"
                              emptyMessage="No payees found."
                              createHint="Type a new payee name to add it."
                              allowCreate
                              allowClear
                              clearLabel="No payee"
                              onChange={(id) => {
                                setSelection(row.rowId, {
                                  payeeId: typeof id === "number" ? id : null,
                                  saveAlias:
                                    currentSelection?.saveAlias ?? false,
                                });
                                setMobilePickerRowId(null);
                                setChooserRowId(null);
                              }}
                              onCreate={async (name) => {
                                const newId =
                                  await StorageService.addPayee(name);
                                setSelection(row.rowId, {
                                  payeeId: newId,
                                  saveAlias:
                                    currentSelection?.saveAlias ?? false,
                                });
                                setMobilePickerRowId(null);
                                setChooserRowId(null);
                                return newId;
                              }}
                              onClose={() => setMobilePickerRowId(null)}
                            />
                          </div>
                          <label className="flex items-center gap-2 text-xs text-theme-text">
                            <input
                              type="checkbox"
                              checked={Boolean(currentSelection?.saveAlias)}
                              onChange={(e) =>
                                setSelection(row.rowId, {
                                  saveAlias: e.target.checked,
                                })
                              }
                              className="rounded-theme-small"
                              disabled={!selectedPayee}
                            />
                            Save &ldquo;{row.description}&rdquo; as an alias for
                            next time
                          </label>
                          <p className="text-[11px] text-theme-muted">
                            Choosing a payee here does not change the original
                            imported description.
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="rounded-theme-medium border border-dashed border-theme-border bg-theme-background px-4 py-8 text-center text-sm text-theme-muted">
              No uncertain matches. You can import now.
            </div>
          )}
        </div>

        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[color-mix(in_srgb,var(--theme-surface)_90%,transparent)] px-6 text-center backdrop-blur-sm">
            <Spinner />
            <p className="text-sm font-semibold text-theme-text">
              {loadingMessage}
            </p>
            <p className="max-w-sm text-xs text-theme-muted">
              {loadingDescription}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-theme-medium border border-theme-border bg-theme-background px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-theme-muted">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-theme-text tabular-nums">
        {value}
      </div>
    </div>
  );
}
