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
  formatDate: (iso: string) => string,
): (string | number)[] {
  const d = exp.date || "";
  const [y, m] = d.split("-");
  return [
    formatDate(d),
    exp.category ?? "",
    exp.payee ?? "",
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
