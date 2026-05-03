export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

export interface ComboboxOption {
  id: string | number;
  label: string;
  isArchived?: boolean;
}

export function getFilteredOptions<T extends ComboboxOption>(
  options: T[],
  query: string
): T[] {
  const active = options.filter((o) => !o.isArchived);
  const q = normalizeSearchText(query);
  if (!q) return [...active].sort((a, b) => a.label.localeCompare(b.label));

  return active
    .map((option) => {
      const label = normalizeSearchText(option.label);
      let score = 999;
      if (label === q) score = 0;
      else if (label.startsWith(q)) score = 1;
      else if (label.includes(q)) score = 2;
      return { option, score };
    })
    .filter((r) => r.score !== 999)
    .sort(
      (a, b) =>
        a.score - b.score || a.option.label.localeCompare(b.option.label),
    )
    .map((r) => r.option);
}

export function hasExactMatch(
  options: Array<{ label: string }>,
  query: string
): boolean {
  const q = normalizeSearchText(query);
  return options.some((o) => normalizeSearchText(o.label) === q);
}
