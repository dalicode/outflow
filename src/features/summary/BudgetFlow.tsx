import { useSettings } from "../../context/settingsContext";
import { cn } from "../../utils/cn";
import { getCategoryColor } from "./summaryColorUtils";
import BudgetFlowBar, {
  AllocationRow,
  getRemainingBarColor,
  barPct,
} from "../../components/ui/BudgetFlowBar";
import type { MonthlySummary } from "../../types";

interface BudgetFlowProps {
  summary: MonthlySummary;
  variableBreakdown: VariableBreakdownItem[];
}

interface VariableBreakdownItem {
  name: string;
  amount: number;
  pct: number;
}

export default function BudgetFlow({
  summary,
  variableBreakdown,
}: BudgetFlowProps) {
  const { formatAmount, currentTheme } = useSettings();

  const {
    income,
    fixedExpensesTotal,
    variableExpenses,
    autoSavings,
    remaining,
  } = summary;

  const isOverBudget = remaining < 0;
  const baselineRemaining = Math.max(
    0,
    income - Math.max(0, autoSavings) - fixedExpensesTotal,
  );
  const totalAllocated =
    fixedExpensesTotal + variableExpenses + Math.max(0, autoSavings);
  const spentPct = barPct(totalAllocated, income);
  const reservedSavingsColor = currentTheme.colors.text;
  const remainingColor = getRemainingBarColor(
    remaining,
    baselineRemaining,
    currentTheme.colors.success,
    currentTheme.colors.danger,
  );

  const segments = [
    {
      key: "savings",
      label: "Auto Savings",
      value: Math.max(0, autoSavings),
      widthPct: barPct(Math.max(0, autoSavings), income),
      color: reservedSavingsColor,
    },
    {
      key: "fixed",
      label: "Fixed",
      value: fixedExpensesTotal,
      widthPct: barPct(fixedExpensesTotal, income),
      bgClass: "bg-theme-primary",
    },
    ...variableBreakdown.map((item) => ({
      key: item.name,
      label: item.name,
      value: item.amount,
      widthPct: barPct(item.amount, income),
      color: getCategoryColor(item.name),
    })),
  ].filter((s) => s.value > 0);

  return (
    <div className="rounded-theme-large border border-theme-border bg-theme-surface p-5 space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-theme-muted uppercase tracking-wider mb-0.5">
            Monthly Budget
          </p>
          <p className="text-2xl font-bold text-theme-text tabular-nums">
            {formatAmount(income)}
          </p>
        </div>
        <div
          className={cn(
            "text-right",
            isOverBudget
              ? "text-theme-danger"
              : remaining === 0
                ? "text-theme-muted"
                : "text-theme-success",
          )}
        >
          <p className="text-xs uppercase tracking-wider mb-0.5 opacity-70">
            {isOverBudget ? "Over budget" : "Remaining"}
          </p>
          <p className="text-2xl font-bold tabular-nums">
            {formatAmount(Math.abs(remaining))}
          </p>
        </div>
      </div>

      {/* Bar + allocation rows */}
      {income > 0 && (
        <BudgetFlowBar
          income={income}
          segments={segments}
          remaining={remaining}
          remainingColor={remainingColor}
          isOverBudget={isOverBudget}
          overflowAmt={isOverBudget ? Math.abs(remaining) : 0}
          spentPct={spentPct}
          showOverflowLine={false}
          allowPinTooltip={false}
          formatAmount={formatAmount}
        >
          <div className="space-y-1 mt-3">
            <AllocationRow
              label="Fixed Expenses"
              value={fixedExpensesTotal}
              rowPct={barPct(fixedExpensesTotal, income)}
              dotClass="bg-theme-primary"
              textClass="text-theme-primary"
              formatAmount={formatAmount}
            />
            <AllocationRow
              label="Variable Expenses"
              value={variableExpenses}
              rowPct={barPct(variableExpenses, income)}
              dotClass="bg-theme-danger"
              textClass="text-theme-danger"
              formatAmount={formatAmount}
            />
            <AllocationRow
              label="Auto Savings"
              value={Math.max(0, autoSavings)}
              rowPct={barPct(Math.max(0, autoSavings), income)}
              dotColor={reservedSavingsColor}
              textColor={reservedSavingsColor}
              formatAmount={formatAmount}
            />

            <div className="border-t border-theme-border my-2" />

            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block w-2 h-2 rounded-full shrink-0",
                    isOverBudget ? "bg-theme-danger" : "bg-theme-success",
                  )}
                />
                <span className="text-sm font-medium text-theme-text">
                  {isOverBudget ? "Over Budget" : "Remaining"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-theme-muted tabular-nums w-10 text-right">
                  {income > 0
                    ? `${((remaining / income) * 100).toFixed(0)}%`
                    : "—"}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums w-24 text-right",
                    isOverBudget ? "text-theme-danger" : "text-theme-success",
                  )}
                >
                  {isOverBudget ? "−" : "+"}{formatAmount(Math.abs(remaining))}
                </span>
              </div>
            </div>
          </div>
        </BudgetFlowBar>
      )}
    </div>
  );
}
