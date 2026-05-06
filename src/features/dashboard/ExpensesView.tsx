import { forwardRef } from "react";
import { cn } from "../../utils/cn";
import ExpenseTable from "./ExpenseTable";
import type { Expense, Category, Payee } from "../../types";

interface ExpensesViewProps {
  expenses: Expense[];
  categories: Category[];
  payees: Payee[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onBulkDelete: () => void;
  onUpdate: (id: number, changes: Partial<Expense>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isMobile: boolean;
  mobileEditTrigger: number | null;
  viewAnimation: "slide-left" | "slide-right" | null;
  refreshCategories?: () => Promise<void>;
  refreshPayees?: () => Promise<void>;
}

const ExpensesView = forwardRef<React.ComponentRef<typeof ExpenseTable>, ExpensesViewProps>(function ExpensesView({
  expenses,
  categories,
  payees,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onBulkDelete,
  onUpdate,
  onDelete,
  isMobile,
  mobileEditTrigger,
  viewAnimation,
  refreshCategories,
  refreshPayees,
}, ref) {
  return (
    <div
      className={cn(
        viewAnimation === "slide-left" && "view-slide-left",
        viewAnimation === "slide-right" && "view-slide-right",
      )}
    >
      <ExpenseTable
        ref={ref}
        expenses={expenses}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onBulkDelete={onBulkDelete}
        categories={categories}
        payees={payees}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={onToggleSelectAll}
        isMobile={isMobile}
        mobileEditTrigger={mobileEditTrigger}
        refreshCategories={refreshCategories}
        refreshPayees={refreshPayees}
      />
    </div>
  );
});

export default ExpensesView;
