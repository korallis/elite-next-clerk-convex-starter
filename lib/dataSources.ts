export type TableSelectionMode = "all" | "include" | "exclude";

export function normalizeTableSelection(
  selectionMode: unknown,
  selectedTables: unknown,
  excludedTables: unknown
): {
  mode: TableSelectionMode;
  selectedTables?: string[];
  excludedTables?: string[];
} {
  const normalizeList = (input: unknown) => {
    if (!Array.isArray(input)) return undefined;
    const seen = new Set<string>();
    const values: string[] = [];
    for (const item of input) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(trimmed);
    }
    return values.length > 0 ? values : undefined;
  };

  const normalizedSelected = normalizeList(selectedTables);
  const normalizedExcluded = normalizeList(excludedTables);
  const mode = typeof selectionMode === "string" ? selectionMode : null;

  if (mode === "include" && normalizedSelected) {
    return { mode: "include", selectedTables: normalizedSelected };
  }
  if (mode === "exclude" && normalizedExcluded) {
    return { mode: "exclude", excludedTables: normalizedExcluded };
  }
  if (normalizedSelected) {
    return { mode: "include", selectedTables: normalizedSelected };
  }
  if (normalizedExcluded) {
    return { mode: "exclude", excludedTables: normalizedExcluded };
  }
  return { mode: "all" };
}
