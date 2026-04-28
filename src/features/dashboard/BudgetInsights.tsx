import { useSettings } from "../../context/settingsContext";
import type { MonthlySummary } from "../../types";

interface InsightTileProps {
  label: string;
  value: string;
  tone?: "success" | "danger" | "primary" | "neutral";
  subValue?: string;
}

function InsightTile({ label, value, tone, subValue }: InsightTileProps) {
  const { getNumberColorClass } = useSettings();

  const toneClass =
    tone === "success"
      ? "text-theme-success"
      : tone === "danger"
        ? "text-theme-danger"
        : tone === "primary"
          ? "text-theme-primary"
          : getNumberColorClass(Number(value.replace(/[^0-9.-]/g, "")) || 0);

  return (
    <div className="min-w-[130px] md:min-w-0 flex-1 rounded-xl bg-theme-surface shadow-sm p-4 transition-shadow duration-200 hover:shadow-md">
      <div
        className={`text-2xl font-bold tabular-nums tracking-tight ${toneClass}`}
      >
        {value}
      </div>
      <div className="text-xs text-theme-muted mt-1 font-medium uppercase tracking-wider">
        {label}
      </div>
      {subValue && (
        <div className="text-[0.6875rem] text-theme-muted mt-0.5">
          {subValue}
        </div>
      )}
    </div>
  );
}

interface BudgetInsightsProps {
  summary: MonthlySummary;
}

export default function BudgetInsights({ summary }: BudgetInsightsProps) {
  const { formatAmount } = useSettings();

  if (!summary) return null;

  const {
    income,
    fixedExpensesTotal,
    autoSavings,
    remaining,
    fixedExpenses,
    variableExpenses,
  } = summary;

  const totalSavings = autoSavings + remaining;

  return (
    <div className="space-y-4">
      {/* Insight tiles */}
      <div className="flex md:grid md:grid-cols-4 gap-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
        <InsightTile
          label="Spending"
          value={formatAmount(variableExpenses)}
          tone="primary"
        />
        <InsightTile
          label="Auto Savings"
          value={formatAmount(autoSavings)}
          tone="primary"
        />
        <InsightTile
          label="Remaining"
          value={formatAmount(remaining)}
          tone={remaining >= 0 ? "success" : "danger"}
        />
        <InsightTile
          label="Total Savings"
          value={formatAmount(totalSavings)}
          tone={totalSavings >= 0 ? "success" : "danger"}
        />
      </div>

      {/* Fixed expenses mini card */}
      <div className="rounded-xl bg-theme-surface shadow-sm p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-theme-text tracking-tight">
            Fixed Expenses
          </h3>
          <span className="text-lg font-bold text-theme-primary tabular-nums">
            {formatAmount(fixedExpensesTotal)}
          </span>
        </div>

        {fixedExpenses.length === 0 ? (
          <p className="text-sm text-theme-muted">
            No fixed expenses added yet.
          </p>
        ) : (
          <ul className="space-y-0">
            {fixedExpenses.map((f, i) => (
              <li
                key={f.id}
                className={`flex items-center justify-between py-2 text-sm ${
                  i !== fixedExpenses.length - 1
                    ? "border-b border-theme-muted/10"
                    : ""
                }`}
              >
                <span className="text-theme-text font-medium">{f.name}</span>
                <span className="text-theme-primary font-semibold tabular-nums">
                  {formatAmount(f.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
