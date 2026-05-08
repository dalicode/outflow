import MultiMonthViewTable from "./MultiMonthViewTable";
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
  return (
    <MultiMonthViewTable
      entityLabel="Category"
      rows={multiCategoryRows}
      multiFixedRows={multiFixedRows}
      monthSummaries={monthSummaries}
      monthKeys={monthKeys}
      monthSpan={monthSpan}
      showGrandTotal={showGrandTotal}
      onRowClick={onCategoryClick}
      onIncomeClick={onIncomeClick}
      onSavingsClick={onSavingsClick}
      formatAmount={formatAmount}
      getNumberColorClass={getNumberColorClass}
      emptyMessage='No expenses yet. Hit + to add one.'
    />
  );
}
