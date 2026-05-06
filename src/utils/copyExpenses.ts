import type { Expense, Category, Payee } from "../types";

function resolvePayeeName(
  expense: Expense,
  payees: Payee[],
): string {
  if (!expense.payeeId) return "";
  const payee = payees.find((p) => p.id === expense.payeeId);
  return payee ? payee.name : "";
}

function resolveCategoryName(
  expense: Expense,
  categories: Category[],
): string {
  if (!expense.categoryId) return "";
  const cat = categories.find((c) => c.id === expense.categoryId);
  return cat ? cat.name : "";
}

export function formatExpensesAsTsv(
  expenses: Expense[],
  categories: Category[],
  payees: Payee[],
  formatDate: (date: string) => string,
  formatAmount: (amount: number) => string,
): string {
  const header = "Date\tPayee\tCategory\tDescription\tAmount";
  const rows = expenses.map((exp) => {
    const date = formatDate(exp.date);
    const payee = resolvePayeeName(exp, payees);
    const category = resolveCategoryName(exp, categories);
    const description = exp.description || "";
    const amount = formatAmount(exp.amount);
    return `${date}\t${payee}\t${category}\t${description}\t${amount}`;
  });
  return [header, ...rows].join("\n");
}

export async function copyExpensesToClipboard(
  expenses: Expense[],
  categories: Category[],
  payees: Payee[],
  formatDate: (date: string) => string,
  formatAmount: (amount: number) => string,
): Promise<void> {
  const tsv = formatExpensesAsTsv(expenses, categories, payees, formatDate, formatAmount);
  try {
    await navigator.clipboard.writeText(tsv);
  } catch {
    fallbackCopyToClipboard(tsv);
  }
}

function fallbackCopyToClipboard(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } catch {
    // silently fail
  }
  document.body.removeChild(textarea);
}