import type { Expense } from "../types";

export const CSV_HEADERS = [
  "Date",
  "Category",
  "Payee",
  "Description",
  "Amount",
  "Month",
  "Year",
];

export function expenseToRow(
  exp: Expense,
  catMap: Record<number, string>,
  payeeMap: Record<number, string>,
  formatDate: (iso: string) => string,
): (string | number)[] {
  const d = exp.date || "";
  const [y, m] = d.split("-");
  return [
    formatDate(d),
    catMap[exp.categoryId as number] ?? "Uncategorized",
    payeeMap[exp.payeeId as number] ?? "",
    exp.description ?? "",
    exp.amount ?? 0,
    m ? parseInt(m, 10) : "",
    y ?? "",
  ];
}

export function downloadCSV(
  rows: (string | number)[][],
  filename: string,
) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [CSV_HEADERS, ...rows]
    .map((r) => r.map(escape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0]
    .split(",")
    .map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? [];
    const clean = vals.map((v) => v.replace(/^"|"$/g, "").trim());
    return Object.fromEntries(headers.map((h, i) => [h, clean[i] ?? ""]));
  });
}

export function parseDateInput(raw: string): string | null {
  if (!raw) return null;
  const datePart = raw.split(/\s+/)[0];
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(datePart)) {
    const [y, m, d] = datePart.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(datePart)) {
    const [m, d, y] = datePart.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }
  return null;
}

export function getCsvField(
  row: Record<string, string>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    if (row[k] != null && row[k] !== "") return row[k];
  }
  return undefined;
}

function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Try to match a payee name from an expense description.
 * Returns the matched payee name (original casing) or null.
 *
 * Strategy: substring match (longest candidates first to avoid shadowing)
 */
export function matchPayeeByDescription(
  description: string,
  candidates: string[],
): string | null {
  if (!description || candidates.length === 0) return null;

  const normalizedDesc = normalizeForMatching(description);
  const sorted = [...candidates].sort((a, b) => b.length - a.length);

  for (const candidate of sorted) {
    const norm = normalizeForMatching(candidate);
    if (norm.length === 0) continue;
    if (normalizedDesc.includes(norm)) {
      return candidate;
    }
  }

  return null;
}

interface CategoryDefinition {
  name: string;
  aliases: string[];
}

/**
 * Try to match a category from an expense description using aliases.
 * Returns the matched category name (original casing) or null.
 */
export function matchCategoryByDescription(
  description: string,
  categories: CategoryDefinition[],
): string | null {
  if (!description || categories.length === 0) return null;

  const normalizedDesc = normalizeForMatching(description);

  // Flatten all aliases, sort longest first to avoid shadowing
  const allAliases = categories
    .flatMap((cat) =>
      cat.aliases.map((alias) => ({ alias, categoryName: cat.name })),
    )
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const { alias, categoryName } of allAliases) {
    const norm = normalizeForMatching(alias);
    if (norm.length === 0) continue;
    if (normalizedDesc.includes(norm)) {
      return categoryName;
    }
  }

  return null;
}

/**
 * Try to match a category from a raw CSV category value using aliases.
 * Returns the matched category name (original casing) or null.
 */
export function matchCategoryByName(
  rawCategory: string,
  categories: CategoryDefinition[],
): string | null {
  if (!rawCategory || categories.length === 0) return null;

  const normalizedRaw = normalizeForMatching(rawCategory);

  // Flatten all aliases, sort longest first to avoid shadowing
  const allAliases = categories
    .flatMap((cat) =>
      cat.aliases.map((alias) => ({ alias, categoryName: cat.name })),
    )
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const { alias, categoryName } of allAliases) {
    const norm = normalizeForMatching(alias);
    if (norm.length === 0) continue;
    if (normalizedRaw === norm || normalizedRaw.includes(norm)) {
      return categoryName;
    }
  }

  return null;
}
