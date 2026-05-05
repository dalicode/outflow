import { useMemo } from "react";
import { cn } from "../../utils/cn";
import { getSavingsGradientColor } from "../../utils/colorHelpers";
import type { MultiMonthCategoryRow, MonthKey } from "../../types";

interface PayeeViewTableProps {
  multiPayeeRows: MultiMonthCategoryRow[];
  monthKeys: MonthKey[];
  monthSpan: number;
  showGrandTotal: boolean;
  onPayeeClick: (name: string, monthIndex: number) => void;
  formatAmount: (n: number) => string;
  getNumberColorClass: (n: number) => string;
}

export default function PayeeViewTable({
  multiPayeeRows,
  monthKeys,
  monthSpan,
  showGrandTotal,
  onPayeeClick,
  formatAmount,
  getNumberColorClass,
}: PayeeViewTableProps) {
  const reversedMonthKeys = useMemo(
    () => [...monthKeys].reverse(),
    [monthKeys],
  );

  const now = new Date();
  const isFutureMonth = (mk: MonthKey) =>
    mk.year > now.getFullYear() ||
    (mk.year === now.getFullYear() && mk.month > now.getMonth());

  const colCount =
    monthSpan > 1 ? 2 + monthSpan + (showGrandTotal ? 1 : 0) : 4;

  return (
    <table className="w-full text-sm border-separate border-spacing-0">
      <thead className="sticky top-0 z-10">
        <tr>
          <th className="table-header-cell px-1.5 sm:px-2 md:px-3 text-left">
            Payee
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
        {multiPayeeRows.map((row) => {
          const grandTotal = row.monthlyAmounts.reduce((s, v) => s + v, 0);
          return (
            <tr
              key={row.name}
              className="border-b border-theme-muted-subtle row-hover"
            >
              <td className="px-1.5 sm:px-2 md:px-3 py-1 text-theme-text whitespace-nowrap">
                {row.name}
              </td>
              {monthSpan > 1 ? (
                <>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums text-theme-muted">
                    {row.totalTransactions}
                  </td>
                  {reversedMonthKeys.map((mk, displayIdx) => {
                    const dataIdx = monthKeys.length - 1 - displayIdx;
                    const amount = row.monthlyAmounts[dataIdx] ?? 0;
                    const future = isFutureMonth(mk);
                    return (
                      <td
                        key={mk.key}
                        className={cn(
                          "py-1 text-right tabular-nums",
                          displayIdx === 0 && "border-l border-theme-border",
                          future && "text-theme-muted",
                        )}
                      >
                        {amount !== 0 ? (
                          <button
                            type="button"
                            onClick={() => onPayeeClick(row.name, dataIdx)}
                            className={cn(
                              "px-1.5 sm:px-2 md:px-3 rounded-theme-small transition-colors",
                              "hover:bg-theme-border",
                            )}
                          >
                            <span
                              className={getNumberColorClass(-amount)}
                              style={{
                                backgroundImage:
                                  amount < 0
                                    ? getSavingsGradientColor(-amount)
                                    : undefined,
                                WebkitBackgroundClip:
                                  amount < 0 ? "text" : undefined,
                                backgroundClip:
                                  amount < 0 ? "text" : undefined,
                                color:
                                  amount < 0
                                    ? undefined
                                    : getNumberColorClass(-amount).includes(
                                          "negative",
                                        )
                                      ? undefined
                                      : undefined,
                              }}
                            >
                              {formatAmount(-amount)}
                            </span>
                          </button>
                        ) : (
                          <span className="px-1.5 sm:px-2 md:px-3 text-theme-muted">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {showGrandTotal && (
                    <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums text-theme-text font-medium">
                      {formatAmount(-grandTotal)}
                    </td>
                  )}
                </>
              ) : (
                <>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums text-theme-muted">
                    {row.totalTransactions}
                  </td>
                  <td className="px-1.5 sm:px-2 md:px-3 py-1 text-right tabular-nums">
                    <button
                      type="button"
                      onClick={() => onPayeeClick(row.name, 0)}
                      className="px-1.5 sm:px-2 md:px-3 rounded-theme-small transition-colors hover:bg-theme-border"
                    >
                      <span className={getNumberColorClass(-row.monthlyAmounts[0])}>
                        {formatAmount(-row.monthlyAmounts[0])}
                      </span>
                    </button>
                  </td>
                </>
              )}
            </tr>
          );
        })}
        {multiPayeeRows.length === 0 && (
          <tr>
            <td
              colSpan={colCount}
              className="px-3 py-8 text-center text-sm text-theme-muted"
            >
              No payee data for this period.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
