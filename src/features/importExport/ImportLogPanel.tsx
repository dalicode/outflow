import { cn } from "../../utils/cn";

interface ImportLogPanelProps {
  importStatus: string;
  importErrors: string[];
}

export default function ImportLogPanel({
  importStatus,
  importErrors,
}: ImportLogPanelProps) {
  if (!importStatus && importErrors.length === 0) return null;

  const isSuccess =
    importStatus.includes("success") || importStatus.startsWith("Imported");

  return (
    <div className="bg-theme-surface rounded-theme-large shadow-sm p-4 space-y-2">
      <h2 className="text-xs font-semibold text-theme-muted uppercase tracking-widest">
        Import Log
      </h2>
      {importStatus && (
        <p
          className={cn(
            "text-xs",
            isSuccess ? "text-theme-success" : "text-theme-danger",
          )}
        >
          {importStatus}
        </p>
      )}
      {importErrors.length > 0 && (
        <details>
          <summary className="text-xs text-theme-danger cursor-pointer select-none">
            View all {importErrors.length} error(s)
          </summary>
          <ul className="mt-1.5 max-h-32 overflow-y-auto scrollbar-themed space-y-0.5 text-xs text-theme-danger font-mono">
            {importErrors.map((err, i) => (
              <li key={i} className="break-all">
                {err}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
