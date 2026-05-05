import { useMemo } from "react";
import { cn } from "../../utils/cn";
import { getSavingsGradientColor } from "../../utils/colorHelpers";
import type {
  MultiMonthCategoryRow,
  MultiMonthFixedRow,
  MonthlySummary,
  MonthKey,
} from "../../types";

interface CategoryViewTableProps {
  multiCategoryRows: MultiMonthCategoryRow[];
  multiFixedRows: MultiMonthFixedRow[];
  monthSummaries: MonthlySummary[];
  monthKeys: MonthKey[];
  monthSpan: number;
  showGrandTotal: boolean;
  onCategoryClick: (name: string, monthIndex: number) => void;
  onIncomeClick: (monthIndex: number) => void;
  onSavingsClick: (monthIndex: number) => void;
  formatAmount: (n: number) => string;
  getNumberColorClass: (n: number) => string;
}

export default function CategoryViewTable({
  multiCategoryRows,
  multiFixedRows,
  monthSummaries,
  monthKeys,
  monthSpan,
  showGrandTotal,
  onCategoryClick,
  onIncomeClick,
  onSavingsClick,
  formatAmount,
  getNumberColorClass,
}: CategoryViewTableProps) {
  const reversedMonthKeys = useMemo(
    () => [...monthKeys].reverse(),
    [monthKeys],
  );

  const now = new Date();
  const isFutureMonth = (mk: MonthKey) =>
    mk.year > now.getFullYear() ||
    (mk.year === now.getFullYear() && mk.month > now.getMonth());

  const totalSavingsData = useMemo(() => {
    return monthSummaries.map((summary) => {
      const totalSavings = summary.autoSavings + summary.remaining;
      const ratioPct =
        summary.income > 0 ? (totalSavings / summary.income) * 100 : 0;
      const color = getSavingsGradientColor(ratioPct, summary.savingsRate);
      return { totalSavings, color };
    });
  }, [monthSummaries]);

  const grandTotalSavings = useMemo(() => {
    const grandTotal = monthSummaries.reduce(
      (s, m) => s + m.autoSavings + m.remaining,
      0,
    );
    const totalIncome = monthSummaries.reduce((s, m) => s + m.income, 0);
    const avgRate =
      monthSummaries.length > 0
        ? monthSummaries.reduce((s, m) => s + m.savingsRate, 0) /
          monthSummaries.length
        : 0;
    const ratioPct = totalIncome > 0 ? (grandTotal / totalIncome) * 100 : 0;
    const color = getSavingsGradientColor(ratioPct, avgRate);
    return { grandTotal, color };
  }, [monthSummaries]);

  const remainingClasses = useMemo(() => {
    return monthSummaries.map((summary) => {
      const v = summary.remaining;
      return v > 0
        ? "text-theme-success"
        : v < 0
          ? "text-theme-danger"
          : "text-theme-text";
    });
  }, [monthSummaries]);

  const remainingGrandTotalClass = useMemo(() => {
    const v = monthSummaries.reduce((s, m) => s + m.remaining, 0);
    return v > 0
      ? "text-theme-success"
      : v < 0
        ? "text-theme-danger"
        : "text-theme-text";
  }, [monthSummaries]);

  const colSpanCount =
    monthSpan > 1 ? 2 + monthSpan + (showGrandTotal ? 1 : 0) : 3;

  return (
    <table className="w-full text-sm border-separate border-spacing-0">
      <thead className="sticky top-0 z-10">
        <tr>
          <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-left">
            Category
          </th>
          {monthSpan > 1 ? (
            <>
              <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-right tabular-nums">
                Transactions
              </th>
              {reversedMonthKeys.map((mk, displayIdx) => (
                <th
                  key={mk.key}
                  className={cn(
                    "table-header-cell text-right tabular-nums",
                    displayIdx === 0 && "border-l border-theme-border",
                  )}
                >
                  {mk.name}
                </th>
              ))}
              {showGrandTotal && (
                <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-right tabular-nums">
                  Total
                </th>
              )}
            </>
          ) : (
            <>
              <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-right tabular-nums">
                Transactions
              </th>
              <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-right tabular-nums">
                Amount
              </th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {multiCategoryRows.length === 0 ? (
          <tr>
            <td
              colSpan={colSpanCount}
              className="px-3 py-12 text-center text-theme-muted"
            >
              No expenses yet. Hit{" "}
              <strong className="text-theme-primary">+</strong> to add one.
            </td>
          </tr>
        ) : (
          multiCategoryRows.map(
            ({ name, totalTransactions, monthlyAmounts }) => (
              <tr
                key={name}
                className="border-b border-theme-muted-subtle row-hover"
              >
                <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text whitespace-nowrap font-medium">
                  {name}
                </td>
                {monthSpan > 1 ? (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      {totalTransactions}
                    </td>
                    {[...monthlyAmounts].reverse().map((amount, displayIdx) => {
                      const dataIdx = monthKeys.length - 1 - displayIdx;
                      return (
                        <td
                          key={displayIdx}
                          className={cn(
                            "px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums",
                            displayIdx === 0 && "border-l border-theme-border",
                          )}
                        >
                          {amount !== 0 ? (
                            <button
                              onClick={() => onCategoryClick(name, dataIdx)}
                              className={cn(
                                "font-semibold hover:underline",
                                getNumberColorClass(amount),
                              )}
                            >
                              {formatAmount(amount)}
                            </button>
                          ) : (
                            <span className="text-theme-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                    {showGrandTotal && (
                      <td
                        className={cn(
                          "px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold",
                          getNumberColorClass(
                            monthlyAmounts.reduce((s, v) => s + v, 0),
                          ),
                        )}
                      >
                        {formatAmount(
                          monthlyAmounts.reduce((s, v) => s + v, 0),
                        )}
                      </td>
                    )}
                  </>
                ) : (
                  <>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                      {totalTransactions}
                    </td>
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums">
                      {monthlyAmounts[0] !== 0 ? (
                        <button
                          onClick={() => onCategoryClick(name, 0)}
                          className={cn(
                            "font-semibold hover:underline",
                            getNumberColorClass(monthlyAmounts[0]),
                          )}
                        >
                          {formatAmount(monthlyAmounts[0])}
                        </button>
                      ) : (
                        <span className="text-theme-muted">—</span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ),
          )
        )}

        {multiFixedRows.length > 0 && (
          <>
            <tr>
              <td
                colSpan={colSpanCount}
                className="table-header-cell px-1.5 sm:px-2 md:px-3 whitespace-nowrap"
              >
                Fixed Expenses
              </td>
            </tr>
            {multiFixedRows.map((fe) => {
              const fixedGrandTotal = fe.monthlyAmounts.reduce(
                (s, v) => (s ?? 0) + (v ?? 0),
                0,
              );
              return (
                <tr key={fe.id} className="row-hover">
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text whitespace-nowrap">
                    {fe.name}
                  </td>
                  {monthSpan > 1 ? (
                    <>
                      <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                        —
                      </td>
                      {[...fe.monthlyAmounts]
                        .reverse()
                        .map((amount, displayIdx) => (
                          <td
                            key={displayIdx}
                            className={cn(
                              "px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-medium text-theme-text",
                              displayIdx === 0 &&
                                "border-l border-theme-border",
                            )}
                          >
                            {amount !== null ? formatAmount(amount) : "—"}
                          </td>
                        ))}
                      {showGrandTotal && (
                        <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold text-theme-text">
                          {formatAmount(fixedGrandTotal ?? 0)}
                        </td>
                      )}
                    </>
                  ) : (
                    <>
                      <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                        —
                      </td>
                      <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-medium text-theme-text">
                        {fe.monthlyAmounts[0] !== null
                          ? formatAmount(fe.monthlyAmounts[0])
                          : "—"}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </>
        )}

        {monthSummaries.length > 0 && (
          <>
            <tr>
              <td
                colSpan={colSpanCount}
                className="table-header-cell px-1.5 sm:px-2 md:px-3 whitespace-nowrap"
              >
                Budget Summary
              </td>
            </tr>

            {/* Income */}
            <tr className="row-hover">
              <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text whitespace-nowrap font-medium inline-flex items-center gap-1">
                Income
              </td>
              {monthSpan > 1 ? (
                <>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                    —
                  </td>
                  {[...monthSummaries].reverse().map((summary, displayIdx) => {
                    const dataIdx = monthSummaries.length - 1 - displayIdx;
                    return (
                      <td
                        key={displayIdx}
                        className={cn(
                          "px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums",
                          displayIdx === 0 && "border-l border-theme-border",
                        )}
                      >
                        {isFutureMonth(monthKeys[dataIdx]) ? (
                          <span
                            className="font-semibold text-theme-text cursor-not-allowed opacity-70"
                            title="Use Schedule to change future values"
                          >
                            {formatAmount(summary.income)}
                          </span>
                        ) : (
                          <button
                            onClick={() => onIncomeClick(dataIdx)}
                            className="font-semibold hover:underline text-theme-text"
                          >
                            {formatAmount(summary.income)}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  {showGrandTotal && (
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold text-theme-text">
                      {formatAmount(
                        monthSummaries.reduce((s, m) => s + m.income, 0),
                      )}
                    </td>
                  )}
                </>
              ) : (
                <>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                    —
                  </td>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums">
                    {isFutureMonth(monthKeys[0]) ? (
                      <span
                        className="font-semibold text-theme-text cursor-not-allowed opacity-70"
                        title="Use Schedule to change future values"
                      >
                        {formatAmount(monthSummaries[0].income)}
                      </span>
                    ) : (
                      <button
                        onClick={() => onIncomeClick(0)}
                        className="font-semibold hover:underline text-theme-text"
                      >
                        {formatAmount(monthSummaries[0].income)}
                      </button>
                    )}
                  </td>
                </>
              )}
            </tr>

            {/* Auto Savings */}
            <tr className="row-hover">
              <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text whitespace-nowrap font-medium inline-flex items-center gap-1">
                Auto Savings
              </td>
              {monthSpan > 1 ? (
                <>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                    —
                  </td>
                  {[...monthSummaries].reverse().map((summary, displayIdx) => {
                    const dataIdx = monthSummaries.length - 1 - displayIdx;
                    return (
                      <td
                        key={displayIdx}
                        className={cn(
                          "px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums",
                          displayIdx === 0 && "border-l border-theme-border",
                        )}
                      >
                        {isFutureMonth(monthKeys[dataIdx]) ? (
                          <span
                            className="font-semibold text-theme-text cursor-not-allowed opacity-70"
                            title="Use Schedule to change future values"
                          >
                            {formatAmount(summary.autoSavings)}
                          </span>
                        ) : (
                          <button
                            onClick={() => onSavingsClick(dataIdx)}
                            className="font-semibold hover:underline text-theme-text"
                          >
                            {formatAmount(summary.autoSavings)}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  {showGrandTotal && (
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold text-theme-text">
                      {formatAmount(
                        monthSummaries.reduce((s, m) => s + m.autoSavings, 0),
                      )}
                    </td>
                  )}
                </>
              ) : (
                <>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                    —
                  </td>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums">
                    {isFutureMonth(monthKeys[0]) ? (
                      <span
                        className="font-semibold text-theme-text cursor-not-allowed opacity-70"
                        title="Use Schedule to change future values"
                      >
                        {formatAmount(monthSummaries[0].autoSavings)}
                      </span>
                    ) : (
                      <button
                        onClick={() => onSavingsClick(0)}
                        className="font-semibold hover:underline text-theme-text"
                      >
                        {formatAmount(monthSummaries[0].autoSavings)}
                      </button>
                    )}
                  </td>
                </>
              )}
            </tr>

            {/* Remaining */}
            <tr className="row-hover">
              <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text whitespace-nowrap font-medium">
                Remaining
              </td>
              {monthSpan > 1 ? (
                <>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                    —
                  </td>
                  {[...monthSummaries].reverse().map((summary, displayIdx) => {
                    const dataIdx = monthSummaries.length - 1 - displayIdx;
                    const cls = remainingClasses[dataIdx];
                    return (
                      <td
                        key={displayIdx}
                        className={cn(
                          "px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold",
                          cls,
                          displayIdx === 0 && "border-l border-theme-border",
                        )}
                      >
                        {formatAmount(summary.remaining)}
                      </td>
                    );
                  })}
                  {showGrandTotal && (
                    <td
                      className={cn(
                        "px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold",
                        remainingGrandTotalClass,
                      )}
                    >
                      {formatAmount(
                        monthSummaries.reduce((s, m) => s + m.remaining, 0),
                      )}
                    </td>
                  )}
                </>
              ) : (
                <>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                    —
                  </td>
                  <td
                    className={cn(
                      "px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold",
                      remainingClasses[0],
                    )}
                  >
                    {formatAmount(monthSummaries[0].remaining)}
                  </td>
                </>
              )}
            </tr>

            {/* Total Savings */}
            <tr className="row-hover">
              <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text whitespace-nowrap font-medium">
                Total Savings
              </td>
              {monthSpan > 1 ? (
                <>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                    —
                  </td>
                  {[...monthSummaries].reverse().map((_, displayIdx) => {
                    const dataIdx = monthSummaries.length - 1 - displayIdx;
                    const { totalSavings, color } = totalSavingsData[dataIdx];
                    return (
                      <td
                        key={displayIdx}
                        className={cn(
                          "px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold",
                          displayIdx === 0 && "border-l border-theme-border",
                        )}
                        style={{ color }}
                      >
                        {formatAmount(totalSavings)}
                      </td>
                    );
                  })}
                  {showGrandTotal && (
                    <td
                      className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold"
                      style={{ color: grandTotalSavings.color }}
                    >
                      {formatAmount(grandTotalSavings.grandTotal)}
                    </td>
                  )}
                </>
              ) : (
                <>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right text-theme-muted tabular-nums">
                    —
                  </td>
                  <td
                    className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums font-semibold"
                    style={{ color: totalSavingsData[0]?.color }}
                  >
                    {formatAmount(
                      monthSummaries[0].autoSavings +
                        monthSummaries[0].remaining,
                    )}
                  </td>
                </>
              )}
            </tr>
          </>
        )}
      </tbody>
    </table>
  );
}
