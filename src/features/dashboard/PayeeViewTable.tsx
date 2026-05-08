import MultiMonthViewTable from "./MultiMonthViewTable";
import type {
  MultiMonthCategoryRow,
  MultiMonthFixedRow,
  MonthlySummary,
  MonthKey,
} from "../../types";

interface PayeeViewTableProps {
  multiPayeeRows: MultiMonthCategoryRow[];
  multiFixedRows: MultiMonthFixedRow[];
  monthSummaries: MonthlySummary[];
  monthKeys: MonthKey[];
  monthSpan: number;
  showGrandTotal: boolean;
  onPayeeClick: (name: string, monthIndex: number) => void;
  onIncomeClick: (monthIndex: number) => void;
  onSavingsClick: (monthIndex: number) => void;
  formatAmount: (n: number) => string;
  getNumberColorClass: (n: number) => string;
}

export default function PayeeViewTable({
  multiPayeeRows,
  multiFixedRows,
  monthSummaries,
  monthKeys,
  monthSpan,
  showGrandTotal,
  onPayeeClick,
  onIncomeClick,
  onSavingsClick,
  formatAmount,
  getNumberColorClass,
}: PayeeViewTableProps) {
  return (
    <MultiMonthViewTable
      entityLabel="Payee"
      rows={multiPayeeRows}
      multiFixedRows={multiFixedRows}
      monthSummaries={monthSummaries}
      monthKeys={monthKeys}
      monthSpan={monthSpan}
      showGrandTotal={showGrandTotal}
      onRowClick={onPayeeClick}
      onIncomeClick={onIncomeClick}
      onSavingsClick={onSavingsClick}
      formatAmount={formatAmount}
      getNumberColorClass={getNumberColorClass}
      emptyMessage="No payee data for this period."
    />
  );
}
